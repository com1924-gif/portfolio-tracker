(async()=>{
  const files=['core-v2.js?v=2.24','ui-v2.js?v=2.24','allocation-all-v2.js?v=2.24','actions-v2.js?v=2.24','lifecycle-v2.js?v=2.24','holding-cost-v2.js?v=2.24','delete-guard-v2.js?v=2.24','ledger-v2.js?v=2.24','capital-v2.js?v=2.24','currency-eur-v2.js?v=2.24','reorder-v2.js?v=2.24','swipe-nav-v2.js?v=2.24','sync-v2.js?v=2.24','sync-health-v2.js?v=2.24','live-fx-v2.js?v=2.24','prices-v2.js?v=2.24','history-v2.js?v=2.24','history-style-v2.js?v=2.24','performance-v2.js?v=2.24','performance-cleanup-v2.js?v=2.24','benchmark-live-refresh-v2.js?v=2.24','home-pl-percent-v2.js?v=2.24','home-allocation-detail-v2.js?v=2.24','home-average-cost-native-v2.js?v=2.24','home-detail-cleanup-v2.js?v=2.24','home-allocation-cash-v2.js?v=2.24','option-close-v2.js?v=2.24'];
  for(const src of files){
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;
      s.onload=resolve;
      s.onerror=()=>reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(s);
    });
  }
})().catch(err=>{
  console.error(err);
  const el=document.getElementById('toast');
  if(el){
    el.textContent='App failed to load. Please refresh.';
    el.classList.remove('hidden');
    el.classList.add('error');
  }
});