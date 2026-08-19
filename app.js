(async()=>{
  const files=['core-v2.js?v=2.19','ui-v2.js?v=2.19','actions-v2.js?v=2.19','lifecycle-v2.js?v=2.19','holding-cost-v2.js?v=2.19','delete-guard-v2.js?v=2.19','ledger-v2.js?v=2.19','capital-v2.js?v=2.19','reorder-v2.js?v=2.19','swipe-nav-v2.js?v=2.19','sync-v2.js?v=2.19','prices-v2.js?v=2.19','history-v2.js?v=2.19','history-style-v2.js?v=2.19','performance-v2.js?v=2.19','performance-cleanup-v2.js?v=2.19'];
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