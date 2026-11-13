(()=>{
  if(window.__performanceImport2026V22518)return;
  window.__performanceImport2026V22518=true;

  const BASELINE={date:'2026-01-01',value:560662.06,currency:'HKD'};
  const FLOWS=[
    {sourceId:'2026-fire-0103',portfolio:'FIRE',date:'2026-01-03',amount:10000,currency:'HKD',type:'Deposit'},
    {sourceId:'2026-futu-0205',portfolio:'Futu',date:'2026-02-05',amount:5000,currency:'HKD',type:'Deposit'},
    {sourceId:'2026-futu-0303',portfolio:'Futu',date:'2026-03-03',amount:5000,currency:'HKD',type:'Deposit'},
    {sourceId:'2026-ib-0401',portfolio:'IBKR Short term',date:'2026-04-01',amount:10000,currency:'HKD',type:'Deposit'},
    {sourceId:'2026-ib-0403',portfolio:'IBKR Short term',date:'2026-04-03',amount:5000,currency:'HKD',type:'Deposit'},
    {sourceId:'2026-futu-0506',portfolio:'Futu',date:'2026-05-06',amount:6000,currency:'HKD',type:'Deposit'},
    {sourceId:'2026-ib-0512',portfolio:'IBKR Short term',date:'2026-05-12',amount:10000,currency:'HKD',type:'Deposit'},
    {sourceId:'2026-futu-0601',portfolio:'Futu',date:'2026-06-01',amount:10000,currency:'HKD',type:'Deposit'},
    {sourceId:'2026-ib-0602',portfolio:'IBKR Short term',date:'2026-06-02',amount:10000,currency:'HKD',type:'Deposit'},
    {sourceId:'2026-ib-0603',portfolio:'IBKR Short term',date:'2026-06-03',amount:100,currency:'HKD',type:'Deposit'},
    {sourceId:'2026-ib-0618',portfolio:'IBKR Short term',date:'2026-06-18',amount:10000,currency:'HKD',type:'Deposit'},
    {sourceId:'2026-ib-1109',portfolio:'IBKR Short term',date:'2026-11-09',amount:10000,currency:'HKD',type:'Deposit'}
  ];

  function accountByName(name){
    const target=String(name||'').trim().toLowerCase();
    return state.accounts.find(a=>String(a.name||'').trim().toLowerCase()===target)||null;
  }

  function ensureModal(){
    if(document.getElementById('performance2026ImportModal'))return;
    const modal=document.createElement('div');
    modal.id='performance2026ImportModal';
    modal.className='modal-overlay hidden';
    modal.innerHTML=`<div class="modal-wrap"><div class="modal-card">
      <div class="section-head">
        <div><div class="brand">PERFORMANCE DATA</div><h3>Import 2026 cash flows</h3></div>
        <button id="closePerformance2026Import" type="button" class="icon-btn">×</button>
      </div>
      <div class="performance-import-note">This imports performance analytics data only. It does not add cash to portfolio balances or change current Net Assets.</div>
      <div class="performance-import-baseline">
        <span>Opening NAV · 1 Jan 2026</span>
        <strong>HK$560,662.06</strong>
      </div>
      <div id="performance2026ImportRows" class="performance-import-rows"></div>
      <div id="performance2026ImportStatus" class="performance-import-status"></div>
      <button id="applyPerformance2026Import" type="button" class="primary-btn full">Import 12 cash flows</button>
    </div></div>`;
    document.body.appendChild(modal);

    const style=document.createElement('style');
    style.textContent=`
      .performance-import-note{font-size:12px;line-height:1.45;color:var(--muted);background:#151519;border:1px solid var(--line);border-radius:12px;padding:10px 12px}
      .performance-import-baseline{display:flex;justify-content:space-between;gap:12px;align-items:center;background:#111115;border:1px solid var(--line);border-radius:13px;padding:12px}
      .performance-import-baseline span{color:var(--muted);font-size:12px}
      .performance-import-baseline strong{font-size:15px}
      .performance-import-rows{max-height:42vh;overflow:auto;border:1px solid var(--line);border-radius:13px}
      .performance-import-row{display:grid;grid-template-columns:92px minmax(0,1fr) auto;gap:8px;padding:9px 10px;border-bottom:1px solid var(--line);font-size:12px;align-items:center}
      .performance-import-row:last-child{border-bottom:0}
      .performance-import-row .muted{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .performance-import-status{font-size:12px;color:var(--muted);line-height:1.45}
    `;
    document.head.appendChild(style);

    document.getElementById('closePerformance2026Import').addEventListener('click',()=>closeModal('performance2026ImportModal'));
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal('performance2026ImportModal');});
    document.getElementById('applyPerformance2026Import').addEventListener('click',applyImport);
  }

  function renderPreview(){
    ensureModal();
    const rows=document.getElementById('performance2026ImportRows');
    const status=document.getElementById('performance2026ImportStatus');
    const missing=[...new Set(FLOWS.map(f=>f.portfolio).filter(name=>!accountByName(name)))];
    rows.innerHTML=FLOWS.map(f=>{
      const account=accountByName(f.portfolio);
      return `<div class="performance-import-row">
        <span>${esc(f.date)}</span>
        <span class="muted">${esc(f.portfolio)}${account?'':' · not found'}</span>
        <strong>${money(f.amount,'HKD')}</strong>
      </div>`;
    }).join('');
    const existingIds=new Set((state.performanceFlows||[]).map(f=>f.sourceId));
    const existing=FLOWS.filter(f=>existingIds.has(f.sourceId)).length;
    status.textContent=missing.length
      ?`Cannot import yet: missing portfolio ${missing.join(', ')}.`
      :existing===FLOWS.length
        ?'All 12 cash flows are already imported. Re-import is blocked by duplicate protection.'
        :`${existing} of 12 cash flows already present. Only missing records will be added.`;
    const btn=document.getElementById('applyPerformance2026Import');
    btn.disabled=!!missing.length||existing===FLOWS.length;
    btn.textContent=existing===FLOWS.length?'Already imported':`Import ${FLOWS.length-existing} cash flow${FLOWS.length-existing===1?'':'s'}`;
    return !missing.length;
  }

  function applyImport(){
    const ok=renderPreview();
    if(!ok)return toast('Required portfolio name was not found.',true);

    state.performanceFlows=Array.isArray(state.performanceFlows)?state.performanceFlows:[];
    state.settings=state.settings||{};
    state.settings.performanceBaseline={...BASELINE,sourceId:'opening-nav-2026-01-01'};

    const existingIds=new Set(state.performanceFlows.map(f=>f.sourceId));
    let added=0;
    for(const f of FLOWS){
      if(existingIds.has(f.sourceId))continue;
      const account=accountByName(f.portfolio);
      if(!account)continue;
      state.performanceFlows.push({
        id:uid('pf_'),
        sourceId:f.sourceId,
        accountId:account.id,
        accountName:account.name,
        date:f.date,
        amount:f.amount,
        currency:f.currency,
        type:f.type,
        category:'external_flow',
        performanceOnly:true
      });
      added++;
    }
    state.performanceFlows.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    save();
    closeModal('performance2026ImportModal');
    if(typeof renderAll==='function')renderAll();
    if(typeof window.renderOverallReturn==='function')setTimeout(()=>window.renderOverallReturn({force:false}),0);
    toast(added?`Imported ${added} performance cash flow${added===1?'':'s'}.`:'Performance data already imported.');
  }

  async function applyFromUrl(){
    const params=new URLSearchParams(location.search);
    if(params.get('prefill')!=='performance2026')return false;
    ensureModal();
    renderPreview();
    openModal('performance2026ImportModal');
    try{
      const url=new URL(location.href);
      url.searchParams.delete('prefill');
      history.replaceState(null,'',url.pathname+(url.searchParams.toString()?('?'+url.searchParams.toString()):'')+url.hash);
    }catch{}
    return true;
  }

  window.applyPerformance2026ImportFromUrl=applyFromUrl;
})();