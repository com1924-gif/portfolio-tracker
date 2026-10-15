(async()=>{
  window.__PORTFOLIO_APP_VERSION='2.25.4';
  const files=[
    'core-v2.js?v=2.25.4',
    'ui-v2.js?v=2.25.4',
    'actions-v2.js?v=2.25.4',
    'lifecycle-v2.js?v=2.25.4',
    'holding-cost-v2.js?v=2.25.4',
    'delete-guard-v2.js?v=2.25.4',
    'ledger-v2.js?v=2.25.4',
    'capital-v2.js?v=2.25.4',
    'currency-eur-v2.js?v=2.25.4',
    'reorder-v2.js?v=2.25.4',
    'swipe-nav-v2.js?v=2.25.4',
    'sync-v225.js?v=2.25.4',
    'live-fx-v2.js?v=2.25.4',
    'prices-v2.js?v=2.25.4',
    'layout-v225.js?v=2.25.4',
    'history-v2.js?v=2.25.4',
    'history-style-v2.js?v=2.25.4',
    'performance-v225.js?v=2.25.4',
    'home-v225.js?v=2.25.4',
    'privacy-toggle-v2.js?v=2.25.4',
    'option-close-v2.js?v=2.25.4',
    'transaction-prefill-v2.js?v=2.25.4'
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