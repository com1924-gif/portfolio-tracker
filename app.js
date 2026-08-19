(async()=>{
  const files=['core-v2.js?v=2.21','ui-v2.js?v=2.21','actions-v2.js?v=2.21','lifecycle-v2.js?v=2.21','holding-cost-v2.js?v=2.21','delete-guard-v2.js?v=2.21','ledger-v2.js?v=2.21','capital-v2.js?v=2.21','reorder-v2.js?v=2.21','swipe-nav-v2.js?v=2.21','sync-v2.js?v=2.21','sync-health-v2.js?v=2.21','live-fx-v2.js?v=2.21','prices-v2.js?v=2.21','history-v2.js?v=2.21','history-style-v2.js?v=2.21','performance-v2.js?v=2.21','performance-cleanup-v2.js?v=2.21','benchmark-total-return-v2.js?v=2.21'];
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