(()=>{
  if(window.__cashBaselineV22522)return;
  window.__cashBaselineV22522=true;

  const TRACKING_START='2026-01-01';
  const CURRENCIES=['HKD','USD','KRW','EUR'];
  const previousCashBalancesFor=window.cashBalancesFor;
  const previousCashBalancesAt=window.cashBalancesAt;
  const previousSummaryFor=window.summaryFor;
  const previousRenderCashTab=window.renderCashTab;
  const previousRenderHome=window.renderHome;
  const previousRenderPortfolio=window.renderPortfolio;

  state.settings=state.settings||{};
  if(!state.settings.cashTrackingStartDate){
    state.settings.cashTrackingStartDate=TRACKING_START;
    save();
  }

  function blankBalances(){
    return Object.fromEntries(CURRENCIES.map(c=>[c,0]));
  }

  function accountConfig(accountId){
    const account=state.accounts.find(a=>a.id===accountId);
    const configured=!!account?.cashBaselineConfigured;
    const date=account?.cashBaselineDate||TRACKING_START;
    const balances={...blankBalances(),...(account?.openingCash||{})};
    return {account,configured,date,balances};
  }

  function accountHasActivity(account){
    return !!account&&(
      state.assets.some(a=>a.accountId===account.id)||
      state.transactions.some(t=>t.accountId===account.id)||
      state.fx.some(f=>f.accountId===account.id)
    );
  }

  function applyMovements(accountId,bal,fromDate,toDate=null){
    const within=d=>d&&d>=fromDate&&(!toDate||d<=toDate);
    for(const t of state.transactions.filter(t=>t.accountId===accountId&&within(t.date))){
      if(!Object.prototype.hasOwnProperty.call(bal,t.currency))bal[t.currency]=0;
      const asset=state.assets.find(a=>a.id===t.assetId);
      const trade=(Number(t.qty)||0)*(Number(t.price)||0)*multiplier(asset);
      const amount=Number(t.amount)||0,fee=Number(t.fee)||0;
      if(t.type==='Deposit'||t.type==='Dividend'||t.type==='Interest')bal[t.currency]+=t.amount!=null?amount:trade;
      if(t.type==='Withdrawal'||t.type==='Fee'||t.type==='Tax'||t.type==='Margin Interest')bal[t.currency]-=t.amount!=null?amount:trade;
      if(t.type==='Buy')bal[t.currency]-=trade+fee;
      if(t.type==='Sell')bal[t.currency]+=trade-fee;
    }
    for(const f of state.fx.filter(f=>f.accountId===accountId&&within(f.date))){
      if(!Object.prototype.hasOwnProperty.call(bal,f.from))bal[f.from]=0;
      if(!Object.prototype.hasOwnProperty.call(bal,f.to))bal[f.to]=0;
      bal[f.from]-=(Number(f.fromAmount)||0)+(Number(f.fee)||0);
      bal[f.to]+=Number(f.toAmount)||0;
    }
    return bal;
  }

  function reconciledBalances(accountId,date=null){
    const cfg=accountConfig(accountId);
    if(!cfg.configured)return blankBalances();
    return applyMovements(accountId,{...cfg.balances},cfg.date,date);
  }

  function deltaBalances(accountId,date){
    const cfg=accountConfig(accountId);
    const start=cfg.date||TRACKING_START;
    return applyMovements(accountId,blankBalances(),start,date);
  }

  window.cashBalancesFor=cashBalancesFor=function(portfolioId=null){
    if(portfolioId)return reconciledBalances(portfolioId);
    const total=blankBalances();
    for(const account of state.accounts.filter(accountHasActivity)){
      const cfg=accountConfig(account.id);
      if(!cfg.configured)continue;
      const bal=reconciledBalances(account.id);
      for(const [c,v] of Object.entries(bal)){
        if(!Object.prototype.hasOwnProperty.call(total,c))total[c]=0;
        total[c]+=Number(v)||0;
      }
    }
    return total;
  };

  if(typeof previousCashBalancesAt==='function'){
    window.cashBalancesAt=cashBalancesAt=function(portfolioId,date){
      const cfg=accountConfig(portfolioId);
      if(cfg.configured)return reconciledBalances(portfolioId,date);
      return deltaBalances(portfolioId,date);
    };
  }

  function cashStatus(portfolioId=null){
    if(portfolioId){
      const cfg=accountConfig(portfolioId);
      return {complete:cfg.configured,configured:cfg.configured,date:cfg.date,missing:cfg.configured?[]:[cfg.account].filter(Boolean)};
    }
    const relevant=state.accounts.filter(accountHasActivity);
    const missing=relevant.filter(a=>!accountConfig(a.id).configured);
    return {complete:relevant.length>0&&missing.length===0,configured:missing.length===0,date:TRACKING_START,missing};
  }
  window.cashReconciliationStatus=cashStatus;

  if(typeof previousSummaryFor==='function'){
    window.summaryFor=summaryFor=function(portfolioId=null){
      const s=previousSummaryFor(portfolioId);
      const status=cashStatus(portfolioId);
      const cashBal=cashBalancesFor(portfolioId);
      const cash=Object.entries(cashBal).reduce((sum,[c,v])=>sum+convert(v,c),0);
      const net=Number(s.invested||0)+cash;
      return {
        ...s,
        cashBal,
        cash,
        net,
        exposure:net?Number(s.invested||0)/net:0,
        cashReconciled:status.complete,
        cashMissingAccounts:status.missing.map(a=>a?.name).filter(Boolean)
      };
    };
  }

  const style=document.createElement('style');
  style.textContent=`
    .cash-reconcile-note{margin:12px 0 0;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#151519;color:var(--muted);font-size:12px;line-height:1.45}
    .cash-reconcile-note strong{color:var(--text)}
    .cash-baseline-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .cash-baseline-status{font-size:12px;color:var(--muted);line-height:1.45}
    .cash-unreconciled{padding:16px 12px;color:var(--muted);font-size:13px;line-height:1.5}
    @media(max-width:520px){.cash-baseline-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function installOpeningCashButton(){
    const head=document.querySelector('#tab-cash .sticky-section-head');
    if(!head||document.getElementById('openingCashBtn'))return;
    const add=head.querySelector('.primary-btn');
    const wrap=document.createElement('div');
    wrap.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end';
    if(add){
      add.parentElement.insertBefore(wrap,add);
      wrap.appendChild(add);
    }else head.appendChild(wrap);
    const btn=document.createElement('button');
    btn.id='openingCashBtn';
    btn.type='button';
    btn.className='ghost-btn';
    btn.textContent='Opening Cash';
    btn.addEventListener('click',()=>window.openOpeningCashModal());
    wrap.insertBefore(btn,wrap.firstChild);
  }

  function ensureModal(){
    if(document.getElementById('openingCashModal'))return;
    const modal=document.createElement('div');
    modal.id='openingCashModal';
    modal.className='modal-overlay hidden';
    modal.innerHTML=`<div class="modal-wrap"><form class="modal-card" onsubmit="return false;">
      <div class="section-head">
        <div><div class="brand">CASH BASELINE</div><h3>Opening Cash</h3></div>
        <button id="closeOpeningCashModal" type="button" class="icon-btn">×</button>
      </div>
      <div class="cash-reconcile-note">Enter the actual cash / margin balance at the start of 2026. This is separate from Opening NAV and will be rolled forward using only transactions from 1 Jan 2026 onward.</div>
      <label>Baseline Date<input id="openingCashDate" type="date" value="2026-01-01" /></label>
      <div class="cash-baseline-grid">
        ${CURRENCIES.map(c=>`<label>${c}<input id="openingCash_${c}" type="number" step="0.01" placeholder="0" /></label>`).join('')}
      </div>
      <div id="openingCashStatus" class="cash-baseline-status"></div>
      <button id="saveOpeningCashBtn" type="button" class="primary-btn full">Save Opening Cash</button>
      <button id="clearOpeningCashBtn" type="button" class="ghost-btn full">Mark as Unreconciled</button>
    </form></div>`;
    document.body.appendChild(modal);
    document.getElementById('closeOpeningCashModal').addEventListener('click',()=>closeModal('openingCashModal'));
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal('openingCashModal');});
    document.getElementById('saveOpeningCashBtn').addEventListener('click',saveOpeningCash);
    document.getElementById('clearOpeningCashBtn').addEventListener('click',clearOpeningCash);
  }

  window.openOpeningCashModal=()=>{
    if(!currentPortfolioId)return;
    ensureModal();
    const cfg=accountConfig(currentPortfolioId);
    document.getElementById('openingCashDate').value=cfg.date||TRACKING_START;
    for(const c of CURRENCIES){
      document.getElementById('openingCash_'+c).value=cfg.configured?Number(cfg.balances[c]||0):'';
    }
    document.getElementById('openingCashStatus').textContent=cfg.configured
      ?'Opening cash is reconciled. Current cash is calculated from this baseline plus subsequent activity.'
      :'Opening cash is not set. Cash / Margin is intentionally hidden to avoid showing a false balance.';
    document.getElementById('clearOpeningCashBtn').classList.toggle('hidden',!cfg.configured);
    openModal('openingCashModal');
  };

  function saveOpeningCash(){
    if(!currentPortfolioId)return;
    const account=state.accounts.find(a=>a.id===currentPortfolioId);
    if(!account)return;
    const date=document.getElementById('openingCashDate').value||TRACKING_START;
    const balances={};
    for(const c of CURRENCIES){
      const raw=document.getElementById('openingCash_'+c).value;
      const n=raw===''?0:Number(raw);
      if(!Number.isFinite(n))return toast(`Enter a valid ${c} opening balance.`,true);
      balances[c]=n;
    }
    account.cashBaselineConfigured=true;
    account.cashBaselineDate=date;
    account.openingCash=balances;
    save();
    closeModal('openingCashModal');
    renderAll();
    if(typeof window.renderOverallReturn==='function')setTimeout(()=>window.renderOverallReturn({force:false}),0);
    toast('Opening cash baseline saved.');
  }

  function clearOpeningCash(){
    if(!currentPortfolioId)return;
    const account=state.accounts.find(a=>a.id===currentPortfolioId);
    if(!account)return;
    account.cashBaselineConfigured=false;
    delete account.openingCash;
    account.cashBaselineDate=TRACKING_START;
    save();
    closeModal('openingCashModal');
    renderAll();
    toast('Cash marked as unreconciled.');
  }

  function decorateCashTab(){
    if(!currentPortfolioId)return;
    installOpeningCashButton();
    const cfg=accountConfig(currentPortfolioId);
    const balances=document.getElementById('portfolioCashBalances');
    const panel=balances?.closest('.panel');
    const hint=panel?.querySelector('.section-head .muted');
    if(!cfg.configured){
      if(hint)hint.textContent='Unreconciled · opening cash required';
      if(balances)balances.innerHTML='<div class="cash-unreconciled"><strong>Cash / Margin is unreconciled.</strong><br>Pre-2026 cash history is incomplete, so the app will not treat the implied residual as a real margin balance. Set Opening Cash to start tracking from 1 Jan 2026.</div>';
    }else{
      if(hint)hint.textContent=`Opening cash · ${cfg.date}`;
    }
  }

  if(typeof previousRenderCashTab==='function'){
    window.renderCashTab=renderCashTab=function(){
      previousRenderCashTab();
      decorateCashTab();
    };
  }

  function ensureStatusNote(scope){
    const id=scope==='home'?'homeCashReconcileNote':'portfolioCashReconcileNote';
    if(document.getElementById(id))return document.getElementById(id);
    const card=scope==='home'
      ?document.querySelector('#homeView .summary-card')
      :document.querySelector('#tab-overview .portfolio-summary');
    if(!card)return null;
    const el=document.createElement('div');
    el.id=id;
    el.className='cash-reconcile-note';
    card.appendChild(el);
    return el;
  }

  function decorateHome(){
    const status=cashStatus();
    const cash=document.getElementById('homeCash');
    const exposure=document.getElementById('homeExposure');
    const note=ensureStatusNote('home');
    if(!status.complete){
      if(cash){cash.textContent='Unreconciled';cash.className='';}
      if(exposure){exposure.textContent='—';exposure.className='';}
      if(note){
        note.classList.remove('hidden');
        note.innerHTML=`<strong>Cash not fully reconciled.</strong> Missing opening cash: ${esc(status.missing.map(a=>a.name).join(', '))}. Net Assets currently excludes those opening cash balances; Overall Performance is anchored separately to the 1 Jan 2026 Opening NAV.`;
      }
      setTimeout(()=>{
        document.querySelector('#homeAllocationList [data-cash-allocation]')?.remove();
      },0);
    }else if(note){
      note.classList.add('hidden');
    }
  }

  function decoratePortfolio(){
    if(!currentPortfolioId)return;
    const status=cashStatus(currentPortfolioId);
    const cash=document.getElementById('portfolioCash');
    const exposure=document.getElementById('portfolioExposure');
    const note=ensureStatusNote('portfolio');
    if(!status.complete){
      if(cash){cash.textContent='Unreconciled';cash.className='';}
      if(exposure){exposure.textContent='—';exposure.className='';}
      if(note){
        note.classList.remove('hidden');
        note.innerHTML='<strong>Cash not reconciled.</strong> Net Assets excludes opening cash until an Opening Cash baseline is entered.';
      }
    }else if(note){
      note.classList.add('hidden');
    }
  }

  if(typeof previousRenderHome==='function'){
    window.renderHome=renderHome=function(){
      previousRenderHome();
      decorateHome();
    };
  }
  if(typeof previousRenderPortfolio==='function'){
    window.renderPortfolio=renderPortfolio=function(){
      previousRenderPortfolio();
      decoratePortfolio();
      decorateCashTab();
    };
  }

  ensureModal();
  installOpeningCashButton();
  renderAll();
})();