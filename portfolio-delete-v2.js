(()=>{
  if(window.__portfolioDeleteInstalledV210)return;
  window.__portfolioDeleteInstalledV210=true;

  window.deleteCurrentPortfolio=()=>{
    const id=currentPortfolioId;
    const portfolio=state.accounts.find(a=>a.id===id);
    if(!portfolio)return;

    const assets=state.assets.filter(a=>a.accountId===id);
    const assetIds=new Set(assets.map(a=>a.id));
    const transactions=state.transactions.filter(t=>t.accountId===id||assetIds.has(t.assetId));
    const fx=state.fx.filter(f=>f.accountId===id);
    const holdingCount=holdingsFor(id).length;
    const detail=[
      holdingCount?`${holdingCount} holding${holdingCount===1?'':'s'}`:'',
      transactions.length?`${transactions.length} transaction${transactions.length===1?'':'s'}`:'',
      fx.length?`${fx.length} FX record${fx.length===1?'':'s'}`:''
    ].filter(Boolean).join(', ');
    const warning=detail?`\n\nThis will remove ${detail}.`:'\n\nThis portfolio is empty.';
    if(!confirm(`Delete portfolio "${portfolio.name}"?${warning}\n\nA recovery backup will be kept in this browser.`))return;

    try{
      localStorage.setItem('portfolioTrackerLastDeletedPortfolio',JSON.stringify({
        deletedAt:new Date().toISOString(),portfolio,assets,transactions,fx
      }));
    }catch(err){
      console.warn('Could not save deletion backup',err);
      if(!confirm('A recovery backup could not be saved. Delete the portfolio anyway?'))return;
    }

    state.transactions=state.transactions.filter(t=>t.accountId!==id&&!assetIds.has(t.assetId));
    state.fx=state.fx.filter(f=>f.accountId!==id);
    state.assets=state.assets.filter(a=>a.accountId!==id);
    state.accounts=state.accounts.filter(a=>a.id!==id);
    currentPortfolioId=null;
    save();

    document.getElementById('portfolioView')?.classList.remove('active');
    document.getElementById('portfolioHeader')?.classList.add('hidden');
    document.getElementById('homeView')?.classList.add('active');
    document.getElementById('homeHeader')?.classList.remove('hidden');
    renderAll();
    toast('Portfolio deleted.');
  };
})();
