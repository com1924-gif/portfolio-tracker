(async()=>{
  const files=['core-v2.js?v=2.16','ui-v2.js?v=2.16','actions-v2.js?v=2.16','lifecycle-v2.js?v=2.16','delete-guard-v2.js?v=2.16','ledger-v2.js?v=2.16','capital-v2.js?v=2.16','reorder-v2.js?v=2.16','swipe-nav-v2.js?v=2.16','sync-v2.js?v=2.16','prices-v2.js?v=2.16','history-v2.js?v=2.16','history-style-v2.js?v=2.16'];
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