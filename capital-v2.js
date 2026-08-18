(()=>{
  if(window.__portfolioCapitalInstalledV215)return;
  window.__portfolioCapitalInstalledV215=true;

  const originalSummaryFor=window.summaryFor;
  const originalRenderHome=window.renderHome;
  const originalRenderPortfolio=window.renderPortfolio;

  function capitalForAccount(account){
    const configured=!!account?.capitalConfigured;
    const amount=Number(account?.netContributions)||0;
    const currency=account?.capitalCurrency||'HKD';
    return {configured,amount,currency,converted:configured?convert(amount,currency):0};
  }

  function accountHasActivity(account){
    if(!account)return false;
    if(account.capitalConfigured)return true;
    if(state.assets.some(a=>a.accountId===account.id))return true;
    if(state.transactions.some(t=>t.accountId===account.id))return true;
    if(state.fx.some(f=>f.accountId===account.id))return true;
    return false;
  }

  function capitalSummary(portfolioId=null){
    const base=originalSummaryFor(portfolioId);
    if(portfolioId){
      const account=state.accounts.find(a=>a.id===portfolioId);
      const cap=capitalForAccount(account);
      const lifetimePL=cap.configured?base.net-cap.converted:null;
      return {...base,capitalComplete:cap.configured,netContributions:cap.configured?cap.converted:null,lifetimePL,trackedPL:base.totalPL};
    }

    const relevant=state.accounts.filter(accountHasActivity);
    const complete=relevant.length>0&&relevant.every(a=>capitalForAccount(a).configured);
    const netContributions=relevant.reduce((sum,a)=>sum+capitalForAccount(a).converted,0);
    return {
      ...base,
      capitalComplete:complete,
      capitalConfiguredCount:relevant.filter(a=>capitalForAccount(a).configured).length,
      capitalRequiredCount:relevant.length,
      netContributions:complete?netContributions:null,
      lifetimePL:complete?base.net-netContributions:null,
      trackedPL:base.totalPL
    };
  }
  window.capitalSummary=capitalSummary;

  function todayPLForHoldings(hs){
    const stockHoldings=(hs||[]).filter(h=>h.type==='stock');
    const options=(hs||[]).filter(h=>h.type==='option');
    const eligible=stockHoldings.filter(h=>
      Number.isFinite(Number(h.price)) &&
      Number.isFinite(Number(h.previousClose)) &&
      Number(h.previousClose)>0
    );
    const value=eligible.reduce((sum,h)=>{
      const local=(Number(h.qty)||0)*(Number(h.price)-Number(h.previousClose))*multiplier(h);
      return sum+convert(local,h.currency);
    },0);
    return {value,eligibleCount:eligible.length,stockCount:stockHoldings.length,optionCount:options.length};
  }

  const style=document.createElement('style');
  style.textContent=`
    .capital-note{font-size:12px;color:var(--muted);line-height:1.45;margin:-4px 0 12px}
    .capital-status{font-size:12px;color:var(--muted);margin-top:6px}
  `;
  document.head.appendChild(style);

  function addSummaryMetric(grid,id,label){
    if(!grid||document.getElementById(id))return;
    const cell=document.createElement('div');
    cell.innerHTML=`<span>${label}</span><strong id="${id}">—</strong>`;
    grid.appendChild(cell);
  }

  function removeSummaryMetric(id){
    const el=document.getElementById(id);
    if(el?.parentElement)el.parentElement.remove();
  }

  function renameMetric(id,label){
    const el=document.getElementById(id);
    const metricLabel=el?.parentElement?.querySelector('span');
    if(metricLabel)metricLabel.textContent=label;
  }

  function orderSummaryMetrics(grid,ids){
    if(!grid)return;
    ids.forEach(id=>{
      const el=document.getElementById(id);
      if(el?.parentElement)grid.appendChild(el.parentElement);
    });
  }

  function setMetric(id,value,number=null){
    const el=document.getElementById(id);
    if(!el)return;
    el.textContent=value;
    if(number===null){el.className='';return;}
    el.className=number<0?'negative':'positive';
  }

  function decorateHome(){
    const s=capitalSummary();
    const day=todayPLForHoldings(s.hs);
    const lifetime=document.getElementById('homeTotalPL');
    const lifetimeLabel=lifetime?.parentElement?.querySelector('span');
    if(lifetimeLabel)lifetimeLabel.textContent='Lifetime P/L';
    renameMetric('homeInvested','Market Value');

    if(s.capitalComplete){
      setMetric('homeTotalPL',signedMoney(s.lifetimePL),s.lifetimePL);
    }else{
      const n=s.capitalRequiredCount||0,c=s.capitalConfiguredCount||0;
      setMetric('homeTotalPL',n?`Set capital (${c}/${n})`:'—');
    }

    const grid=lifetime?.closest('.summary-grid');
    addSummaryMetric(grid,'homeTodayPL','Today P/L');
    addSummaryMetric(grid,'homeNetContributions','Net Contributions');
    removeSummaryMetric('homeTrackedPL');

    renameMetric('homeTodayPL',day.optionCount?'Today P/L (stocks)':'Today P/L');
    if(day.eligibleCount){
      setMetric('homeTodayPL',signedMoney(day.value),day.value);
    }else if(day.stockCount){
      setMetric('homeTodayPL','Refresh prices');
    }else{
      setMetric('homeTodayPL','—');
    }

    setMetric('homeNetContributions',s.capitalComplete?money(s.netContributions):(s.capitalRequiredCount?`${s.capitalConfiguredCount}/${s.capitalRequiredCount} set`:'—'));

    orderSummaryMetrics(grid,[
      'homeTotalPL','homeTodayPL',
      'homeCash','homeInvested',
      'homeNetContributions','homeExposure'
    ]);

    const cards=[...document.querySelectorAll('#portfolioCards .portfolio-card')];
    cards.forEach((card,index)=>{
      const account=state.accounts[index];
      if(!account)return;
      const p=capitalSummary(account.id);
      const metas=card.querySelectorAll('.portfolio-card-meta');
      const pl=metas[0]?.lastElementChild;
      if(!pl)return;
      if(p.capitalComplete){
        pl.textContent=`Lifetime ${signedMoney(p.lifetimePL)}`;
        pl.className=p.lifetimePL<0?'negative':'positive';
      }else{
        pl.textContent='Capital not set';
        pl.className='';
      }
    });
  }

  function decoratePortfolio(){
    if(!currentPortfolioId)return;
    const s=capitalSummary(currentPortfolioId);
    const lifetime=document.getElementById('portfolioPL');
    const lifetimeLabel=lifetime?.parentElement?.querySelector('span');
    if(lifetimeLabel)lifetimeLabel.textContent='Lifetime P/L';
    renameMetric('portfolioInvested','Market Value');
    if(s.capitalComplete)setMetric('portfolioPL',signedMoney(s.lifetimePL),s.lifetimePL);
    else setMetric('portfolioPL','Set capital');

    const grid=lifetime?.closest('.summary-grid');
    addSummaryMetric(grid,'portfolioNetContributions','Net Contributions');
    addSummaryMetric(grid,'portfolioTrackedPL','Tracked P/L');
    setMetric('portfolioNetContributions',s.capitalComplete?money(s.netContributions):'—');
    setMetric('portfolioTrackedPL',signedMoney(s.trackedPL),s.trackedPL);
  }

  window.renderHome=renderHome=function(){
    originalRenderHome();
    decorateHome();
  };

  window.renderPortfolio=renderPortfolio=function(){
    originalRenderPortfolio();
    decoratePortfolio();
  };

  function installCapitalUI(){
    const actions=document.querySelector('#portfolioHeader .portfolio-header-actions');
    if(actions&&!document.getElementById('capitalBtn')){
      const btn=document.createElement('button');
      btn.id='capitalBtn';
      btn.type='button';
      btn.className='icon-text-btn';
      btn.textContent='Capital';
      btn.addEventListener('click',()=>window.openCapitalModal());
      const currency=document.getElementById('portfolioCurrency');
      actions.insertBefore(btn,currency||null);
    }

    if(document.getElementById('capitalModal'))return;
    const modal=document.createElement('div');
    modal.id='capitalModal';
    modal.className='modal-overlay hidden';
    modal.innerHTML=`<div class="modal-wrap"><form class="modal-card" onsubmit="return false;">
      <div class="section-head"><h3>Capital Baseline</h3><button id="closeCapitalModalBtn" type="button" class="icon-btn">×</button></div>
      <div class="capital-note">Enter cumulative net contributions only: total deposits minus total withdrawals. Deposit dates are not required. This is used for Lifetime P/L, not XIRR or annualized return.</div>
      <label>Net Contributions<input id="capitalAmount" type="number" step="0.01" placeholder="e.g. 300000" /></label>
      <label>Currency<select id="capitalCurrency"><option>HKD</option><option>USD</option><option>KRW</option></select></label>
      <div id="capitalPreview" class="capital-status"></div>
      <button id="saveCapitalBtn" type="button" class="primary-btn full">Save Capital Baseline</button>
      <button id="clearCapitalBtn" type="button" class="ghost-btn full">Clear Capital Baseline</button>
    </form></div>`;
    document.body.appendChild(modal);
    document.getElementById('closeCapitalModalBtn').addEventListener('click',()=>closeModal('capitalModal'));
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal('capitalModal');});
    document.getElementById('saveCapitalBtn').addEventListener('click',saveCapitalBaseline);
    document.getElementById('clearCapitalBtn').addEventListener('click',clearCapitalBaseline);
  }

  function updateCapitalPreview(){
    if(!currentPortfolioId)return;
    const amount=Number(document.getElementById('capitalAmount')?.value);
    const currency=document.getElementById('capitalCurrency')?.value||'HKD';
    const base=originalSummaryFor(currentPortfolioId);
    const el=document.getElementById('capitalPreview');
    if(!el)return;
    if(!Number.isFinite(amount)){el.textContent='';return;}
    const contribution=convert(amount,currency);
    const profit=base.net-contribution;
    el.textContent=`At current Net Assets, Lifetime P/L would be ${signedMoney(profit)}.`;
  }

  window.openCapitalModal=()=>{
    if(!currentPortfolioId)return;
    installCapitalUI();
    const account=state.accounts.find(a=>a.id===currentPortfolioId);
    if(!account)return;
    document.getElementById('capitalAmount').value=account.capitalConfigured?Number(account.netContributions)||0:'';
    document.getElementById('capitalCurrency').value=account.capitalCurrency||displayCurrency||'HKD';
    document.getElementById('clearCapitalBtn').classList.toggle('hidden',!account.capitalConfigured);
    updateCapitalPreview();
    openModal('capitalModal');
  };

  function saveCapitalBaseline(){
    if(!currentPortfolioId)return;
    const account=state.accounts.find(a=>a.id===currentPortfolioId);
    if(!account)return;
    const amount=Number(document.getElementById('capitalAmount').value);
    const currency=document.getElementById('capitalCurrency').value;
    if(!Number.isFinite(amount))return toast('Enter a valid net contribution amount.',true);
    account.netContributions=amount;
    account.capitalCurrency=currency;
    account.capitalConfigured=true;
    save();
    closeModal('capitalModal');
    renderAll();
    toast('Capital baseline saved.');
  }

  function clearCapitalBaseline(){
    if(!currentPortfolioId)return;
    const account=state.accounts.find(a=>a.id===currentPortfolioId);
    if(!account)return;
    if(!confirm(`Clear the capital baseline for "${account.name}"?`))return;
    delete account.netContributions;
    delete account.capitalCurrency;
    account.capitalConfigured=false;
    save();
    closeModal('capitalModal');
    renderAll();
    toast('Capital baseline cleared.');
  }

  installCapitalUI();
  document.getElementById('capitalAmount')?.addEventListener('input',updateCapitalPreview);
  document.getElementById('capitalCurrency')?.addEventListener('change',updateCapitalPreview);
  renderAll();
})();