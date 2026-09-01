(async()=>{
  const files=['core-v2.js?v=2.23.1','ui-v2.js?v=2.23.1','allocation-all-v2.js?v=2.23.1','actions-v2.js?v=2.23.1','lifecycle-v2.js?v=2.23.1','holding-cost-v2.js?v=2.23.1','delete-guard-v2.js?v=2.23.1','ledger-v2.js?v=2.23.1','capital-v2.js?v=2.23.1','reorder-v2.js?v=2.23.1','swipe-nav-v2.js?v=2.23.1','sync-v2.js?v=2.23.1','sync-health-v2.js?v=2.23.1','live-fx-v2.js?v=2.23.1','prices-v2.js?v=2.23.1','history-v2.js?v=2.23.1','history-style-v2.js?v=2.23.1','performance-v2.js?v=2.23.1','performance-cleanup-v2.js?v=2.23.1','benchmark-live-refresh-v2.js?v=2.23.1','home-pl-percent-v2.js?v=2.23.1','home-allocation-detail-v2.js?v=2.23.1','home-average-cost-native-v2.js?v=2.23.1'];
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