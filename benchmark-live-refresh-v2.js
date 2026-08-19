(()=>{
  if(window.__portfolioBenchmarkLiveRefreshInstalledV2211)return;
  window.__portfolioBenchmarkLiveRefreshInstalledV2211=true;

  const REFRESH_MS=5*60*1000;
  let timer=null;

  function performanceActive(){
    return !!document.getElementById('tab-performance')?.classList.contains('active');
  }

  async function refresh(){
    if(!performanceActive()||!currentPortfolioId)return;
    try{
      if(typeof refreshStockPrices==='function')await refreshStockPrices({force:true,silent:true});
    }catch{}
    try{
      if(typeof window.renderBenchmark==='function')await window.renderBenchmark({force:true});
    }catch(err){console.warn('Live benchmark refresh failed',err);}
  }

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('[data-tab="performance"]'))setTimeout(refresh,250);
    if(event.target?.closest?.('#refreshPerformanceBtn'))setTimeout(refresh,250);
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&performanceActive())setTimeout(refresh,300);
  });

  timer=setInterval(refresh,REFRESH_MS);
})();
