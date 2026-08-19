(()=>{
  if(window.__portfolioHoldingCostInstalledV217)return;
  window.__portfolioHoldingCostInstalledV217=true;

  const originalRenderHoldingRows=window.renderHoldingRows;
  if(typeof originalRenderHoldingRows!=='function')return;

  window.renderHoldingRows=renderHoldingRows=function(target,hs,net,clickable){
    originalRenderHoldingRows(target,hs,net,clickable);
    const el=document.getElementById(target);
    if(!el||!Array.isArray(hs))return;
    const rows=[...el.querySelectorAll('.holding-row')];
    rows.forEach((row,index)=>{
      const holding=hs[index];
      if(!holding)return;
      const priceColumn=row.children?.[1];
      const sub=priceColumn?.querySelector('.holding-sub');
      if(sub)sub.textContent=`Cost ${money(holding.avgCost,holding.currency)}`;
    });
  };

  renderAll();
})();
