(async()=>{
  const files=['core-v2.js?v=2.22.3','ui-v2.js?v=2.22.3','allocation-all-v2.js?v=2.22.3','actions-v2.js?v=2.22.3','lifecycle-v2.js?v=2.22.3','holding-cost-v2.js?v=2.22.3','delete-guard-v2.js?v=2.22.3','ledger-v2.js?v=2.22.3','capital-v2.js?v=2.22.3','reorder-v2.js?v=2.22.3','swipe-nav-v2.js?v=2.22.3','sync-v2.js?v=2.22.3','sync-health-v2.js?v=2.22.3','live-fx-v2.js?v=2.22.3','prices-v2.js?v=2.22.3','history-v2.js?v=2.22.3','history-style-v2.js?v=2.22.3','performance-v2.js?v=2.22.3','performance-cleanup-v2.js?v=2.22.3','benchmark-live-refresh-v2.js?v=2.22.3','home-pl-percent-v2.js?v=2.22.3'];
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