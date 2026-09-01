(()=>{
  if(window.__portfolioHomeDetailCleanupInstalledV232)return;
  window.__portfolioHomeDetailCleanupInstalledV232=true;

  const REMOVE_LABELS=new Set(['Weight','Open P/L']);

  function cleanup(){
    const detail=document.getElementById('homeAllocationDetail');
    if(!detail)return;
    [...detail.querySelectorAll('.home-holding-detail-cell')].forEach(cell=>{
      const label=cell.querySelector('.home-holding-detail-label')?.textContent?.trim();
      if(REMOVE_LABELS.has(label))cell.remove();
    });
  }

  const target=document.getElementById('homeAllocationDetail');
  if(target){
    const observer=new MutationObserver(cleanup);
    observer.observe(target,{childList:true,subtree:true});
  }

  const originalRenderHome=window.renderHome;
  if(typeof originalRenderHome==='function'){
    window.renderHome=renderHome=function(){
      originalRenderHome();
      setTimeout(cleanup,0);
    };
  }

  document.addEventListener('click',event=>{
    if(event.target.closest?.('#homeAllocationList .home-allocation-row'))setTimeout(cleanup,0);
  });

  cleanup();
})();
