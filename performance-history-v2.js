/* Optional private NAV history. Accounting and the live ledger are never changed. */
(function(root){
  'use strict';
  const DAY=86400000;
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
  function basis(p){
    return {openingAsOf:p?.openingAsOf,openingNav:p?.openingNav,currency:p?.currency,method:p?.method,
      automaticFlowsAfter:p?.automaticFlowsAfter||null,autoFlowTransfers:p?.autoFlowTransfers||{},
      anchor:p?.anchor?{date:p.anchor.date,nav:p.anchor.nav,appNav:p.anchor.appNav,returnPct:p.anchor.returnPct}:null,
      flows:(p?.externalFlows||[]).map(f=>({date:f.date,amount:f.amount,counterpartyId:f.counterpartyId||null,transferId:f.transferId||null})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))};
  }
  function ledgerBasis(s,id,through){
    const transactions=s.transactions.filter(t=>t.accountId===id&&t.date<=through).map(t=>({id:t.id,date:t.date,type:t.type,assetId:t.assetId||null,currency:t.currency,qty:t.qty??null,price:t.price??null,amount:t.amount??null,fee:t.fee||0})).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    const used=new Set(transactions.map(t=>t.assetId));
    const assets=(s.assets||[]).filter(a=>a.accountId===id&&used.has(a.id)).map(a=>({id:a.id,type:a.type,symbol:a.symbol,currency:a.currency,multiplier:a.multiplier||1,positionSide:a.positionSide||'long'})).sort((a,b)=>a.id.localeCompare(b.id));
    const fx=s.fx.filter(f=>f.accountId===id&&f.date<=through).map(f=>({id:f.id,date:f.date,from:f.from,to:f.to,fromAmount:f.fromAmount,toAmount:f.toAmount,fee:f.fee||0})).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    return JSON.stringify({transactions,assets,fx});
  }
  function validate(h,year){
    const errors=[];
    if(!h||h.version!==1||!/^\d{4}$/.test(String(year)))return ['Unsupported NAV history format.'];
    if(!/^[A-Z]{3}$/.test(h.currency||''))errors.push('History needs a reporting currency.');
    if(h.from!==year+'-01-01'||!validDate(h.through)||h.through.slice(0,4)!==String(year))errors.push('History must start on 1 January and finish within the selected year.');
    if(!['modified-dietz',undefined].includes(h.historicalReturnMethod))errors.push('Unsupported historical return method.');
    if(!Array.isArray(h.points)||h.points.length<1||h.points.length>366)return [...errors,'History needs daily NAV points.'];
    let previous=null;
    for(const p of h.points){
      if(!validDate(p?.date)||p.date.slice(0,4)!==String(year)||typeof p.nav!=='number'||!Number.isFinite(p.nav)||!['estimated','statement','opening'].includes(p.quality)||typeof p.source!=='string'||!p.source.trim())errors.push('Each NAV point needs a valid date, finite amount, quality and source.');
      if(previous&&Date.parse(p?.date)-Date.parse(previous)!==DAY)errors.push('History needs one point for each calendar day, in date order.');
      previous=p?.date;
    }
    if(h.points[0]?.date!==h.from||h.points.at(-1)?.date!==h.through)errors.push('History dates do not match its declared coverage.');
    return [...new Set(errors)];
  }
  function profileAt(p,h,date){
    if(!p?.enabled||!h?.enabled||validate(h,date.slice(0,4)).length||JSON.stringify(h.basis)!==JSON.stringify(basis(p)))return p;
    if(p.method!=='broker-linked-estimate'||h.historicalReturnMethod!=='modified-dietz'||date>=p.anchor?.date||date<h.from||date>h.through)return p;
    const copy={...p,method:'modified-dietz'};delete copy.anchor;
    return copy;
  }
  function importErrors(pack,state,asOf){
    const errors=[];
    if(pack?.format!=='portfolio-performance-history'||pack.version!==1||!Array.isArray(pack.portfolios)||!pack.portfolios.length)return ['Choose a performance-history JSON file.'];
    const seen=new Set();
    for(const record of pack.portfolios){
      const key=record?.accountId+':'+record?.year,a=state.accounts.find(a=>a.id===record?.accountId),p=a?.performanceProfiles?.[record?.year];
      if(seen.has(key))errors.push('A portfolio and year appear more than once.');seen.add(key);
      if(!a||!p?.enabled){errors.push('Every history needs an existing portfolio with enabled YTD settings.');continue;}
      errors.push(...validate(record.history,record.year));
      if(record.history?.through>asOf)errors.push('History cannot contain future NAV points.');
      if(record.history?.currency!==p.currency||JSON.stringify(record.history?.basis)!==JSON.stringify(basis(p)))errors.push(a.name+': opening NAV or external-flow settings differ from the history basis. Rebuild the history before importing.');
      if(record.history?.ledgerBasis!==ledgerBasis(state,a.id,record.history?.through))errors.push(a.name+': historical ledger records changed since this history was prepared. Rebuild before importing.');
      const first=[...state.transactions,...state.fx].filter(t=>t.accountId===a.id&&validDate(t.date)&&t.date.slice(0,4)===record.year).map(t=>t.date).sort()[0];
      if(first&&record.history?.through<first)errors.push(a.name+': history does not reach the recorded ledger.');
    }
    return [...new Set(errors)];
  }
  const api={basis,ledgerBasis,validate,profileAt,importErrors};root.PortfolioPerformanceHistory=api;
  if(typeof document==='undefined')return;
  const getState=()=>typeof state==='undefined'?null:state;
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  function historyFor(id,year){
    const a=getState()?.accounts.find(a=>a.id===id),h=a?.performanceHistories?.[year],p=a?.performanceProfiles?.[year];
    return h?.enabled===true&&p?.enabled===true&&!validate(h,year).length&&JSON.stringify(h.basis)===JSON.stringify(basis(p))&&h.ledgerBasis===ledgerBasis(getState(),id,h.through)?h:null;
  }
  function firstDate(id,fallback,year=today().slice(0,4)){const h=historyFor(id,year);return h&&(!fallback||h.through>=fallback)?[h.from,fallback].filter(Boolean).sort()[0]:fallback;}
  function point(id,date){return historyFor(id,date.slice(0,4))?.points.find(p=>p.date===date)||null;}
  function valueAt(id,date,currency){
    const h=historyFor(id,date.slice(0,4)),p=h?.points.find(p=>p.date===date);if(!p)return null;
    const rates=getState()?.settings?.fx||{};
    if(!(Number(rates[h.currency])>0&&Number(rates[currency])>0))throw new Error('Imported history currency rate is unavailable.');
    return convert(p.nav,h.currency,currency);
  }
  function points(id){const a=getState()?.accounts.find(a=>a.id===id);return Object.keys(a?.performanceHistories||{}).flatMap(y=>historyFor(id,y)?.points||[]);}
  function overlay(id,series,currency,start,end){
    const out=new Map(series.map(p=>[p.date,p]));
    for(const p of points(id))if(p.date>=start&&p.date<=end)out.set(p.date,{date:p.date,value:valueAt(id,p.date,currency),historyQuality:p.quality,historySource:p.source});
    return [...out.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  function calculationProfile(id,date,p){return profileAt(p,historyFor(id,date.slice(0,4)),date);}
  let renderSequence=0;
  async function renderYtd(id,{force=false}={}){
    const seq=++renderSequence,currency=displayCurrency,start=today().slice(0,4)+'-01-01',end=today();
    const data=await fetchHistoryForPortfolio(id,start,{force});
    if(seq!==renderSequence||currentPortfolioId!==id||displayCurrency!==currency||document.querySelector('#benchmarkPeriods .active')?.dataset.period!=='YTD')return;
    const navSeries=buildPortfolioHistory(id,start,data.pairs,data.history),series=navSeries.flatMap(p=>{
      const r=root.PortfolioYtdAnchor.resultAt(id,p.date,p.value,currency);return r?.ok&&r.returnPct!=null?[{date:p.date,value:r.returnPct}]:[];
    });
    const el=document.getElementById('benchmarkChart');root.PortfolioChartInspector.clear(el);
    if(series.length<2){el.textContent='Not enough invested history to show a YTD curve.';return;}
    const vals=series.map(p=>p.value),lo=Math.min(...vals),hi=Math.max(...vals),pad=Math.max(1,(hi-lo)*.1),min=lo-pad,max=hi+pad;
    const width=700,height=240,left=14,right=686,top=18,bottom=210;
    const x=date=>left+(right-left)*(Date.parse(date)-Date.parse(start))/Math.max(86400000,Date.parse(end)-Date.parse(start));
    const y=value=>top+(bottom-top)*(1-(value-min)/(max-min));
    const pts=series.map(p=>x(p.date).toFixed(1)+','+y(p.value).toFixed(1)).join(' ');
    el.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Reconstructed historical YTD"><line x1="${left}" x2="${right}" y1="${y(0)}" y2="${y(0)}" stroke="#40505f" stroke-dasharray="4 4"/><polyline points="${pts}" fill="none" stroke="#ff9b45" stroke-width="3" vector-effect="non-scaling-stroke"/><text x="${left}" y="234" fill="#8e8e99" font-size="11">${start}</text><text x="${right}" y="234" text-anchor="end" fill="#8e8e99" font-size="11">${end}</text></svg>`;
    root.PortfolioChartInspector.attach({element:el,series,navSeries,kind:'return',portfolioId:id,accountIds:[id],currency,start,end,x,y,width,height,left,right,top,bottom});
  }
  function conflict(){return /conflict/i.test(document.getElementById('cloudSyncBtn')?.title||'')||(document.getElementById('cloudSyncBtn')?.textContent||'').includes('⚠');}
  function openImport(){
    let modal=document.getElementById('performanceHistoryModal');
    if(!modal){
      modal=document.createElement('div');modal.id='performanceHistoryModal';modal.className='modal-overlay hidden';
      modal.innerHTML='<div class="modal-card" style="width:min(760px,100%);max-height:92vh;overflow:auto;overflow-wrap:anywhere"><div class="section-head"><h3>Historical NAV</h3><button id="historyImportClose" type="button" class="icon-btn">×</button></div><p class="muted">Import a reviewed history for enabled portfolios. This updates charts and historical YTD only. Your normal Cloud Sync stores it with your portfolio.</p><input id="historyImportFile" type="file" accept="application/json,.json"/><div id="historyImportPreview" class="sync-status"></div><button id="historyImportApply" type="button" class="primary-btn full" disabled>Apply historical NAV</button></div>';
      document.body.appendChild(modal);let pack=null;
      const preview=modal.querySelector('#historyImportPreview'),apply=modal.querySelector('#historyImportApply');
      modal.querySelector('#historyImportClose').onclick=()=>modal.classList.add('hidden');
      modal.querySelector('#historyImportFile').onchange=async e=>{
        pack=null;apply.disabled=true;preview.textContent='';const file=e.target.files?.[0];if(!file)return;
        try{
          if(file.size>2*1024*1024)throw new Error('History file exceeds 2 MB.');
          const candidate=JSON.parse(await file.text()),errors=importErrors(candidate,getState(),today());
          if(conflict())errors.push('Resolve the Cloud Sync conflict before applying history. Export both versions to compare first.');
          if(errors.length)throw new Error(errors.join(' '));
          pack=candidate;preview.textContent=pack.portfolios.map(r=>{const a=getState().accounts.find(a=>a.id===r.accountId);return a.name+' · '+r.history.from+' → '+r.history.through+' · '+r.history.points.length+' daily points · '+r.history.points.filter(p=>p.quality==='statement').length+' statement NAV points';}).join('\n')+'\nEstimated days use source trades and closing prices; statement NAV points remain labelled. Existing history for these years will be replaced.';apply.disabled=false;
        }catch(err){preview.textContent=err.message;}
      };
      apply.onclick=()=>{
        if(!pack)return;const errors=importErrors(pack,getState(),today());if(conflict())errors.push('Resolve the Cloud Sync conflict before applying history.');
        if(errors.length){preview.textContent=errors.join(' ');apply.disabled=true;return;}
        const s=getState();localStorage.setItem('portfolioTrackerBeforeHistoryImportV1',JSON.stringify({savedAt:new Date().toISOString(),state:s}));
        for(const r of pack.portfolios){const a=s.accounts.find(a=>a.id===r.accountId);a.performanceHistories={...(a.performanceHistories||{}),[r.year]:structuredClone(r.history)};}
        save();renderAll();modal.classList.add('hidden');toast('Historical NAV imported. Accounting is unchanged.');
      };
    }
    modal.querySelector('#historyImportFile').value='';modal.querySelector('#historyImportPreview').textContent='';modal.querySelector('#historyImportApply').disabled=true;
    modal.classList.remove('hidden');
  }
  Object.assign(api,{historyFor,firstDate,point,valueAt,points,overlay,calculationProfile,renderYtd,openImport});
})(typeof window==='undefined'?globalThis:window);
