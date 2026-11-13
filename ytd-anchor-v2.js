/* Optional, portfolio-owned performance state. Never changes transaction accounting. */
(function(root){
  'use strict';
  const DAY=86400000;
  const METHOD='modified-dietz';
  function number(value){return value===null||value===undefined||String(value).trim()===''?NaN:Number(value);}
  function day(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return NaN;
    const t=Date.parse(value+'T00:00:00Z');
    return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value?t/DAY:NaN;
  }
  function validate(profile,year){
    const errors=[];
    if(!/^\d{4}$/.test(String(year)))errors.push('Choose a valid year.');
    if(!profile||profile.version!==1||profile.method!==METHOD)errors.push('Unsupported YTD profile format.');
    if(errors.length)return errors;
    if(profile.openingAsOf!==`${Number(year)-1}-12-31`)errors.push('Opening NAV must be the prior year-end net assets.');
    if(!Number.isFinite(number(profile.openingNav))||number(profile.openingNav)<0)errors.push('Opening NAV must be a number of zero or more.');
    if(!/^[A-Z]{3}$/.test(profile.currency||''))errors.push('Choose a reporting currency.');
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
    return [...new Set(errors)];
  }
  function calculate(profile,year,asOf,endNav){
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
  function aggregate(records,year,asOf){
    if(!records.length)return {ok:false,errors:['No enabled portfolios.']};
    const errors=[];
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
    return {...calculate(profile,year,asOf,records.reduce((s,r)=>s+number(r.endNav),0)),internalTransferPairs:pairs.size};
  }
  const api={validate,calculate,aggregate};
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
    const a=number(fx[from]),b=number(fx[currency]);
    if(!(a>0&&b>0))return NaN;
    return summaryFor(id).net*a/b;
  }
  function resultFor(id,asOf=today()){
    const year=asOf.slice(0,4),p=enabled(id,year);
    return p?calculate(p,year,asOf,currentNav(id,p.currency)):null;
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
    const rows=[['Opening NAV · '+r.openingAsOf,fmt(r.openingNav,r.currency)],['Current NAV · '+r.asOf,fmt(r.endNav,r.currency)],
      ['External contributions',fmt(r.deposits,r.currency)],['External withdrawals',fmt(r.withdrawals,r.currency)],['YTD investment P/L',signMoney(r.profit,r.currency)]];
    return `<div class="ytd-snapshot"><dl>${rows.map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')}</dl>
      <div class="ytd-explanation">${escape(r.returnUnavailable||'Modified Dietz return: investment P/L divided by opening NAV plus day-weighted external flows. Not annualized; not exact TWR.')}
      No daily history is drawn from missing trades. Flow list reviewed through ${escape(r.reviewedThrough)}.${r.staleFlows?' Add any later external flows before relying on this result.':''}</div></div>`;
  }
  function methodNote(r){
    if(!r?.ok)return 'Correct this portfolio’s YTD settings to show its anchored return.';
    return `YTD uses this portfolio’s optional opening NAV and separate external-flow list in ${r.currency}. Existing Deposit / Withdrawal transactions are not added to that list. Current NAV uses the existing holdings, cash and saved/live FX. Brokerage-accurate NAV and complete flows are required. Fees, tax, dividends and interest retained in the account are reflected in NAV and are not deducted again. Large flows and volatile returns can reduce Modified Dietz accuracy.`;
  }
  function legendHtml(r,bench={}){
    return [{label:`Portfolio · ${r?.currency||''} Modified Dietz`,value:r?.ok?r.returnPct:null},
      {label:'VOO · USD total return',value:bench.VOO},{label:'QQQ · USD total return',value:bench.QQQ}].map(v=>
      `<div class="benchmark-legend-item"><span>${escape(v.label)}</span><strong class="${v.value==null?'':v.value<0?'negative':'positive'}">${percent(v.value)}</strong></div>`).join('');
  }
  async function benchmarks(year,{force=false}={}){
    const cached=benchmarkCache.get(year);
    if(!force&&cached&&Date.now()-cached.time<5*60*1000)return cached.value;
    const base='https://portfolio-tracker-quotes.vercel.app/';
    const [hr,qr]=await Promise.all([fetch(`${base}?symbols=VOO%2CQQQ&mode=history&start=${Number(year)-1}-12-15`),fetch(`${base}?symbols=VOO%2CQQQ`)]);
    if(!hr.ok||!qr.ok)throw new Error('Benchmark quotes unavailable');
    const history=(await hr.json()).history||{},quotes=(await qr.json()).quotes||{},value={};
    for(const symbol of ['VOO','QQQ']){
      const points=(history[symbol]||[]).filter(p=>p?.date&&number(p.close)>0).slice().sort((a,b)=>a.date.localeCompare(b.date));
      const start=points.filter(p=>p.date<`${year}-01-01`).at(-1),last=points.filter(p=>p.date<=today()).at(-1);
      if(!start||!last)continue;
      const adjusted=p=>number(p.adjClose)>0?number(p.adjClose):number(p.close);
      const live=number(quotes[symbol]?.price),end=live>0?live*adjusted(last)/number(last.close):adjusted(last);
      value[symbol]=(end/adjusted(start)-1)*100;
    }
    benchmarkCache.set(year,{time:Date.now(),value});return value;
  }
  function renderPortfolio(id,period,{force=false}={}){
    if(period!=='YTD'||!enabled(id))return false;
    const activePeriod=byId('benchmarkPeriods')?.querySelector('.active')?.dataset.period;
    if(activePeriod&&activePeriod!==period)return true;
    const seq=++portfolioSequence,r=resultFor(id),chart=byId('benchmarkChart'),legend=byId('benchmarkLegend'),note=byId('benchmarkNote');
    if(chart)chart.innerHTML=snapshotHtml(r);
    if(legend)legend.innerHTML=legendHtml(r);
    if(note)note.textContent=methodNote(r)+' Benchmarks use prior year-end adjusted close and latest quotes in USD; their currency and return methodology may differ from the portfolio.';
    if(r?.ok)benchmarks(yearNow(),{force}).then(bench=>{
      if(seq!==portfolioSequence||currentPortfolioId!==id||!enabled(id)||byId('benchmarkPeriods')?.querySelector('.active')?.dataset.period!=='YTD')return;
      if(legend)legend.innerHTML=legendHtml(resultFor(id),bench);
    }).catch(()=>{if(seq===portfolioSequence&&currentPortfolioId===id&&enabled(id)&&byId('benchmarkPeriods')?.querySelector('.active')?.dataset.period==='YTD'&&note)note.textContent+=' Benchmarks are temporarily unavailable; the anchored portfolio calculation is unaffected.';});
    return true;
  }
  function activeAccounts(){
    const s=getState();return (s?.accounts||[]).filter(a=>enabled(a.id)||s.assets.some(x=>x.accountId===a.id)||s.transactions.some(t=>t.accountId===a.id)||s.fx.some(f=>f.accountId===a.id));
  }
  function renderOverall(mode,period){
    if(mode!=='performance'||period!=='YTD')return false;
    const active=activeAccounts(),selected=active.filter(a=>enabled(a.id));
    if(!selected.length)return false;
    const year=yearNow(),asOf=today(),r=aggregate(selected.map(a=>({id:a.id,profile:enabled(a.id),endNav:currentNav(a.id,enabled(a.id).currency)})),year,asOf);
    const hero=byId('overallReturnHero'),sub=byId('overallReturnSub'),label=byId('overallReturnLabel'),chart=byId('overallReturnChart'),note=byId('overallReturnNote');
    if(hero){hero.textContent=r.ok?percent(r.returnPct):'—';hero.className=`overall-return-hero ${r.ok&&r.returnPct!=null?r.returnPct<0?'negative':'positive':''}`;}
    if(label)label.textContent=selected.length===active.length?'All portfolios · Anchored YTD':'Enabled portfolios only · Anchored YTD';
    if(sub)sub.textContent=`${selected.length}/${active.length} active portfolios · ${r.currency||'one common currency required'} · Modified Dietz estimate`;
    if(chart)chart.innerHTML=snapshotHtml(r);
    if(note)note.textContent=`Included: ${selected.map(a=>a.name).join(', ')}. ${methodNote(r)} Internal transfers are removed only when both enabled portfolios have matching dated transfer entries. Portfolios without a profile are excluded from this anchored subtotal; their own calculations remain unchanged.`;
    return true;
  }
  api.renderPortfolio=renderPortfolio;api.renderOverall=renderOverall;

  function addFlow(flow={}){
    const row=document.createElement('div');row.className='ytd-flow';row.dataset.flowId=flow.id||'flow_'+crypto.getRandomValues(new Uint32Array(2)).join('_');
    const others=getState().accounts.filter(a=>a.id!==editAccountId);
    row.innerHTML=`<div class="ytd-flow-main"><label>Date<input class="ytd-date" type="date" value="${escape(flow.date||'')}"/></label>
      <label>Amount · + contribution / − withdrawal<input class="ytd-amount" type="number" step="any" value="${escape(flow.amount??'')}"/></label></div>
      <label>Note<input class="ytd-note" maxlength="200" value="${escape(flow.note||'')}"/></label>
      <div class="ytd-flow-transfer"><label>Other portfolio · optional<select class="ytd-counterparty"><option value="">Outside this portfolio group</option>${others.map(a=>`<option value="${escape(a.id)}" ${flow.counterpartyId===a.id?'selected':''}>${escape(a.name)}</option>`).join('')}</select></label>
      <label>Shared transfer reference<input class="ytd-transfer" maxlength="80" value="${escape(flow.transferId||'')}" placeholder="Same reference on both sides"/></label></div>
      <button type="button" class="ghost-btn ytd-remove">Remove flow</button>`;
    row.querySelector('.ytd-remove').addEventListener('click',()=>row.remove());byId('ytdFlows').appendChild(row);
  }
  function loadEditor(){
    const year=byId('ytdYear').value,p=account(editAccountId)?.performanceProfiles?.[year];
    byId('ytdEnabled').checked=p?.enabled===true;
    byId('ytdOpening').value=p?.openingNav??'';
    const select=byId('ytdCurrency');select.innerHTML=Object.keys(getState().settings.fx).filter(c=>/^[A-Z]{3}$/.test(c)).map(c=>`<option>${escape(c)}</option>`).join('');
    if(p?.currency&&!Array.from(select.options).some(o=>o.value===p.currency))select.add(new Option(p.currency,p.currency));
    select.value=p?.currency||getState().settings.baseCurrency||'HKD';
    byId('ytdReviewed').value=p?.flowsCompleteThrough||(year===yearNow()?today():`${year}-12-31`);
    byId('ytdSource').value=p?.source||'';byId('ytdFlows').innerHTML='';byId('ytdError').textContent='';
    for(const f of p?.externalFlows||[])addFlow(f);
  }
  function openEditor(){
    if(!currentPortfolioId)return;
    editAccountId=currentPortfolioId;byId('ytdAccountName').textContent=account(editAccountId)?.name||'Portfolio';byId('ytdYear').value=yearNow();loadEditor();openModal('ytdModal');
  }
  function saveEditor(){
    const a=account(editAccountId),year=byId('ytdYear').value;if(!a)return;
    const previous=a.performanceProfiles,existing=previous?.[year],isEnabled=byId('ytdEnabled').checked;
    if(!/^\d{4}$/.test(year)){byId('ytdError').textContent='Choose a valid year.';return;}
    if(!isEnabled&&!existing){closeModal('ytdModal');return;}
    const profile=isEnabled?{version:1,enabled:true,method:METHOD,openingAsOf:`${Number(year)-1}-12-31`,currency:byId('ytdCurrency').value,
      openingNav:number(byId('ytdOpening').value),flowsCompleteThrough:byId('ytdReviewed').value,source:byId('ytdSource').value.trim(),
      externalFlows:Array.from(byId('ytdFlows').children).map(row=>({id:row.dataset.flowId,date:row.querySelector('.ytd-date').value,amount:number(row.querySelector('.ytd-amount').value),
        note:row.querySelector('.ytd-note').value.trim(),counterpartyId:row.querySelector('.ytd-counterparty').value||null,transferId:row.querySelector('.ytd-transfer').value.trim()||null}))}: {...existing,enabled:false};
    const errors=isEnabled?validate(profile,year):[];
    if(isEnabled&&profile.externalFlows.some(f=>f.date>today()))errors.push('Future external flows cannot be included as actuals.');
    if(isEnabled&&profile.flowsCompleteThrough>today())errors.push('Flow review date cannot be in the future.');
    if(isEnabled&&profile.externalFlows.some(f=>f.date>profile.flowsCompleteThrough))errors.push('Flow review date must cover every entered flow.');
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
    const actions=document.querySelector('.portfolio-header-actions');
    if(actions&&!byId('ytdSettingsBtn')){
      const btn=document.createElement('button');btn.id='ytdSettingsBtn';btn.className='icon-text-btn';btn.type='button';btn.textContent='YTD settings';btn.addEventListener('click',openEditor);actions.prepend(btn);
    }
    if(!byId('ytdModal')){
      const modal=document.createElement('div');modal.id='ytdModal';modal.className='modal-overlay hidden';
      modal.innerHTML=`<div class="modal-wrap"><form class="modal-card ytd-editor" onsubmit="return false;">
        <div class="section-head"><h3>Optional YTD performance</h3><button type="button" id="ytdClose" class="icon-btn">×</button></div>
        <p id="ytdAccountName"></p><label>Year<input id="ytdYear" type="number" min="1000" max="9999" step="1"/></label>
        <label><input id="ytdEnabled" type="checkbox"/>Enable only for this portfolio and year</label>
        <div class="ytd-form-note">Opening NAV means net assets at the prior year end, including cash and margin liabilities. This setting changes YTD performance only.</div>
        <label>Reporting currency<select id="ytdCurrency"></select></label><label>Opening NAV<input id="ytdOpening" type="number" step="any" min="0"/></label>
        <label>Source / reconciliation note<input id="ytdSource" maxlength="300"/></label>
        <h4>External flows for the whole year</h4><p class="ytd-form-note">Enter every contribution and withdrawal in the reporting currency, using its value on the flow date. This list replaces transaction-based flows for anchored YTD only. Do not include stock trades, retained dividends, fees, interest or currency exchanges. No transactions are imported or edited.</p>
        <div id="ytdFlows"></div><button id="ytdAddFlow" type="button" class="ghost-btn full">Add external flow</button>
        <p class="ytd-form-note">For transfers between portfolios, enter equal opposite amounts, the other portfolio and the same transfer reference on both sides. Cross-date or unmatched transfers block the anchored group return.</p>
        <label>Flow list reviewed through<input id="ytdReviewed" type="date"/></label>
        <div id="ytdError" class="ytd-error" role="alert"></div><button id="ytdSave" type="button" class="primary-btn full">Save YTD settings</button>
        <p class="ytd-form-note">Modified Dietz is a day-weighted estimate, not exact TWR. An opening anchor cannot reconstruct missing daily NAV history. Current NAV still comes from the existing portfolio accounting. Saving follows this device’s normal Cloud Sync.</p>
      </form></div>`;
      document.body.appendChild(modal);byId('ytdClose').addEventListener('click',()=>closeModal('ytdModal'));modal.addEventListener('click',e=>{if(e.target===modal)closeModal('ytdModal');});
      byId('ytdYear').addEventListener('change',loadEditor);byId('ytdAddFlow').addEventListener('click',()=>addFlow());byId('ytdSave').addEventListener('click',saveEditor);
    }
    const sync=document.querySelector('#syncModal .modal-card');
    if(sync&&!byId('ytdSyncFingerprint')){const el=document.createElement('div');el.id='ytdSyncFingerprint';el.className='ytd-fingerprint';sync.appendChild(el);fingerprint();}
  }
  install();
  document.addEventListener('click',e=>{if(e.target.closest?.('#cloudSyncBtn,#connectSyncBtn,#createSyncBtn,#disconnectSyncBtn'))setTimeout(()=>{install();fingerprint();},1000);});
})(typeof window==='undefined'?globalThis:window);
