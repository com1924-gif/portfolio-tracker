(async()=>{
  window.__PORTFOLIO_APP_VERSION='2.25';
  const files=[
    'core-v2.js?v=2.25.2',
    'ui-v2.js?v=2.25.2',
    'actions-v2.js?v=2.25.2',
    'lifecycle-v2.js?v=2.25.2',
    'holding-cost-v2.js?v=2.25.2',
    'delete-guard-v2.js?v=2.25.2',
    'ledger-v2.js?v=2.25.2',
    'capital-v2.js?v=2.25.2',
    'currency-eur-v2.js?v=2.25.2',
    'reorder-v2.js?v=2.25.2',
    'swipe-nav-v2.js?v=2.25.2',
    'sync-v225.js?v=2.25.2',
    'live-fx-v2.js?v=2.25.2',
    'prices-v2.js?v=2.25.2',
    'layout-v225.js?v=2.25.2',
    'history-v2.js?v=2.25.2',
    'history-style-v2.js?v=2.25.2',
    'performance-v225.js?v=2.25.2',
    'home-v225.js?v=2.25.2',
    'option-close-v2.js?v=2.25.2',
    'transaction-prefill-v2.js?v=2.25.2'
  ];

  for(const src of files){
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;
      s.onload=resolve;
      s.onerror=()=>reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(s);
    });
  }

  const startupSync=window.portfolioStartupSyncReady;
  if(startupSync&&typeof startupSync.then==='function'){
    await Promise.race([
      startupSync.catch(()=>{}),
      new Promise(resolve=>setTimeout(resolve,2800))
    ]);
  }

  if(typeof renderAll==='function')renderAll();
  if(typeof window.applyTransactionPrefillFromUrl==='function')await window.applyTransactionPrefillFromUrl();

  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  document.body.classList.remove('app-booting');
  document.body.classList.add('app-ready');
  document.getElementById('appBoot')?.remove();
})().catch(err=>{
  console.error(err);
  const boot=document.getElementById('appBoot');
  if(boot){
    boot.innerHTML='<div class="app-boot-brand">PORTFOLIO TRACKER</div><div class="app-boot-error">App failed to load. Please refresh.</div>';
  }
  const el=document.getElementById('toast');
  if(el){
    el.textContent='App failed to load. Please refresh.';
    el.classList.remove('hidden');
    el.classList.add('error');
  }
});