(()=>{
  if(window.__portfolioHomeAverageCostNativeInstalledV231)return;
  window.__portfolioHomeAverageCostNativeInstalledV231=true;

  function selectedSymbol(){
    return document.querySelector('#homeAllocationList .home-allocation-row.active .allocation-name')?.textContent?.trim()||'';
  }

  function updateAverageCostCurrency(){
    const symbol=selectedSymbol();
    if(!symbol||typeof holdingsFor!=='function')return;

    const matches=holdingsFor().filter(h=>normalizeTicker(h.symbol)===normalizeTicker(symbol));
    if(!matches.length)return;

    const currency=matches[0].currency||displayCurrency;
    let nativeCost=0,units=0;
    matches.forEach(h=>{
      if((h.currency||currency)!==currency)return;
      nativeCost+=Number(h.cost)||0;
      units+=(Number(h.qty)||0)*multiplier(h);
    });
    if(!(units>0))return;

    const avgCost=nativeCost/units;
    const cells=[...document.querySelectorAll('#homeAllocationDetail .home-holding-detail-cell')];
    const cell=cells.find(el=>el.querySelector('.home-holding-detail-label')?.textContent?.trim()==='Average Cost');
    if(!cell)return;

    const value=cell.querySelector('.home-holding-detail-value');
    const sub=cell.querySelector('.home-holding-detail-sub');
    if(value)value.textContent=money(avgCost,currency);
    if(sub)sub.textContent=currency;
  }

  const originalRenderHome=window.renderHome;
  if(typeof originalRenderHome==='function'){
    window.renderHome=renderHome=function(){
      originalRenderHome();
      setTimeout(updateAverageCostCurrency,0);
    };
  }

  document.addEventListener('click',event=>{
    if(event.target.closest?.('#homeAllocationList .home-allocation-row'))setTimeout(updateAverageCostCurrency,0);
  });
  document.getElementById('homeCurrency')?.addEventListener('change',()=>setTimeout(updateAverageCostCurrency,0));

  setTimeout(updateAverageCostCurrency,0);
})();
