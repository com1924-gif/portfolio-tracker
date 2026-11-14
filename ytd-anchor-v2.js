/* Optional, portfolio-owned performance state. Never changes transaction accounting. */
(function(root){
  'use strict';
  const DAY=86400000;
  const METHOD='modified-dietz';
  const LINKED='broker-linked-estimate';
  function number(value){return value===null||value===undefined||String(value).trim()===''?NaN:Number(value);}
  function day(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return NaN;
    const t=Date.parse(value+'T00:00:00Z');
    return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value?t/DAY:NaN;
  }
  function validate(profile,year){
    const errors=[];
    if(!/^\d{4}$/.test(String(year)))errors.push('Choose a valid year.');
    if(!profile||profile.version!==1||![METHOD,LINKED].includes(profile.method))errors.push('Unsupported YTD profile format.');
    if(errors.length)return errors;
    if(profile.openingAsOf!==`${Number(year)-1}-12-31`)errors.push('Opening NAV must be the prior year-end net assets.');
    if(!Number.isFinite(number(profile.openingNav))||number(profile.openingNav)<0)errors.push('Opening NAV must be a number of zero or more.');
    if(!/^[A-Z]{3}$/.test(profile.currency||''))errors.push('Choose a reporting currency.');
    if(profile.navSource&&!['app','snapshot'].includes(profile.navSource))errors.push('Choose a supported NAV source.');
    if(profile.navSource==='snapshot'&&(!Number.isFinite(day(profile.navSnapshot?.date))||profile.navSnapshot.date.slice(0,4)!==String(year)||!Number.isFinite(number(profile.navSnapshot?.amount))))errors.push('A brokerage NAV snapshot needs a valid date and net asset amount for this year.');
    if(!Array.isArray(profile.externalFlows))errors.push('External flows must be a list.');
    const ids=new Set();
    for(const flow of Array.isArray(profile.externalFlows)?profile.externalFlows:[]){
      if(!flow||typeof flow!=='object'){errors.push('Every flow must be a valid record.');continue;}
      if(!flow.id||ids.has(flow.id))errors.push('Each flow needs a unique reference.');
      ids.add(flow.id);
      if(!Number.isFinite(day(flow.date))||flow.date.slice(0,4)!==String(year))errors.push('Every flow must have a valid date within the selected year.');
      if(!Number.isFinite(number(flow.amount)))errors.push('Every flow needs a signed amount in the reporting currency.');
      if(flow.counterpartyId&&!String(flow.transferId||'').trim())errors.push('An inter-portfolio transfer needs a matching transfer reference.');
    }
    if(!Number.isFinite(day(profile.flowsCompleteThrough))||profile.flowsCompleteThrough<`${year}-01-01`||profile.flowsCompleteThrough>`${year}-12-31`)errors.push('Set the date through which the flow list has been reviewed.');
    if(profile.automaticFlowsAfter!=null){
      const cutoff=profile.automaticFlowsAfter;
      if(profile.method!==METHOD)errors.push('A brokerage return anchor already defines its automatic-flow date.');
      if(!Number.isFinite(day(cutoff))||cutoff<profile.openingAsOf||cutoff>`${year}-12-31`)errors.push('Choose a valid automatic-flow cutoff in this performance year or its prior year end.');
      if(profile.flowsCompleteThrough<cutoff)errors.push('Review historical external flows through the automatic-flow cutoff.');
      if((Array.isArray(profile.externalFlows)?profile.externalFlows:[]).some(f=>f?.date>cutoff))errors.push('Manual external flows must be on or before the automatic-flow cutoff.');
    }
    if(profile.method===LINKED){
      const a=profile.anchor;
      if(!Number.isFinite(day(a?.date))||a.date.slice(0,4)!==String(year))errors.push('The return anchor needs a valid date in the selected year.');
      if(!(number(a?.nav)>0))errors.push('Brokerage NAV at the return anchor must be positive.');
      if(!Number.isFinite(number(a?.returnPct))||number(a.returnPct)<-100)errors.push('The brokerage YTD return must be at least -100%.');
      if(!Number.isFinite(number(a?.appNav)))errors.push('Set the app NAV at the same anchor close, or use the brokerage NAV when they agree.');
      if(profile.navSource&&profile.navSource!=='app')errors.push('Automatic continuation uses current app NAV.');
      if(a?.date&&profile.flowsCompleteThrough<a.date)errors.push('Review historical external flows through the anchor date.');
      if((Array.isArray(profile.externalFlows)?profile.externalFlows:[]).some(f=>f?.date>a?.date))errors.push('Manual historical flows must be on or before the return anchor. Later deposits and withdrawals are read automatically.');
    }
    return [...new Set(errors)];
  }
  function calculate(profile,year,asOf,endNav,source){
    if(profile?.method===LINKED)return calculateLinked(profile,year,asOf,endNav,source);
    if(profile?.automaticFlowsAfter!=null){
      const inputs=automaticInputs(profile,year,asOf,source,profile.automaticFlowsAfter);
      if(!inputs.ok)return inputs;
      return {...calculate(inputs.profile,year,asOf,endNav),automaticFlowsAfter:profile.automaticFlowsAfter,
        autoFlowCount:inputs.flows.length,foreignFlows:inputs.foreignFlows};
    }
    const errors=validate(profile,year);
    const first=day(profile?.openingAsOf),last=day(asOf),end=number(endNav);
    if(!Number.isFinite(last)||asOf.slice(0,4)!==String(year)||!(last>first))errors.push('Valuation date must be within the selected year.');
    if(!Number.isFinite(end))errors.push('Current NAV is unavailable.');
    if(errors.length)return {ok:false,errors:[...new Set(errors)]};
    const flows=profile.externalFlows.filter(f=>f.date<=asOf);
    let netFlows=0,weightedFlows=0,deposits=0,withdrawals=0;
    for(const f of flows){
      const value=number(f.amount);netFlows+=value;
      weightedFlows+=value*(last-day(f.date))/(last-first);
      if(value>0)deposits+=value;else withdrawals-=value;
    }
    const opening=number(profile.openingNav),profit=end-opening-netFlows,denominator=opening+weightedFlows;
    return {ok:true,currency:profile.currency,asOf,openingAsOf:profile.openingAsOf,openingNav:opening,endNav:end,
      netFlows,deposits,withdrawals,weightedFlows,profit,denominator,
      returnPct:denominator>0?profit/denominator*100:null,
      returnUnavailable:denominator>0?'':'Return unavailable: day-weighted invested capital is zero or negative.',
      reviewedThrough:profile.flowsCompleteThrough,staleFlows:profile.flowsCompleteThrough<asOf};
  }
  function automaticInputs(profile,year,asOf,source,cutoff){
    source=source||{};
    const errors=validate(profile,year);
    if(!Number.isFinite(day(asOf))||asOf.slice(0,4)!==String(year))errors.push('Valuation date must be within the selected year.');
    if(!Number.isFinite(day(cutoff)))errors.push('Choose a valid automatic-flow cutoff.');
    if(!Array.isArray(source.transactions)||!source.accountId)errors.push('Automatic continuation needs this portfolio’s transaction records.');
    if(errors.length)return {ok:false,errors:[...new Set(errors)]};
    const flows=[],rates=source.rates||{};let foreignFlows=false;
    for(const t of source.transactions){
      if(!t||typeof t!=='object'){errors.push('A transaction record is invalid.');continue;}
      if(t.accountId!==source.accountId||!['Deposit','Withdrawal'].includes(t.type))continue;
      if(!Number.isFinite(day(t.date))){errors.push('A deposit or withdrawal has an invalid date.');continue;}
      if(t.date<=cutoff||t.date>asOf)continue;
      const amount=number(t.amount),from=number(rates[t.currency]),to=number(rates[profile.currency]);
      const rate=t.currency===profile.currency?1:from>0&&to>0?from/to:NaN;
      if(!t.id||!Number.isFinite(amount)||amount<0||!(rate>0)||!Number.isFinite(rate)){
        errors.push('A later deposit or withdrawal needs a valid reference, nonnegative amount and available currency rate.');continue;
      }
      const transfer=profile.autoFlowTransfers?.[t.id]||{};
      foreignFlows=foreignFlows||t.currency!==profile.currency;
      flows.push({id:'transaction:'+t.id,transactionId:t.id,date:t.date,amount:amount*rate*(t.type==='Deposit'?1:-1),
        note:'Automatic '+t.type,counterpartyId:transfer.counterpartyId||null,transferId:transfer.transferId||null});
    }
    const normalized={...profile,method:METHOD,externalFlows:[...profile.externalFlows,...flows],flowsCompleteThrough:asOf};
    delete normalized.automaticFlowsAfter;
    errors.push(...validate(normalized,year));
    if(errors.length)return {ok:false,errors:[...new Set(errors)]};
    return {ok:true,profile:normalized,flows,foreignFlows};
  }
  function linkedInputs(profile,year,asOf,appEndNav,source){
    const errors=validate(profile,year),a=profile?.anchor;
    if(profile?.method!==LINKED)errors.push('Automatic continuation requires a brokerage return anchor.');
    if(!Number.isFinite(day(asOf))||asOf.slice(0,4)!==String(year)||asOf<a?.date)errors.push('The valuation must be on or after the return anchor in the selected year.');
    if(!Number.isFinite(number(appEndNav)))errors.push('Current app NAV is unavailable.');
    if(errors.length)return {ok:false,errors:[...new Set(errors)]};
    const inputs=automaticInputs(profile,year,asOf,source,a.date);
    if(!inputs.ok)return inputs;
    const adjustment=number(a.nav)-number(a.appNav);
    // Preserve the one-time NAV difference in performance only. Accounting state is never adjusted.
    const endNav=asOf===a.date?number(a.nav):number(appEndNav)+adjustment;
    return {...inputs,endNav,adjustment};
  }
  function calculateLinked(profile,year,asOf,appEndNav,source){
    const inputs=linkedInputs(profile,year,asOf,appEndNav,source);
    if(!inputs.ok)return inputs;
    const base=calculate(inputs.profile,year,asOf,inputs.endNav),a=profile.anchor;
    if(!base.ok)return base;
    const net=inputs.flows.reduce((sum,f)=>sum+number(f.amount),0),days=day(asOf)-day(a.date);
    const weighted=days>0?inputs.flows.reduce((sum,f)=>sum+number(f.amount)*(day(asOf)-day(f.date))/days,0):0;
    const periodProfit=inputs.endNav-number(a.nav)-net,denominator=number(a.nav)+weighted;
    const periodReturn=days===0?0:denominator>0?periodProfit/denominator:null;
    const returnPct=periodReturn===null?null:((1+number(a.returnPct)/100)*(1+periodReturn)-1)*100;
    return {...base,method:LINKED,returnPct,anchorDate:a.date,anchorReturnPct:number(a.returnPct),anchorNav:number(a.nav),
      appAnchorNav:number(a.appNav),rawAppNav:number(appEndNav),navAdjustment:inputs.adjustment,
      periodProfit,periodReturnPct:periodReturn===null?null:periodReturn*100,periodDenominator:denominator,
      autoFlowCount:inputs.flows.length,foreignFlows:inputs.foreignFlows,
      returnUnavailable:periodReturn===null?'Return unavailable: day-weighted capital after the anchor is zero or negative.':''};
  }
  function aggregate(records,year,asOf){
    if(!records.length)return {ok:false,errors:['No enabled portfolios.']};
    const errors=[];
    const linkedCount=records.filter(r=>r.profile?.method===LINKED).length;
    const automaticCount=records.filter(r=>r.profile?.automaticFlowsAfter!=null).length;
    const rawAppNav=records.reduce((sum,r)=>sum+number(r.endNav),0);
    records=records.map(r=>{
      const linked=r.profile?.method===LINKED;
      if(!linked&&r.profile?.automaticFlowsAfter==null)return r;
      const inputs=linked?linkedInputs(r.profile,year,asOf,r.endNav,r.source):automaticInputs(r.profile,year,asOf,r.source,r.profile.automaticFlowsAfter);
      if(!inputs.ok){errors.push(...inputs.errors);return r;}
      return {...r,profile:inputs.profile,endNav:linked?inputs.endNav:r.endNav};
    });
    for(const r of records)errors.push(...validate(r.profile,year));
    if(errors.length)return {ok:false,errors:[...new Set(errors)]};
    const currencies=new Set(records.map(r=>r.profile.currency));
    if(currencies.size!==1)errors.push('Enabled portfolios must use the same reporting currency for an aggregate YTD return.');
    if(new Set(records.map(r=>r.id)).size!==records.length)errors.push('A portfolio may be included only once.');
    if(errors.length)return {ok:false,errors:[...new Set(errors)]};
    const ids=new Set(records.map(r=>r.id)),pairs=new Map(),external=[];
    for(const r of records){
      for(const flow of r.profile.externalFlows.filter(f=>f.date<=asOf)){
        if(flow.counterpartyId&&ids.has(flow.counterpartyId)){
          const key=String(flow.transferId||'');
          if(!pairs.has(key))pairs.set(key,[]);
          pairs.get(key).push({owner:r.id,flow});
        }else external.push({...flow,id:`${r.id}:${flow.id}`});
      }
    }
    for(const pair of pairs.values()){
      const [a,b]=pair;
      if(pair.length!==2||a.owner===b.owner||a.flow.counterpartyId!==b.owner||b.flow.counterpartyId!==a.owner||
        a.flow.date!==b.flow.date||Math.abs(number(a.flow.amount)+number(b.flow.amount))>0.005){
        errors.push('An internal transfer is unmatched, crosses dates, or has unequal amounts. Review both sides before calculating the aggregate.');
      }
    }
    if(errors.length)return {ok:false,errors:[...new Set(errors)]};
    const profile={version:1,method:METHOD,currency:records[0].profile.currency,openingAsOf:`${Number(year)-1}-12-31`,
      openingNav:records.reduce((s,r)=>s+number(r.profile.openingNav),0),externalFlows:external,
      flowsCompleteThrough:records.map(r=>r.profile.flowsCompleteThrough).sort()[0]};
    const endNav=records.reduce((s,r)=>s+number(r.endNav),0);
    return {...calculate(profile,year,asOf,endNav),internalTransferPairs:pairs.size,linkedCount,automaticCount,rawAppNav,navAdjustment:endNav-rawAppNav};
  }
  const api={validate,calculate,aggregate,linkedInputs,automaticInputs};
  root.PortfolioYtdAnchor=api;
  if(typeof document==='undefined')return;

  const byId=id=>document.getElementById(id);
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const yearNow=()=>today().slice(0,4);
  const getState=()=>typeof state==='undefined'?null:state;
  const account=id=>getState()?.accounts?.find(a=>a.id===id);
  const enabled=(id,year=yearNow())=>{const p=account(id)?.performanceProfiles?.[year];return p?.enabled===true?p:null;};
  const fmt=(n,c)=>new Intl.NumberFormat('en-HK',{style:'currency',currency:c,maximumFractionDigits:2}).format(n);
  const percent=n=>n==null?'—':`${n>=0?'+':''}${n.toFixed(2)}%`;
  const signMoney=(n,c)=>`${n>=0?'+':''}${fmt(n,c)}`;
  let editAccountId=null,portfolioSequence=0;
  const benchmarkCache=new Map();

  function currentNav(id,currency){
    const fx=getState()?.settings?.fx||{},from=typeof displayCurrency==='string'?displayCurrency:'HKD';
    if(!Object.hasOwn(fx,from)||!Object.hasOwn(fx,currency))return NaN;
    const a=number(typeof fxToHKD==='function'?fxToHKD(from):fx[from]),b=number(typeof fxToHKD==='function'?fxToHKD(currency):fx[currency]);
    if(!(a>0&&b>0))return NaN;
    return summaryFor(id).net*a/b;
  }
  function resultFor(id,asOf=today()){
    const year=asOf.slice(0,4),p=enabled(id,year);
    if(!p)return null;
    const endpoint=endpointFor(id,p,asOf);
    return {...calculate(p,year,endpoint.asOf,endpoint.nav,flowSource(id)),navSource:p.navSource||'app'};
  }
  function flowSource(id){
    const s=getState(),currencies=new Set([...(Object.keys(s?.settings?.fx||{})),...(s?.transactions||[]).map(t=>t.currency)]),rates={};
    for(const currency of currencies)rates[currency]=number(typeof fxToHKD==='function'&&Object.hasOwn(s.settings.fx,currency)?fxToHKD(currency):s?.settings?.fx?.[currency]);
    return {accountId:id,transactions:s?.transactions||[],rates};
  }
  function endpointFor(id,p,asOf=today()){
    if(p.navSource==='snapshot')return {asOf:p.navSnapshot?.date||'',nav:p.navSnapshot?.date<=asOf?number(p.navSnapshot.amount):NaN};
    return {asOf,nav:currentNav(id,p.currency)};
  }
  api.profile=enabled;api.resultFor=resultFor;

  const style=document.createElement('style');
  style.textContent=`
    .ytd-snapshot{width:100%;padding:8px 2px}.ytd-snapshot dl{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:13px 16px;margin:8px 0}
    .ytd-snapshot dt{color:var(--muted);font-size:13px}.ytd-snapshot dd{margin:0;text-align:right;font-weight:650;font-size:14px}
    .ytd-explanation{font-size:12px;line-height:1.5;color:var(--muted);margin-top:14px}.ytd-editor{max-width:760px}
    .ytd-editor input[type=checkbox]{width:auto;margin-right:8px}.ytd-flow{border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0}
    .ytd-flow-main,.ytd-flow-transfer{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ytd-flow label{min-width:0}
    .ytd-flow .ytd-remove{margin-top:5px}.ytd-form-note{font-size:12px;line-height:1.5;color:var(--muted);margin:10px 0}
    .ytd-error{color:var(--negative);font-size:13px;white-space:pre-line;margin:10px 0}.ytd-fingerprint{font-size:11px;color:var(--muted);overflow-wrap:anywhere;margin-top:12px}
    @media(max-width:480px){.ytd-flow-main,.ytd-flow-transfer{grid-template-columns:1fr}.ytd-snapshot dl{gap:12px 8px}.ytd-snapshot dd{font-size:13px}}
  `;
  document.head.appendChild(style);

  function snapshotHtml(r){
    if(!r?.ok)return `<div class="ytd-snapshot"><strong>YTD anchor needs attention</strong><div class="ytd-error">${escape(r?.errors?.join('\n')||'NAV unavailable.')}</div><p class="ytd-explanation">The recorded transaction calculation is unchanged. An enabled but incomplete anchor is not replaced with a tracked-period estimate.</p></div>`;
    const linked=r.method===LINKED;
    const aligned=linked||Math.abs(r.navAdjustment||0)>0.005;
    const rows=[['Opening NAV · '+r.openingAsOf,fmt(r.openingNav,r.currency)],[(aligned?'Performance NAV · ':r.navSource==='snapshot'?'Brokerage NAV snapshot · ':'Current NAV · ')+r.asOf,fmt(r.endNav,r.currency)],
      ['External contributions',fmt(r.deposits,r.currency)],['External withdrawals',fmt(r.withdrawals,r.currency)],['YTD investment P/L',signMoney(r.profit,r.currency)]];
    if(aligned&&!linked)rows.splice(1,0,['NAV before performance alignment',fmt(r.rawAppNav,r.currency)],['Saved performance alignment',signMoney(r.navAdjustment,r.currency)]);
    if(linked)rows.push(['Brokerage YTD anchor · '+r.anchorDate,percent(r.anchorReturnPct)],['Return since anchor · estimate',percent(r.periodReturnPct)],['NAV alignment · performance only',signMoney(r.navAdjustment,r.currency)]);
    const explanation=linked?`${r.returnUnavailable||'Brokerage YTD is compounded with a Modified Dietz estimate since the anchor. This is an app estimate, not an exact brokerage TWR.'} ${r.autoFlowCount} later deposit/withdrawal records included automatically. ${r.foreignFlows?'Foreign-currency flows use current saved/live FX. ':''}Prices, recorded trades and later flows update the estimate without new statements.`:
      `${r.returnUnavailable||'Modified Dietz return: investment P/L divided by opening NAV plus day-weighted external flows. Not annualized; not exact TWR.'} No daily history is drawn from missing trades. ${r.automaticFlowsAfter?`Historical flows reviewed through ${r.automaticFlowsAfter}; ${r.autoFlowCount} later deposit/withdrawal records included automatically.${r.foreignFlows?' Foreign-currency flows use current saved/live FX.':''}`:`Flow list reviewed through ${r.reviewedThrough}.${r.staleFlows?' Add any later external flows before relying on this result.':''}`}`;
    return `<div class="ytd-snapshot"><div class="ytd-result-head"><div><span>YTD investment P/L</span><strong class="${r.profit<0?'negative':'positive'}">${escape(signMoney(r.profit,r.currency))}</strong></div><div><span>${linked?'Broker-linked estimate':'Modified Dietz estimate'}</span><strong>${escape(r.asOf)}</strong></div></div>
      <div class="ytd-period-note">${escape(r.openingAsOf)} → ${escape(r.asOf)} · No reconstructed daily curve</div>
      <details class="summary-disclosure ytd-calculation"><summary>Calculation details</summary><dl>${rows.map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')}</dl><div class="ytd-explanation">${escape(explanation)}</div></details></div>`;
  }
  function methodNote(r){
    if(!r?.ok)return 'Correct this portfolio’s YTD settings to show its anchored return.';
    if(r.method===LINKED)return `Brokerage return through ${r.anchorDate}; automatic app estimate after that date in ${r.currency}. Only later Deposit / Withdrawal records are treated as external flows. Trades, retained dividends, fees and FX exchanges affect NAV instead. The saved NAV alignment changes performance only. Missing/stale prices, FX and unrecorded fees or interest can cause differences from the brokerage. No recurring statement upload is required.`;
    return `YTD uses this portfolio’s optional opening NAV and separate external-flow list in ${r.currency}. ${r.automaticFlowsAfter?`Only Deposit / Withdrawal transactions dated after ${r.automaticFlowsAfter} are added automatically; earlier initialization records are excluded.`:'Existing Deposit / Withdrawal transactions are not added to that list.'} ${r.navSource==='snapshot'?'Closing NAV is a dated brokerage snapshot and remains fixed until updated.':'Current NAV uses the existing holdings, cash and saved/live FX.'} Brokerage-accurate NAV and complete flows are required. Fees, tax, dividends and interest retained in the account are reflected in NAV and are not deducted again. Large flows and volatile returns can reduce Modified Dietz accuracy.`;
  }
  function legendHtml(r,bench={}){
    return [{label:`Portfolio · ${r?.currency||''} ${r?.method===LINKED?'Broker-linked estimate':'Modified Dietz'}`,value:r?.ok?r.returnPct:null},
      {label:'VOO · USD total return',value:bench.VOO},{label:'QQQ · USD total return',value:bench.QQQ}].map(v=>
      `<div class="benchmark-legend-item"><span>${escape(v.label)}</span><strong class="${v.value==null?'':v.value<0?'negative':'positive'}">${percent(v.value)}</strong></div>`).join('');
  }
  async function benchmarks(year,asOf,{force=false}={}){
    const key=year+'|'+asOf,cached=benchmarkCache.get(key);
    if(!force&&cached&&Date.now()-cached.time<5*60*1000)return cached.value;
    const base='https://portfolio-tracker-quotes.vercel.app/';
    const [hr,qr]=await Promise.all([fetch(`${base}?symbols=VOO%2CQQQ&mode=history&start=${Number(year)-1}-12-15`),fetch(`${base}?symbols=VOO%2CQQQ`)]);
    if(!hr.ok||!qr.ok)throw new Error('Benchmark quotes unavailable');
    const history=(await hr.json()).history||{},quotes=(await qr.json()).quotes||{},value={};
    for(const symbol of ['VOO','QQQ']){
      const points=(history[symbol]||[]).filter(p=>p?.date&&number(p.close)>0).slice().sort((a,b)=>a.date.localeCompare(b.date));
      const start=points.filter(p=>p.date<`${year}-01-01`).at(-1),last=points.filter(p=>p.date<=asOf).at(-1);
      if(!start||!last)continue;
      const adjusted=p=>number(p.adjClose)>0?number(p.adjClose):number(p.close);
      const live=number(quotes[symbol]?.price),end=asOf===today()&&live>0?live*adjusted(last)/number(last.close):adjusted(last);
      value[symbol]=(end/adjusted(start)-1)*100;
    }
    benchmarkCache.set(key,{time:Date.now(),value});return value;
  }
  function renderPortfolio(id,period,{force=false}={}){
    if(period!=='YTD'||!enabled(id))return false;
    const activePeriod=byId('benchmarkPeriods')?.querySelector('.active')?.dataset.period;
    if(activePeriod&&activePeriod!==period)return true;
    const seq=++portfolioSequence,r=resultFor(id),chart=byId('benchmarkChart'),legend=byId('benchmarkLegend'),note=byId('benchmarkNote');
    if(chart)chart.innerHTML=snapshotHtml(r);
    if(legend)legend.innerHTML=legendHtml(r);
    if(note)note.textContent=methodNote(r)+` Benchmarks use prior year-end adjusted close and quotes up to ${r?.asOf||'the valuation date'} in USD; their currency and return methodology may differ from the portfolio.`;
    if(r?.ok)benchmarks(yearNow(),r.asOf,{force}).then(bench=>{
      if(seq!==portfolioSequence||currentPortfolioId!==id||!enabled(id)||byId('benchmarkPeriods')?.querySelector('.active')?.dataset.period!=='YTD')return;
      if(legend)legend.innerHTML=legendHtml(resultFor(id),bench);
    }).catch(()=>{if(seq===portfolioSequence&&currentPortfolioId===id&&enabled(id)&&byId('benchmarkPeriods')?.querySelector('.active')?.dataset.period==='YTD'&&note)note.textContent+=' Benchmarks are temporarily unavailable; the anchored portfolio calculation is unaffected.';});
    return true;
  }
  function activeAccounts(){
    const s=getState();return (s?.accounts||[]).filter(a=>enabled(a.id)||s.assets.some(x=>x.accountId===a.id)||s.transactions.some(t=>t.accountId===a.id)||s.fx.some(f=>f.accountId===a.id));
  }
  function overallResult(){
    const active=activeAccounts(),selected=active.filter(a=>enabled(a.id));
    if(!selected.length)return null;
    const records=selected.map(a=>({id:a.id,profile:enabled(a.id),source:flowSource(a.id),...endpointFor(a.id,enabled(a.id))}));
    const dates=new Set(records.map(r=>r.asOf));
    const r=dates.size===1?aggregate(records.map(r=>({...r,endNav:r.nav})),yearNow(),records[0].asOf):{ok:false,errors:['Use the same NAV valuation date for every enabled portfolio before calculating the aggregate.']};
    if(records.some(r=>r.profile.navSource==='snapshot'))r.navSource='snapshot';
    return {...r,activeCount:active.length,selectedCount:selected.length};
  }
  api.overallResult=overallResult;
  function renderOverall(mode,period){
    if(mode!=='performance'||period!=='YTD')return false;
    const active=activeAccounts(),selected=active.filter(a=>enabled(a.id));
    if(!selected.length)return false;
    const r=overallResult();
    const hero=byId('overallReturnHero'),sub=byId('overallReturnSub'),label=byId('overallReturnLabel'),chart=byId('overallReturnChart'),note=byId('overallReturnNote');
    if(hero){hero.textContent=r.ok?percent(r.returnPct):'—';hero.className=`overall-return-hero ${r.ok&&r.returnPct!=null?r.returnPct<0?'negative':'positive':''}`;}
    if(label)label.textContent=selected.length===active.length?'All portfolios · Anchored YTD':'Enabled portfolios only · Anchored YTD';
    if(sub)sub.textContent=`${selected.length}/${active.length} active portfolios · ${r.currency||'one common currency required'} · Modified Dietz estimate`;
    if(chart)chart.innerHTML=snapshotHtml(r);
    if(note)note.textContent=`Included: ${selected.map(a=>a.name).join(', ')}. ${r.linkedCount||r.automaticCount?'Group return is a whole-year Modified Dietz estimate from combined NAV and flows; individual portfolio percentages are not averaged. Later flows from automatic profiles are read from their transactions. ':methodNote(r)+' '}Saved performance alignment affects Performance NAV only; Value keeps the existing accounting NAV. Internal transfers are removed only when both enabled portfolios have matching dated transfer entries. Portfolios without a profile are excluded from this anchored subtotal; their own calculations remain unchanged.`;
    return true;
  }
  api.renderPortfolio=renderPortfolio;api.renderOverall=renderOverall;

  function addFlow(flow={},container='ytdFlows'){
    const row=document.createElement('div');row.className='ytd-flow';row.dataset.flowId=flow.id||'flow_'+crypto.getRandomValues(new Uint32Array(2)).join('_');
    const others=getState().accounts.filter(a=>a.id!==editAccountId);
    row.innerHTML=`<div class="ytd-flow-main"><label>Date<input class="ytd-date" type="date" value="${escape(flow.date||'')}"/></label>
      <label>Amount · + contribution / − withdrawal<input class="ytd-amount" type="number" step="any" value="${escape(flow.amount??'')}"/></label></div>
      <label>Note<input class="ytd-note" maxlength="200" value="${escape(flow.note||'')}"/></label>
      <div class="ytd-flow-transfer"><label>Other portfolio · optional<select class="ytd-counterparty"><option value="">Outside this portfolio group</option>${others.map(a=>`<option value="${escape(a.id)}" ${flow.counterpartyId===a.id?'selected':''}>${escape(a.name)}</option>`).join('')}</select></label>
      <label>Shared transfer reference<input class="ytd-transfer" maxlength="80" value="${escape(flow.transferId||'')}" placeholder="Same reference on both sides"/></label></div>
      <button type="button" class="ghost-btn ytd-remove">Remove flow</button>`;
    if(flow.transactionId){
      row.dataset.transactionId=flow.transactionId;
      for(const input of row.querySelectorAll('.ytd-date,.ytd-amount,.ytd-note'))input.disabled=true;
      row.querySelector('.ytd-remove').remove();
    }else row.querySelector('.ytd-remove').addEventListener('click',()=>row.remove());
    byId(container).appendChild(row);
  }
  function loadEditor(){
    const year=byId('ytdYear').value,p=account(editAccountId)?.performanceProfiles?.[year];
    byId('ytdEnabled').checked=p?.enabled===true;
    byId('ytdMethod').value=p?.method||METHOD;
    byId('ytdOpening').value=p?.openingNav??'';
    const select=byId('ytdCurrency');select.innerHTML=Object.keys(getState().settings.fx).filter(c=>/^[A-Z]{3}$/.test(c)).map(c=>`<option>${escape(c)}</option>`).join('');
    if(p?.currency&&!Array.from(select.options).some(o=>o.value===p.currency))select.add(new Option(p.currency,p.currency));
    select.value=p?.currency||getState().settings.baseCurrency||'HKD';
    byId('ytdNavSource').value=p?.navSource||'app';byId('ytdNavDate').value=p?.navSnapshot?.date||today();byId('ytdNavAmount').value=p?.navSnapshot?.amount??'';updateNavInputs();
    byId('ytdReviewed').value=p?.flowsCompleteThrough||(year===yearNow()?today():`${year}-12-31`);
    byId('ytdSource').value=p?.source||'';byId('ytdFlows').innerHTML='';byId('ytdError').textContent='';
    byId('ytdAnchorDate').value=p?.anchor?.date||p?.navSnapshot?.date||today();
    byId('ytdAnchorReturn').value=p?.anchor?.returnPct??'';
    byId('ytdAnchorNav').value=p?.anchor?.nav??p?.navSnapshot?.amount??'';
    byId('ytdAppAnchorNav').value=p?.anchor?.appNav??'';
    byId('ytdAutomaticEnabled').checked=p?.automaticFlowsAfter!=null;
    byId('ytdAutomaticAfter').value=p?.automaticFlowsAfter||p?.flowsCompleteThrough||today();
    byId('ytdAutoFlows').innerHTML='';
    for(const f of p?.externalFlows||[])addFlow(f);
    updateMethodInputs();
  }
  function openEditor(){
    if(!currentPortfolioId)return;
    editAccountId=currentPortfolioId;byId('ytdAccountName').textContent=account(editAccountId)?.name||'Portfolio';byId('ytdYear').value=yearNow();loadEditor();openModal('ytdModal');
  }
  function updateNavInputs(){byId('ytdSnapshotInputs').classList.toggle('hidden',byId('ytdNavSource').value!=='snapshot');}
  function automaticTransferNotes(){
    return Object.fromEntries(Array.from(byId('ytdAutoFlows').children).filter(row=>row.dataset.transactionId).map(row=>[row.dataset.transactionId,
      {counterpartyId:row.querySelector('.ytd-counterparty').value||null,transferId:row.querySelector('.ytd-transfer').value.trim()||null}]));
  }
  function updateMethodInputs(){
    const linked=byId('ytdMethod').value===LINKED;
    const automatic=linked||byId('ytdAutomaticEnabled').checked;
    byId('ytdLinkedInputs').classList.toggle('hidden',!linked);byId('ytdNavSettings').classList.toggle('hidden',linked);
    byId('ytdAutomaticSettings').classList.toggle('hidden',linked);
    byId('ytdAutomaticDate').classList.toggle('hidden',!byId('ytdAutomaticEnabled').checked);
    byId('ytdAutoSection').classList.toggle('hidden',!automatic);
    byId('ytdFlowHeading').textContent=automatic?'Historical external flows through the cutoff':'External flows for the whole year';
    byId('ytdFlowHelp').textContent=automatic?'Enter historical external flows only through the selected cutoff date, in the reporting currency. After that date, existing and new Deposit / Withdrawal records are read automatically. Do not enter later flows twice.':'Enter every contribution and withdrawal in the reporting currency, using its value on the flow date. This list replaces transaction-based flows for anchored YTD only. Do not include stock trades, retained dividends, fees, interest or currency exchanges. No transactions are imported or edited.';
    byId('ytdCaptureNav').disabled=byId('ytdAnchorDate').value!==today();
    if(linked)byId('ytdNavSource').value='app';
    if(automatic)updateAutomaticPreview();
  }
  function updateAutomaticPreview(){
    const notes={...(account(editAccountId)?.performanceProfiles?.[byId('ytdYear').value]?.autoFlowTransfers||{}),...automaticTransferNotes()};
    const linked=byId('ytdMethod').value===LINKED;
    const currency=byId('ytdCurrency').value,date=byId(linked?'ytdAnchorDate':'ytdAutomaticAfter').value;
    const p={version:1,method:METHOD,currency,openingAsOf:`${Number(byId('ytdYear').value)-1}-12-31`,openingNav:0,externalFlows:[],flowsCompleteThrough:date<`${byId('ytdYear').value}-01-01`?`${byId('ytdYear').value}-01-01`:date,
      automaticFlowsAfter:date,autoFlowTransfers:notes};
    const inputs=automaticInputs(p,byId('ytdYear').value,today(),flowSource(editAccountId),date);
    byId('ytdAutoFlows').innerHTML='';
    if(inputs.ok)for(const flow of inputs.flows)addFlow(flow,'ytdAutoFlows');
    byId('ytdAutoNote').textContent=inputs.ok?`${inputs.flows.length} later cash-flow records found. New records are included automatically; only transfer matching notes below are saved here.`:'Select a valid cutoff date to preview later cash flows.';
    const nav=currentNav(editAccountId,currency);
    byId('ytdCurrentNav').textContent=Number.isFinite(nav)?`Current app NAV · ${today()}: ${fmt(nav,currency)}. A past anchor needs the app NAV at that same past close; today’s NAV must not be used for it.`:'Current app NAV unavailable.';
  }
  function saveEditor(){
    const a=account(editAccountId),year=byId('ytdYear').value;if(!a)return;
    const previous=a.performanceProfiles,existing=previous?.[year],isEnabled=byId('ytdEnabled').checked;
    if(!/^\d{4}$/.test(year)){byId('ytdError').textContent='Choose a valid year.';return;}
    if(!isEnabled&&!existing){closeModal('ytdModal');return;}
    const profile=isEnabled?{version:1,enabled:true,method:byId('ytdMethod').value,openingAsOf:`${Number(year)-1}-12-31`,currency:byId('ytdCurrency').value,
      openingNav:number(byId('ytdOpening').value),flowsCompleteThrough:byId('ytdReviewed').value,source:byId('ytdSource').value.trim(),
      navSource:byId('ytdNavSource').value,navSnapshot:byId('ytdNavSource').value==='snapshot'?{date:byId('ytdNavDate').value,amount:number(byId('ytdNavAmount').value)}:null,
      externalFlows:Array.from(byId('ytdFlows').children).map(row=>({id:row.dataset.flowId,date:row.querySelector('.ytd-date').value,amount:number(row.querySelector('.ytd-amount').value),
        note:row.querySelector('.ytd-note').value.trim(),counterpartyId:row.querySelector('.ytd-counterparty').value||null,transferId:row.querySelector('.ytd-transfer').value.trim()||null}))}: {...existing,enabled:false};
    if(isEnabled&&profile.method===LINKED){
      profile.navSource='app';profile.navSnapshot=null;
      profile.anchor={date:byId('ytdAnchorDate').value,nav:number(byId('ytdAnchorNav').value),returnPct:number(byId('ytdAnchorReturn').value),
        appNav:byId('ytdAppAnchorNav').value.trim()===''?number(byId('ytdAnchorNav').value):number(byId('ytdAppAnchorNav').value)};
      profile.autoFlowTransfers=automaticTransferNotes();
    }
    if(isEnabled&&profile.method===METHOD&&byId('ytdAutomaticEnabled').checked){
      profile.automaticFlowsAfter=byId('ytdAutomaticAfter').value;
      profile.autoFlowTransfers=automaticTransferNotes();
    }
    const errors=isEnabled?validate(profile,year):[];
    if(isEnabled&&profile.externalFlows.some(f=>f.date>today()))errors.push('Future external flows cannot be included as actuals.');
    if(isEnabled&&profile.flowsCompleteThrough>today())errors.push('Flow review date cannot be in the future.');
    if(isEnabled&&profile.navSource==='snapshot'&&profile.navSnapshot.date>today())errors.push('NAV valuation date cannot be in the future.');
    if(isEnabled&&profile.externalFlows.some(f=>f.date>profile.flowsCompleteThrough))errors.push('Flow review date must cover every entered flow.');
    if(isEnabled&&profile.method===LINKED){
      const inputs=linkedInputs(profile,year,today(),currentNav(a.id,profile.currency),flowSource(a.id));
      if(!inputs.ok)errors.push(...inputs.errors);
    }
    if(isEnabled&&profile.automaticFlowsAfter!=null){
      if(profile.automaticFlowsAfter>today())errors.push('Automatic-flow cutoff cannot be in the future.');
      const inputs=automaticInputs(profile,year,today(),flowSource(a.id),profile.automaticFlowsAfter);
      if(!inputs.ok)errors.push(...inputs.errors);
    }
    if(errors.length){byId('ytdError').textContent=[...new Set(errors)].join('\n');return;}
    try{
      localStorage.setItem('portfolioTrackerYtdProfileSafetyV1',JSON.stringify({savedAt:new Date().toISOString(),accountId:a.id,year,previousProfile:existing||null}));
      a.performanceProfiles={...(previous||{}),[year]:profile};save();
    }catch(err){if(previous===undefined)delete a.performanceProfiles;else a.performanceProfiles=previous;byId('ytdError').textContent='Could not save the profile. No portfolio changes were kept.';return;}
    closeModal('ytdModal');renderAll();
    if(currentPortfolioId&&document.querySelector('#tab-performance.active'))root.renderBenchmark?.({force:false});
    toast(isEnabled?'YTD profile enabled for this portfolio and year.':'YTD profile disabled. Recorded-transaction performance restored.');
  }
  async function fingerprint(){
    const el=byId('ytdSyncFingerprint');if(!el)return;
    try{
      const key=(localStorage.getItem('portfolioTrackerSyncKeyV1')||'').trim();
      if(!key){el.textContent='Sync document fingerprint: not connected';return;}
      const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('portfolio-sync-id:'+key)));
      const value=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
      if((localStorage.getItem('portfolioTrackerSyncKeyV1')||'').trim()!==key)return;
      el.textContent=`Sync document fingerprint: ${value.slice(0,16)}. Matching fingerprints share the same encrypted state; different fingerprints identify separate documents.`;
    }catch{el.textContent='Sync document fingerprint unavailable on this device.';}
  }
  function install(){
    const actions=document.querySelector('#tab-performance > .section-head');
    if(actions&&!byId('ytdSettingsBtn')){
      const btn=document.createElement('button');btn.id='ytdSettingsBtn';btn.className='icon-text-btn';btn.type='button';btn.textContent='YTD settings';btn.addEventListener('click',openEditor);actions.appendChild(btn);
    }
    if(!byId('ytdModal')){
      const modal=document.createElement('div');modal.id='ytdModal';modal.className='modal-overlay hidden';
      modal.innerHTML=`<div class="modal-wrap"><form class="modal-card ytd-editor" onsubmit="return false;">
        <div class="section-head"><h3>Optional YTD performance</h3><button type="button" id="ytdClose" class="icon-btn">×</button></div>
        <p id="ytdAccountName"></p><label>Year<input id="ytdYear" type="number" min="1000" max="9999" step="1"/></label>
        <label><input id="ytdEnabled" type="checkbox"/>Enable only for this portfolio and year</label>
        <label>Calculation<select id="ytdMethod"><option value="modified-dietz">Opening NAV · Modified Dietz</option><option value="broker-linked-estimate">Brokerage YTD anchor · automatic continuation</option></select></label>
        <div class="ytd-form-note">Opening NAV means net assets at the prior year end, including cash and margin liabilities. This setting changes YTD performance only.</div>
        <label>Reporting currency<select id="ytdCurrency"></select></label><label>Opening NAV<input id="ytdOpening" type="number" step="any" min="0"/></label>
        <div id="ytdLinkedInputs" class="hidden">
          <label>Brokerage return anchor · closing date<input id="ytdAnchorDate" type="date"/></label>
          <label>Brokerage YTD return through that close · %<input id="ytdAnchorReturn" type="number" step="any" min="-100"/></label>
          <label>Brokerage NAV at that close · reporting currency<input id="ytdAnchorNav" type="number" step="any"/></label>
          <label>App NAV at the same close · optional<input id="ytdAppAnchorNav" type="number" step="any" placeholder="Leave blank if app and brokerage NAV agree"/></label>
          <p class="ytd-form-note">When different, the saved app NAV aligns the starting point for performance only. It never changes cash or holdings. Leave blank to use the brokerage NAV as the app starting NAV.</p>
          <p id="ytdCurrentNav" class="ytd-form-note"></p><button type="button" id="ytdCaptureNav" class="ghost-btn full">Use current app NAV · today’s anchor only</button>
          <p class="ytd-form-note">The anchor represents a close with all same-day activity included. Continue from the next day. Later return is estimated with Modified Dietz and compounded with the brokerage YTD return. Stocks and FX follow existing price updates; options still need current prices. No recurring statements are required.</p>
        </div>
        <div id="ytdNavSettings">
        <label>Closing NAV source<select id="ytdNavSource"><option value="app">Current app NAV</option><option value="snapshot">Dated brokerage NAV snapshot</option></select></label>
        <div id="ytdSnapshotInputs" class="hidden"><label>NAV valuation date<input id="ytdNavDate" type="date"/></label><label>Brokerage net assets · reporting currency<input id="ytdNavAmount" type="number" step="any"/></label><p class="ytd-form-note">This performance-only NAV stays fixed at the stated date until updated. It does not change cash, holdings or transactions.</p></div>
        </div>
        <div id="ytdAutomaticSettings"><label><input id="ytdAutomaticEnabled" type="checkbox"/>Read later deposits / withdrawals automatically</label>
          <label id="ytdAutomaticDate" class="hidden">Historical flow list complete through<input id="ytdAutomaticAfter" type="date"/></label>
          <p class="ytd-form-note">Optional: maintain the separate historical flow list through this date. Only later Deposit / Withdrawal records count automatically. Current NAV and the whole-year Modified Dietz formula are unchanged.</p>
        </div>
        <label>Source / reconciliation note<input id="ytdSource" maxlength="300"/></label>
        <h4 id="ytdFlowHeading">External flows for the whole year</h4><p id="ytdFlowHelp" class="ytd-form-note"></p>
        <div id="ytdFlows"></div><button id="ytdAddFlow" type="button" class="ghost-btn full">Add external flow</button>
        <div id="ytdAutoSection" class="hidden"><h4>Automatic flows after the cutoff</h4><p id="ytdAutoNote" class="ytd-form-note"></p><div id="ytdAutoFlows"></div></div>
        <p class="ytd-form-note">For transfers between portfolios, enter equal opposite amounts, the other portfolio and the same transfer reference on both sides. Cross-date or unmatched transfers block the anchored group return.</p>
        <label>Flow list reviewed through<input id="ytdReviewed" type="date"/></label>
        <div id="ytdError" class="ytd-error" role="alert"></div><button id="ytdSave" type="button" class="primary-btn full">Save YTD settings</button>
        <p class="ytd-form-note">Returns after an anchor are estimates, not exact TWR. Overall YTD uses combined NAV and dated external flows for a Modified Dietz estimate; it never averages brokerage percentages. Saving follows this device’s normal Cloud Sync.</p>
      </form></div>`;
      document.body.appendChild(modal);byId('ytdClose').addEventListener('click',()=>closeModal('ytdModal'));modal.addEventListener('click',e=>{if(e.target===modal)closeModal('ytdModal');});
      byId('ytdYear').addEventListener('change',loadEditor);byId('ytdAddFlow').addEventListener('click',()=>addFlow());byId('ytdSave').addEventListener('click',saveEditor);
      byId('ytdNavSource').addEventListener('change',updateNavInputs);
      byId('ytdMethod').addEventListener('change',updateMethodInputs);
      byId('ytdAnchorDate').addEventListener('change',updateMethodInputs);
      byId('ytdAutomaticEnabled').addEventListener('change',updateMethodInputs);
      byId('ytdAutomaticAfter').addEventListener('change',updateMethodInputs);
      byId('ytdCurrency').addEventListener('change',()=>{if(byId('ytdMethod').value===LINKED||byId('ytdAutomaticEnabled').checked)updateAutomaticPreview();});
      byId('ytdCaptureNav').addEventListener('click',()=>{
        if(byId('ytdAnchorDate').value!==today())return;
        const nav=currentNav(editAccountId,byId('ytdCurrency').value);if(Number.isFinite(nav))byId('ytdAppAnchorNav').value=nav;
      });
    }
    const sync=document.querySelector('#syncModal .modal-card');
    if(sync&&!byId('ytdSyncFingerprint')){const el=document.createElement('div');el.id='ytdSyncFingerprint';el.className='ytd-fingerprint';sync.appendChild(el);fingerprint();}
  }
  api.install=install;install();
  document.addEventListener('click',e=>{if(e.target.closest?.('#cloudSyncBtn,#connectSyncBtn,#createSyncBtn,#disconnectSyncBtn'))setTimeout(()=>{install();fingerprint();},1000);});
})(typeof window==='undefined'?globalThis:window);
