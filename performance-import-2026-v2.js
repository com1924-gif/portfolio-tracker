(()=>{
  if(window.__performanceImport2026V22520)return;
  window.__performanceImport2026V22520=true;

  const YEAR='2026';
  const BASELINE={date:'2026-01-01',value:560662.06,currency:'HKD',sourceId:'opening-nav-2026-01-01'};
  const FLOWS=[
    {sourceId:'2026-fire-0103',portfolio:'FIRE',date:'2026-01-03',amount:10000},
    {sourceId:'2026-futu-0205',portfolio:'Futu',date:'2026-02-05',amount:5000},
    {sourceId:'2026-futu-0303',portfolio:'Futu',date:'2026-03-03',amount:5000},
    {sourceId:'2026-ib-0401',portfolio:'IBKR Short term',date:'2026-04-01',amount:10000},
    {sourceId:'2026-ib-0403',portfolio:'IBKR Short term',date:'2026-04-03',amount:5000},
    {sourceId:'2026-futu-0506',portfolio:'Futu',date:'2026-05-06',amount:6000},
    {sourceId:'2026-ib-0512',portfolio:'IBKR Short term',date:'2026-05-12',amount:10000},
    {sourceId:'2026-futu-0601',portfolio:'Futu',date:'2026-06-01',amount:10000},
    {sourceId:'2026-ib-0602',portfolio:'IBKR Short term',date:'2026-06-02',amount:10000},
    {sourceId:'2026-ib-0603',portfolio:'IBKR Short term',date:'2026-06-03',amount:100},
    {sourceId:'2026-ib-0618',portfolio:'IBKR Short term',date:'2026-06-18',amount:10000},
    {sourceId:'2026-ib-1109',portfolio:'IBKR Short term',date:'2026-11-09',amount:10000}
  ].map(x=>({...x,currency:'HKD',type:'Deposit'}));

  function accountByName(name){
    const target=String(name||'').trim().toLowerCase();
    return state.accounts.find(a=>String(a.name||'').trim().toLowerCase()===target)||null;
  }

  function targetAccounts(){
    const names=[...new Set(FLOWS.map(f=>f.portfolio))];
    return names.map(name=>({name,account:accountByName(name)}));
  }

  function existing2026Deposits(){
    const ids=new Set(targetAccounts().map(x=>x.account?.id).filter(Boolean));
    return state.transactions.filter(t=>
      ids.has(t.accountId)&&
      t.type==='Deposit'&&
      String(t.date||'').startsWith(YEAR+'-')
    );
  }

  function totalHKD(rows){
    return rows.reduce((sum,t)=>sum+convert(Number(t.amount)||0,t.currency||'HKD','HKD'),0);
  }

  function ensureModal(){
    if(document.getElementById('performance2026ImportModal'))return;
    const modal=document.createElement('div');
    modal.id='performance2026ImportModal';
    modal.className='modal-overlay hidden';
    modal.innerHTML=`<div class="modal-wrap"><div class="modal-card">
      <div class="section-head">
        <div><div class="brand">2026 CASH FLOW RECONCILIATION</div><h3>Replace existing deposits</h3></div>
        <button id="closePerformance2026Import" type="button" class="icon-btn">×</button>
      </div>
      <div class="performance-import-note">
        This is a replace-and-reconcile action, not an append. Existing 2026 Deposit records in FIRE, Futu and IBKR Short term will be replaced by the complete records below, so they cannot be double counted.
      </div>
      <div class="performance-import-baseline">
        <span>Opening NAV · 1 Jan 2026</span>
        <strong>HK$560,662.06</strong>
      </div>
      <div id="performance2026ImportRows" class="performance-import-rows"></div>
      <div id="performance2026ImportStatus" class="performance-import-status"></div>
      <button id="applyPerformance2026Import" type="button" class="primary-btn full">Reconcile 2026 deposits</button>
    </div></div>`;
    document.body.appendChild(modal);

    const style=document.createElement('style');
    style.textContent=`
      .performance-import-note{font-size:12px;line-height:1.5;color:var(--muted);background:#151519;border:1px solid var(--line);border-radius:12px;padding:10px 12px}
      .performance-import-baseline{display:flex;justify-content:space-between;gap:12px;align-items:center;background:#111115;border:1px solid var(--line);border-radius:13px;padding:12px}
      .performance-import-baseline span{color:var(--muted);font-size:12px}
      .performance-import-baseline strong{font-size:15px}
      .performance-import-rows{max-height:42vh;overflow:auto;border:1px solid var(--line);border-radius:13px}
      .performance-import-row{display:grid;grid-template-columns:92px minmax(0,1fr) auto;gap:8px;padding:9px 10px;border-bottom:1px solid var(--line);font-size:12px;align-items:center}
      .performance-import-row:last-child{border-bottom:0}
      .performance-import-row .muted{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .performance-import-status{font-size:12px;color:var(--muted);line-height:1.5}
    `;
    document.head.appendChild(style);

    document.getElementById('closePerformance2026Import').addEventListener('click',()=>closeModal('performance2026ImportModal'));
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal('performance2026ImportModal');});
    document.getElementById('applyPerformance2026Import').addEventListener('click',applyReconcile);
  }

  function renderPreview(){
    ensureModal();
    const rowsEl=document.getElementById('performance2026ImportRows');
    const status=document.getElementById('performance2026ImportStatus');
    const missing=targetAccounts().filter(x=>!x.account).map(x=>x.name);

    rowsEl.innerHTML=FLOWS.map(f=>`<div class="performance-import-row">
      <span>${esc(f.date)}</span>
      <span class="muted">${esc(f.portfolio)}</span>
      <strong>${money(f.amount,'HKD')}</strong>
    </div>`).join('');

    const existing=existing2026Deposits();
    const existingTotal=totalHKD(existing);
    const desiredTotal=FLOWS.reduce((s,f)=>s+f.amount,0);

    status.textContent=missing.length
      ?`Cannot reconcile: missing portfolio ${missing.join(', ')}.`
      :`Found ${existing.length} existing 2026 Deposit record${existing.length===1?'':'s'} totaling ${money(existingTotal,'HKD')}. They will be replaced by 12 verified records totaling ${money(desiredTotal,'HKD')}. Current holdings/trades are untouched.`;

    const btn=document.getElementById('applyPerformance2026Import');
    btn.disabled=!!missing.length;
    return !missing.length;
  }

  function applyReconcile(){
    if(!renderPreview())return toast('Required portfolio name was not found.',true);

    const resolved=targetAccounts();
    const accountMap=new Map(resolved.map(x=>[x.name,x.account]));
    const targetIds=new Set(resolved.map(x=>x.account.id));

    const removed=state.transactions.filter(t=>
      targetIds.has(t.accountId)&&
      t.type==='Deposit'&&
      String(t.date||'').startsWith(YEAR+'-')
    );

    state.transactions=state.transactions.filter(t=>!(
      targetIds.has(t.accountId)&&
      t.type==='Deposit'&&
      String(t.date||'').startsWith(YEAR+'-')
    ));

    for(const f of FLOWS){
      const account=accountMap.get(f.portfolio);
      state.transactions.push({
        id:uid('t_'),
        sourceId:f.sourceId,
        accountId:account.id,
        type:'Deposit',
        currency:'HKD',
        amount:f.amount,
        date:f.date,
        assetId:null,
        qty:0,
        price:0,
        fee:0
      });
    }

    state.transactions.sort((a,b)=>(a.date||'').localeCompare(b.date||''));

    state.performanceFlows=Array.isArray(state.performanceFlows)
      ?state.performanceFlows.filter(f=>!(
        targetIds.has(f.accountId)&&
        String(f.date||'').startsWith(YEAR+'-')&&
        f.type==='Deposit'
      ))
      :[];

    state.settings=state.settings||{};
    state.settings.performanceBaseline={...BASELINE};
    state.settings.performanceCashFlowReconciledAt=new Date().toISOString();

    save();
    closeModal('performance2026ImportModal');
    currentPortfolioId=null;
    if(typeof renderAll==='function')renderAll();
    if(typeof window.renderOverallReturn==='function')setTimeout(()=>window.renderOverallReturn({force:false}),0);

    const oldTotal=totalHKD(removed);
    toast(`Reconciled 2026 deposits: ${removed.length} old record${removed.length===1?'':'s'} (${money(oldTotal,'HKD')}) replaced by 12 verified records (HK$91,100.00).`);
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