(async()=>{
  const files=['core-v2.js?v=2.23.4','ui-v2.js?v=2.23.4','allocation-all-v2.js?v=2.23.4','actions-v2.js?v=2.23.4','lifecycle-v2.js?v=2.23.4','holding-cost-v2.js?v=2.23.4','delete-guard-v2.js?v=2.23.4','ledger-v2.js?v=2.23.4','capital-v2.js?v=2.23.4','currency-eur-v2.js?v=2.23.4','reorder-v2.js?v=2.23.4','swipe-nav-v2.js?v=2.23.4','sync-v2.js?v=2.23.4','sync-health-v2.js?v=2.23.4','live-fx-v2.js?v=2.23.4','prices-v2.js?v=2.23.4','history-v2.js?v=2.23.4','history-style-v2.js?v=2.23.4','performance-v2.js?v=2.23.4','performance-cleanup-v2.js?v=2.23.4','benchmark-live-refresh-v2.js?v=2.23.4','home-pl-percent-v2.js?v=2.23.4','home-allocation-detail-v2.js?v=2.23.4','home-average-cost-native-v2.js?v=2.23.4','home-detail-cleanup-v2.js?v=2.23.4','home-allocation-cash-v2.js?v=2.23.4'];
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