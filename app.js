(async()=>{
  const files=['core-v2.js?v=2.23','ui-v2.js?v=2.23','allocation-all-v2.js?v=2.23','actions-v2.js?v=2.23','lifecycle-v2.js?v=2.23','holding-cost-v2.js?v=2.23','delete-guard-v2.js?v=2.23','ledger-v2.js?v=2.23','capital-v2.js?v=2.23','reorder-v2.js?v=2.23','swipe-nav-v2.js?v=2.23','sync-v2.js?v=2.23','sync-health-v2.js?v=2.23','live-fx-v2.js?v=2.23','prices-v2.js?v=2.23','history-v2.js?v=2.23','history-style-v2.js?v=2.23','performance-v2.js?v=2.23','performance-cleanup-v2.js?v=2.23','benchmark-live-refresh-v2.js?v=2.23','home-pl-percent-v2.js?v=2.23','home-allocation-detail-v2.js?v=2.23'];
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