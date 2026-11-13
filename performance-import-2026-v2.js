(()=>{
  if(window.__performanceReconcile2026V22521)return;
  window.__performanceReconcile2026V22521=true;

  const YEAR='2026';
  const BASELINE={date:'2026-01-01',value:560662.06,currency:'HKD',sourceId:'opening-nav-2026-01-01'};
  const VERIFIED=[
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
  ];

  function accountByName(name){
    const key=String(name||'').trim().toLowerCase();
    return state.accounts.find(a=>String(a.name||'').trim().toLowerCase()===key)||null;
  }

  function resolvedTargets(){
    return [...new Set(VERIFIED.map(x=>x.portfolio))].map(name=>({name,account:accountByName(name)}));
  }

  function targetAccountIds(){
    return new Set(resolvedTargets().map(x=>x.account?.id).filter(Boolean));
  }

  function existingDeposits(){
    const ids=targetAccountIds();
    return state.transactions.filter(t=>
      ids.has(t.accountId)&&
      t.type==='Deposit'&&
      String(t.date||'').startsWith(YEAR+'-')
    );
  }

  function toHKD(amount,currency){
    return convert(Number(amount)||0,currency||'HKD','HKD');
  }

  function totalHKD(rows){
    return rows.reduce((sum,t)=>sum+toHKD(t.amount,t.currency),0);
  }

  function desiredByAccount(){
    const m=new Map();
    for(const v of VERIFIED)m.set(v.portfolio,(m.get(v.portfolio)||0)+v.amount);
    return m;
  }

  function ensureModal(){
    if(document.getElementById('performance2026ImportModal'))return;
    const modal=document.createElement('div');
    modal.id='performance2026ImportModal';
    modal.className='modal-overlay hidden';
    modal.innerHTML=`<div class="modal-wrap"><div class="modal-card">
      <div class="section-head">
        <div><div class="brand">2026 DEPOSIT RECONCILIATION</div><h3>Replace old records with verified data</h3></div>
        <button id="closePerformance2026Import" type="button" class="icon-btn">×</button>
      </div>

      <div class="performance-import-note">
        This does not append another HK$91,100. It replaces the existing 2026 Deposit records in FIRE, Futu and IBKR Short term with the verified records below. Buy/Sell trades, FX records and holdings are not changed.
      </div>

      <div class="performance-import-baseline">
        <span>Performance opening NAV · 1 Jan 2026</span>
        <strong>HK$560,662.06</strong>
      </div>

      <div id="performance2026ReconcileSummary" class="performance-reconcile-summary"></div>
      <div id="performance2026ImportRows" class="performance-import-rows"></div>
      <div id="performance2026ImportStatus" class="performance-import-status"></div>

      <button id="applyPerformance2026Import" type="button" class="primary-btn full">Replace with verified 2026 deposits</button>
    </div></div>`;

    document.body.appendChild(modal);

    const style=document.createElement('style');
    style.textContent=`
      .performance-import-note{font-size:12px;line-height:1.5;color:var(--muted);background:#151519;border:1px solid var(--line);border-radius:12px;padding:10px 12px}
      .performance-import-baseline{display:flex;justify-content:space-between;gap:12px;align-items:center;background:#111115;border:1px solid var(--line);border-radius:13px;padding:12px}
      .performance-import-baseline span{color:var(--muted);font-size:12px}
      .performance-import-baseline strong{font-size:15px}
      .performance-reconcile-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .performance-reconcile-box{background:#111115;border:1px solid var(--line);border-radius:12px;padding:10px}
      .performance-reconcile-box span{display:block;color:var(--muted);font-size:11px;margin-bottom:4px}
      .performance-reconcile-box strong{font-size:14px}
      .performance-import-rows{max-height:38vh;overflow:auto;border:1px solid var(--line);border-radius:13px}
      .performance-import-row{display:grid;grid-template-columns:92px minmax(0,1fr) auto;gap:8px;padding:9px 10px;border-bottom:1px solid var(--line);font-size:12px;align-items:center}
      .performance-import-row:last-child{border-bottom:0}
      .performance-import-status{font-size:12px;color:var(--muted);line-height:1.5}
    `;
    document.head.appendChild(style);

    document.getElementById('closePerformance2026Import').addEventListener('click',()=>closeModal('performance2026ImportModal'));
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal('performance2026ImportModal');});
    document.getElementById('applyPerformance2026Import').addEventListener('click',applyReconcile);
  }

  function renderPreview(){
    ensureModal();
    const missing=resolvedTargets().filter(x=>!x.account).map(x=>x.name);
    const existing=existingDeposits();
    const existingTotal=totalHKD(existing);
    const desiredTotal=VERIFIED.reduce((s,x)=>s+x.amount,0);
    const desiredMap=desiredByAccount();

    const actualByAccount=new Map();
    for(const t of existing){
      const name=portfolioName(t.accountId);
      actualByAccount.set(name,(actualByAccount.get(name)||0)+toHKD(t.amount,t.currency));
    }

    document.getElementById('performance2026ReconcileSummary').innerHTML=`
      <div class="performance-reconcile-box"><span>Existing 2026 deposits</span><strong>${existing.length} records · ${money(existingTotal,'HKD')}</strong></div>
      <div class="performance-reconcile-box"><span>Verified replacement</span><strong>12 records · ${money(desiredTotal,'HKD')}</strong></div>
    `;

    document.getElementById('performance2026ImportRows').innerHTML=VERIFIED.map(v=>`
      <div class="performance-import-row">
        <span>${esc(v.date)}</span>
        <span>${esc(v.portfolio)}</span>
        <strong>${money(v.amount,'HKD')}</strong>
      </div>`
    ).join('');

    const comparisons=[...desiredMap.entries()].map(([name,desired])=>{
      const existingAmount=actualByAccount.get(name)||0;
      return `${name}: ${money(existingAmount,'HKD')} → ${money(desired,'HKD')}`;
    });

    const status=document.getElementById('performance2026ImportStatus');
    status.textContent=missing.length
      ?`Cannot proceed: portfolio not found — ${missing.join(', ')}.`
      :`${comparisons.join(' · ')}. A local backup of the old 2026 deposits will be saved before replacement.`;

    document.getElementById('applyPerformance2026Import').disabled=!!missing.length;
    return !missing.length;
  }

  function applyReconcile(){
    if(!renderPreview())return toast('Required portfolio name was not found.',true);

    const targets=resolvedTargets();
    const accountMap=new Map(targets.map(x=>[x.name,x.account]));
    const targetIds=new Set(targets.map(x=>x.account.id));
    const oldRows=existingDeposits();

    state.settings=state.settings||{};
    state.settings.performanceReconcileBackup2026={
      createdAt:new Date().toISOString(),
      deposits:oldRows.map(x=>({...x}))
    };

    state.transactions=state.transactions.filter(t=>!(
      targetIds.has(t.accountId)&&
      t.type==='Deposit'&&
      String(t.date||'').startsWith(YEAR+'-')
    ));

    for(const v of VERIFIED){
      const account=accountMap.get(v.portfolio);
      state.transactions.push({
        id:uid('t_'),
        sourceId:v.sourceId,
        accountId:account.id,
        type:'Deposit',
        currency:'HKD',
        amount:v.amount,
        date:v.date,
        assetId:null,
        qty:0,
        price:0,
        fee:0
      });
    }

    delete state.performanceFlows;
    state.settings.performanceBaseline={...BASELINE};
    state.settings.performanceCashFlowReconciledAt=new Date().toISOString();

    save();
    closeModal('performance2026ImportModal');
    currentPortfolioId=null;
    if(typeof renderAll==='function')renderAll();
    if(typeof window.renderOverallReturn==='function')setTimeout(()=>window.renderOverallReturn({force:false}),0);

    toast(`2026 deposits reconciled: ${oldRows.length} old records replaced by 12 verified records totaling HK$91,100.00.`);
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