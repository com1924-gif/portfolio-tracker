(async()=>{
  const files=['core-v2.js?v=2.22','ui-v2.js?v=2.22','actions-v2.js?v=2.22','lifecycle-v2.js?v=2.22','holding-cost-v2.js?v=2.22','delete-guard-v2.js?v=2.22','ledger-v2.js?v=2.22','capital-v2.js?v=2.22','reorder-v2.js?v=2.22','swipe-nav-v2.js?v=2.22','sync-v2.js?v=2.22','sync-health-v2.js?v=2.22','live-fx-v2.js?v=2.22','prices-v2.js?v=2.22','history-v2.js?v=2.22','history-style-v2.js?v=2.22','performance-v2.js?v=2.22','performance-cleanup-v2.js?v=2.22','benchmark-live-refresh-v2.js?v=2.22','overall-performance-v2.js?v=2.22'];
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