(()=>{
  if(window.__portfolioCapitalInstalledV22525)return;
  window.__portfolioCapitalInstalledV22525=true;

  const OPENING_DATE='2026-01-01';
  const originalSummaryFor=window.summaryFor;
  const originalRenderHome=window.renderHome;
  const originalRenderPortfolio=window.renderPortfolio;

  function historicalForAccount(account){
    const configured=!!account?.historicalBaselineConfigured;
    const currency=account?.historicalCurrency||'HKD';
    const principal=Number(account?.pre2025Principal)||0;
    const profit2025=Number(account?.profit2025)||0;
    return {
      configured,
      currency,
      principal,
      profit2025,
      openingNav:principal+profit2025,
      principalConverted:configured?convert(principal,currency):0,
      profit2025Converted:configured?convert(profit2025,currency):0,
      openingNavConverted:configured?convert(principal+profit2025,currency):0
    };
  }
  window.historicalBaselineForAccount=id=>{
    const account=state.accounts.find(a=>a.id===id);
    return account?historicalForAccount(account):null;
  };

  function externalFlowsSince2026(accountId){
    return state.transactions
      .filter(t=>t.accountId===accountId&&['Deposit','Withdrawal'].includes(t.type)&&(t.date||'')>=OPENING_DATE)
      .reduce((sum,t)=>{
        const amount=convert(Number(t.amount)||0,t.currency||'HKD');
        return sum+(t.type==='Deposit'?amount:-amount);
      },0);
  }

  function accountHasActivity(account){
    if(!account)return false;
    if(account.historicalBaselineConfigured)return true;
    if(state.assets.some(a=>a.accountId===account.id))return true;
    if(state.transactions.some(t=>t.accountId===account.id))return true;
    if(state.fx.some(f=>f.accountId===account.id))return true;
    return false;
  }

  function capitalSummary(portfolioId=null){
    const base=originalSummaryFor(portfolioId);

    if(portfolioId){
      const account=state.accounts.find(a=>a.id===portfolioId);
      const hist=historicalForAccount(account);
      const flows2026=externalFlowsSince2026(portfolioId);
      if(!hist.configured){
        return {
          ...base,
          capitalComplete:false,
          historicalComplete:false,
          netContributions:null,
          lifetimePL:null,
          profit2025:null,
          profit2026:null,
          openingNav2026:null,
          flows2026,
          trackedPL:base.totalPL
        };
      }
      const netContributions=hist.principalConverted+flows2026;
      const lifetimePL=base.net-netContributions;
      const profit2026=base.net-hist.openingNavConverted-flows2026;
      return {
        ...base,
        capitalComplete:true,
        historicalComplete:true,
        netContributions,
        lifetimePL,
        profit2025:hist.profit2025Converted,
        profit2026,
        openingNav2026:hist.openingNavConverted,
        historicalPrincipal:hist.principalConverted,
        flows2026,
        trackedPL:base.totalPL
      };
    }

    const relevant=state.accounts.filter(accountHasActivity);
    const rows=relevant.map(account=>{
      const hist=historicalForAccount(account);
      const flows2026=externalFlowsSince2026(account.id);
      const baseAccount=originalSummaryFor(account.id);
      return {account,hist,flows2026,baseAccount};
    });
    const complete=relevant.length>0&&rows.every(x=>x.hist.configured);
    const configuredCount=rows.filter(x=>x.hist.configured).length;

    if(!complete){
      return {
        ...base,
        capitalComplete:false,
        historicalComplete:false,
        capitalConfiguredCount:configuredCount,
        capitalRequiredCount:relevant.length,
        netContributions:null,
        lifetimePL:null,
        profit2025:null,
        profit2026:null,
        openingNav2026:null,
        trackedPL:base.totalPL
      };
    }

    const principal=rows.reduce((s,x)=>s+x.hist.principalConverted,0);
    const profit2025=rows.reduce((s,x)=>s+x.hist.profit2025Converted,0);
    const openingNav2026=rows.reduce((s,x)=>s+x.hist.openingNavConverted,0);
    const flows2026=rows.reduce((s,x)=>s+x.flows2026,0);
    const netContributions=principal+flows2026;
    const lifetimePL=base.net-netContributions;
    const profit2026=base.net-openingNav2026-flows2026;

    return {
      ...base,
      capitalComplete:true,
      historicalComplete:true,
      capitalConfiguredCount:configuredCount,
      capitalRequiredCount:relevant.length,
      historicalPrincipal:principal,
      profit2025,
      profit2026,
      openingNav2026,
      flows2026,
      netContributions,
      lifetimePL,
      trackedPL:base.totalPL
    };
  }
  window.capitalSummary=capitalSummary;

  function todayPLForHoldings(hs){
    const stocks=(hs||[]).filter(h=>h.type==='stock');
    const options=(hs||[]).filter(h=>h.type==='option');
    const eligible=stocks.filter(h=>
      Number.isFinite(Number(h.price))&&
      Number.isFinite(Number(h.previousClose))&&
      Number(h.previousClose)>0
    );
    const value=eligible.reduce((sum,h)=>{
      const local=(Number(h.qty)||0)*(Number(h.price)-Number(h.previousClose))*multiplier(h);
      return sum+convert(local,h.currency);
    },0);
    return {value,eligibleCount:eligible.length,stockCount:stocks.length,optionCount:options.length};
  }

  const style=document.createElement('style');
  style.textContent=`
    .capital-note{font-size:12px;color:var(--muted);line-height:1.5;margin:-4px 0 12px}
    .capital-status{font-size:12px;color:var(--muted);line-height:1.5;margin-top:6px}
    .historical-preview{border:1px solid var(--line);border-radius:13px;background:#111115;padding:11px 12px;display:grid;gap:7px}
    .historical-preview-row{display:flex;justify-content:space-between;gap:12px;font-size:12px}
    .historical-preview-row span{color:var(--muted)}
    .historical-preview-row strong{font-size:13px}
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

    if(s.capitalComplete)setMetric('homeTotalPL',signedMoney(s.lifetimePL),s.lifetimePL);
    else{
      const n=s.capitalRequiredCount||0,c=s.capitalConfiguredCount||0;
      setMetric('homeTotalPL',n?`Set history (${c}/${n})`:'—');
    }

    const grid=lifetime?.closest('.summary-grid');
    addSummaryMetric(grid,'homeTodayPL','Today P/L');
    addSummaryMetric(grid,'home2025PL','2025 P/L');
    addSummaryMetric(grid,'home2026PL','2026 YTD P/L');
    addSummaryMetric(grid,'homeNetContributions','Net Contributions');
    removeSummaryMetric('homeTrackedPL');

    renameMetric('homeTodayPL',day.optionCount?'Today P/L (stocks)':'Today P/L');
    if(day.eligibleCount)setMetric('homeTodayPL',signedMoney(day.value),day.value);
    else if(day.stockCount)setMetric('homeTodayPL','Refresh prices');
    else setMetric('homeTodayPL','—');

    setMetric('home2025PL',s.capitalComplete?signedMoney(s.profit2025):'—',s.capitalComplete?s.profit2025:null);
    setMetric('home2026PL',s.capitalComplete?signedMoney(s.profit2026):'—',s.capitalComplete?s.profit2026:null);
    setMetric('homeNetContributions',s.capitalComplete?money(s.netContributions):(s.capitalRequiredCount?`${s.capitalConfiguredCount}/${s.capitalRequiredCount} set`:'—'));

    orderSummaryMetrics(grid,[
      'homeTotalPL','homeTodayPL','home2025PL','home2026PL',
      'homeCash','homeInvested','homeNetContributions','homeExposure'
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
        pl.textContent='History not set';
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
    else setMetric('portfolioPL','Set history');

    const grid=lifetime?.closest('.summary-grid');
    addSummaryMetric(grid,'portfolio2025PL','2025 P/L');
    addSummaryMetric(grid,'portfolio2026PL','2026 YTD P/L');
    addSummaryMetric(grid,'portfolioOpeningNAV','2026 Opening NAV');
    addSummaryMetric(grid,'portfolioNetContributions','Net Contributions');
    addSummaryMetric(grid,'portfolioTrackedPL','Tracked P/L');

    setMetric('portfolio2025PL',s.capitalComplete?signedMoney(s.profit2025):'—',s.capitalComplete?s.profit2025:null);
    setMetric('portfolio2026PL',s.capitalComplete?signedMoney(s.profit2026):'—',s.capitalComplete?s.profit2026:null);
    setMetric('portfolioOpeningNAV',s.capitalComplete?money(s.openingNav2026):'—');
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
      btn.textContent='History';
      btn.addEventListener('click',()=>window.openCapitalModal());
      const currency=document.getElementById('portfolioCurrency');
      actions.insertBefore(btn,currency||null);
    }else if(document.getElementById('capitalBtn')){
      document.getElementById('capitalBtn').textContent='History';
    }

    const existing=document.getElementById('capitalModal');
    if(existing)existing.remove();

    const modal=document.createElement('div');
    modal.id='capitalModal';
    modal.className='modal-overlay hidden';
    modal.innerHTML=`<div class="modal-wrap"><form class="modal-card" onsubmit="return false;">
      <div class="section-head">
        <div><div class="brand">HISTORICAL BASELINE</div><h3>Pre-2026 History</h3></div>
        <button id="closeCapitalModalBtn" type="button" class="icon-btn">×</button>
      </div>
      <div class="capital-note">Enter this portfolio's actual principal accumulated before 2025 and its full-year 2025 investment P/L. 2025 P/L is not treated as a contribution. 2026 deposits and withdrawals are taken from the dated cash ledger.</div>
      <label>Pre-2025 Principal<input id="historicalPrincipal" type="number" step="0.01" placeholder="0.00" /></label>
      <label>2025 P/L<input id="historicalProfit2025" type="number" step="0.01" placeholder="0.00" /></label>
      <label>Currency<select id="historicalCurrency"><option>HKD</option><option>USD</option><option>KRW</option><option>EUR</option></select></label>
      <div class="historical-preview">
        <div class="historical-preview-row"><span>Calculated 2026 Opening NAV</span><strong id="historicalOpeningPreview">—</strong></div>
        <div class="historical-preview-row"><span>2026 Net Deposit / Withdrawal</span><strong id="historicalFlowPreview">—</strong></div>
        <div class="historical-preview-row"><span>Lifetime Net Contributions</span><strong id="historicalContributionPreview">—</strong></div>
      </div>
      <div id="capitalPreview" class="capital-status"></div>
      <button id="saveCapitalBtn" type="button" class="primary-btn full">Save Historical Baseline</button>
      <button id="zeroCapitalBtn" type="button" class="ghost-btn full">Account started in 2026 · Use zero baseline</button>
      <button id="clearCapitalBtn" type="button" class="ghost-btn full">Clear Historical Baseline</button>
    </form></div>`;

    document.body.appendChild(modal);
    document.getElementById('closeCapitalModalBtn').addEventListener('click',()=>closeModal('capitalModal'));
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal('capitalModal');});
    document.getElementById('saveCapitalBtn').addEventListener('click',saveHistoricalBaseline);
    document.getElementById('zeroCapitalBtn').addEventListener('click',saveZeroBaseline);
    document.getElementById('clearCapitalBtn').addEventListener('click',clearHistoricalBaseline);
    ['historicalPrincipal','historicalProfit2025'].forEach(id=>document.getElementById(id).addEventListener('input',updateCapitalPreview));
    document.getElementById('historicalCurrency').addEventListener('change',updateCapitalPreview);
  }

  function updateCapitalPreview(){
    if(!currentPortfolioId)return;
    const principal=Number(document.getElementById('historicalPrincipal')?.value);
    const profit=Number(document.getElementById('historicalProfit2025')?.value);
    const currency=document.getElementById('historicalCurrency')?.value||'HKD';
    const opening=document.getElementById('historicalOpeningPreview');
    const flowEl=document.getElementById('historicalFlowPreview');
    const contributionEl=document.getElementById('historicalContributionPreview');
    const status=document.getElementById('capitalPreview');
    if(!opening||!flowEl||!contributionEl||!status)return;

    const p=Number.isFinite(principal)?principal:0;
    const pl=Number.isFinite(profit)?profit:0;
    const flows=externalFlowsSince2026(currentPortfolioId);
    const principalDisplay=convert(p,currency);
    const openingDisplay=convert(p+pl,currency);

    opening.textContent=money(openingDisplay);
    flowEl.textContent=signedMoney(flows);
    contributionEl.textContent=money(principalDisplay+flows);
    status.textContent=`Formula: ${money(principalDisplay)} principal + ${signedMoney(convert(pl,currency))} 2025 P/L = ${money(openingDisplay)} opening NAV.`;
  }

  window.openCapitalModal=()=>{
    if(!currentPortfolioId)return;
    const account=state.accounts.find(a=>a.id===currentPortfolioId);
    if(!account)return;
    const hist=historicalForAccount(account);
    document.getElementById('historicalPrincipal').value=hist.configured?hist.principal:'';
    document.getElementById('historicalProfit2025').value=hist.configured?hist.profit2025:'';
    document.getElementById('historicalCurrency').value=hist.currency||'HKD';
    document.getElementById('clearCapitalBtn').classList.toggle('hidden',!hist.configured);
    updateCapitalPreview();
    openModal('capitalModal');
  };

  function saveHistoricalBaseline(){
    if(!currentPortfolioId)return;
    const account=state.accounts.find(a=>a.id===currentPortfolioId);
    if(!account)return;
    const principal=Number(document.getElementById('historicalPrincipal').value);
    const profit2025=Number(document.getElementById('historicalProfit2025').value);
    const currency=document.getElementById('historicalCurrency').value||'HKD';
    if(!Number.isFinite(principal)||!Number.isFinite(profit2025))return toast('Enter valid principal and 2025 P/L amounts.',true);

    account.pre2025Principal=principal;
    account.profit2025=profit2025;
    account.historicalCurrency=currency;
    account.historicalBaselineConfigured=true;
    account.historicalBaselineDate=OPENING_DATE;

    delete account.netContributions;
    delete account.capitalCurrency;
    account.capitalConfigured=false;

    reconcileOverallOpeningNav();
    save();
    closeModal('capitalModal');
    renderAll();
    if(typeof window.renderOverallReturn==='function')setTimeout(()=>window.renderOverallReturn({force:false}),0);
    toast('Historical baseline saved.');
  }

  function saveZeroBaseline(){
    if(!currentPortfolioId)return;
    const account=state.accounts.find(a=>a.id===currentPortfolioId);
    if(!account)return;
    account.pre2025Principal=0;
    account.profit2025=0;
    account.historicalCurrency='HKD';
    account.historicalBaselineConfigured=true;
    account.historicalBaselineDate=OPENING_DATE;
    reconcileOverallOpeningNav();
    save();
    closeModal('capitalModal');
    renderAll();
    if(typeof window.renderOverallReturn==='function')setTimeout(()=>window.renderOverallReturn({force:false}),0);
    toast('Zero historical baseline saved.');
  }

  function clearHistoricalBaseline(){
    if(!currentPortfolioId)return;
    const account=state.accounts.find(a=>a.id===currentPortfolioId);
    if(!account)return;
    if(!confirm(`Clear the historical baseline for "${account.name}"?`))return;
    delete account.pre2025Principal;
    delete account.profit2025;
    delete account.historicalCurrency;
    delete account.historicalBaselineDate;
    account.historicalBaselineConfigured=false;
    save();
    closeModal('capitalModal');
    renderAll();
    toast('Historical baseline cleared.');
  }

  function reconcileOverallOpeningNav(){
    const relevant=state.accounts.filter(accountHasActivity);
    if(!relevant.length||!relevant.every(a=>historicalForAccount(a).configured))return;
    const totalHKD=relevant.reduce((sum,a)=>{
      const h=historicalForAccount(a);
      return sum+convert(h.openingNav,h.currency,'HKD');
    },0);
    state.settings=state.settings||{};
    state.settings.performanceBaseline={
      date:OPENING_DATE,
      value:totalHKD,
      currency:'HKD',
      sourceId:'account-historical-baselines'
    };
  }

  installCapitalUI();
  renderAll();
})();