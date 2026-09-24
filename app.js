(async()=>{
  const files=['core-v2.js?v=2.23.5','ui-v2.js?v=2.23.5','allocation-all-v2.js?v=2.23.5','actions-v2.js?v=2.23.5','lifecycle-v2.js?v=2.23.5','holding-cost-v2.js?v=2.23.5','delete-guard-v2.js?v=2.23.5','ledger-v2.js?v=2.23.5','capital-v2.js?v=2.23.5','currency-eur-v2.js?v=2.23.5','reorder-v2.js?v=2.23.5','swipe-nav-v2.js?v=2.23.5','sync-v2.js?v=2.23.5','sync-health-v2.js?v=2.23.5','live-fx-v2.js?v=2.23.5','prices-v2.js?v=2.23.5','history-v2.js?v=2.23.5','history-style-v2.js?v=2.23.5','performance-v2.js?v=2.23.5','performance-cleanup-v2.js?v=2.23.5','benchmark-live-refresh-v2.js?v=2.23.5','home-pl-percent-v2.js?v=2.23.5','home-allocation-detail-v2.js?v=2.23.5','home-average-cost-native-v2.js?v=2.23.5','home-detail-cleanup-v2.js?v=2.23.5','home-allocation-cash-v2.js?v=2.23.5'];
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