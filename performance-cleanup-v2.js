(()=>{
  if(window.__portfolioPerformanceCleanupInstalledV219)return;
  window.__portfolioPerformanceCleanupInstalledV219=true;

  function removeBestWorst(){
    document.getElementById('performanceBestWorst')?.remove();
  }

  removeBestWorst();

  const originalShowPortfolioTab=window.showPortfolioTab;
  if(typeof originalShowPortfolioTab==='function'){
    window.showPortfolioTab=tab=>{
      originalShowPortfolioTab(tab);
      if(tab==='performance')removeBestWorst();
    };
  }

  const originalRenderAll=window.renderAll||renderAll;
  window.renderAll=renderAll=function(){
    originalRenderAll();
    removeBestWorst();
  };
})();
