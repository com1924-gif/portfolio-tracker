(()=>{
  if(window.__portfolioLayoutInstalledV210)return;
  window.__portfolioLayoutInstalledV210=true;

  function applyOverviewLayout(){
    const home=document.getElementById('homeView');
    if(home){
      const allocation=document.getElementById('homeAllocationList')?.closest('.panel');
      const portfolios=document.getElementById('portfolioCards')?.closest('.panel');
      if(allocation&&portfolios&&allocation.nextElementSibling!==portfolios){
        home.insertBefore(allocation,portfolios);
      }
      const topHoldings=document.getElementById('homeHoldings')?.closest('.panel');
      if(topHoldings)topHoldings.remove();
    }

    const actions=document.querySelector('#portfolioHeader .portfolio-header-actions');
    if(actions&&!document.getElementById('deletePortfolioBtn')){
      const btn=document.createElement('button');
      btn.id='deletePortfolioBtn';
      btn.type='button';
      btn.className='icon-text-btn';
      btn.textContent='Delete';
      btn.style.color='var(--negative)';
      btn.addEventListener('click',()=>window.deleteCurrentPortfolio?.());
      const currency=document.getElementById('portfolioCurrency');
      actions.insertBefore(btn,currency||null);
    }
  }

  applyOverviewLayout();
  document.addEventListener('DOMContentLoaded',applyOverviewLayout,{once:true});
})();
