(async()=>{
  const files=['core-v2.js?v=2.23.2','ui-v2.js?v=2.23.2','allocation-all-v2.js?v=2.23.2','actions-v2.js?v=2.23.2','lifecycle-v2.js?v=2.23.2','holding-cost-v2.js?v=2.23.2','delete-guard-v2.js?v=2.23.2','ledger-v2.js?v=2.23.2','capital-v2.js?v=2.23.2','reorder-v2.js?v=2.23.2','swipe-nav-v2.js?v=2.23.2','sync-v2.js?v=2.23.2','sync-health-v2.js?v=2.23.2','live-fx-v2.js?v=2.23.2','prices-v2.js?v=2.23.2','history-v2.js?v=2.23.2','history-style-v2.js?v=2.23.2','performance-v2.js?v=2.23.2','performance-cleanup-v2.js?v=2.23.2','benchmark-live-refresh-v2.js?v=2.23.2','home-pl-percent-v2.js?v=2.23.2','home-allocation-detail-v2.js?v=2.23.2','home-average-cost-native-v2.js?v=2.23.2','home-detail-cleanup-v2.js?v=2.23.2'];
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