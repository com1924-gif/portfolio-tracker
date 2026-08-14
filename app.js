(async()=>{
  const files=['core-v2.js?v=2.13','ui-v2.js?v=2.13','actions-v2.js?v=2.13','lifecycle-v2.js?v=2.13','delete-guard-v2.js?v=2.13','ledger-v2.js?v=2.13','capital-v2.js?v=2.13','reorder-v2.js?v=2.13','swipe-nav-v2.js?v=2.13','prices-v2.js?v=2.13','history-v2.js?v=2.13','history-style-v2.js?v=2.13'];
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