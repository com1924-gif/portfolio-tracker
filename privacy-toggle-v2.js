(()=>{
  if(window.__portfolioNetAssetPrivacyInstalledV2254)return;
  window.__portfolioNetAssetPrivacyInstalledV2254=true;

  const STORAGE_KEY='portfolio-hide-net-assets';
  let hidden=false;
  try{hidden=localStorage.getItem(STORAGE_KEY)==='1';}catch{}

  const eyeOpen='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/></svg>';
  const eyeClosed='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6 0 9.5 6 9.5 6a15.9 15.9 0 0 1-3.1 3.7"/><path d="M6.3 6.3C3.9 8 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3-.5"/><path d="M9.9 9.9A3 3 0 0 0 14.1 14.1"/></svg>';

  const style=document.createElement('style');
  style.textContent=`
    .net-asset-label-row{display:flex;align-items:center;gap:7px}
    .net-asset-privacy-btn{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--muted);padding:4px;border-radius:8px;cursor:pointer}
    .net-asset-privacy-btn:hover{background:rgba(255,255,255,.07);color:var(--text)}
    .net-asset-privacy-btn:focus-visible{outline:2px solid currentColor;outline-offset:2px}
    .net-asset-privacy-btn svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    #homeNetAssets.net-assets-hidden{letter-spacing:.08em}
  `;
  document.head.appendChild(style);

  function ensureButton(){
    const amount=document.getElementById('homeNetAssets');
    if(!amount)return null;
    const label=amount.previousElementSibling;
    if(!label)return null;

    let row=label.closest('.net-asset-label-row');
    if(!row){
      row=document.createElement('div');
      row.className='net-asset-label-row';
      label.parentNode.insertBefore(row,label);
      row.appendChild(label);
    }

    let btn=document.getElementById('homeNetAssetPrivacyBtn');
    if(!btn){
      btn=document.createElement('button');
      btn.id='homeNetAssetPrivacyBtn';
      btn.type='button';
      btn.className='net-asset-privacy-btn';
      row.appendChild(btn);
      btn.addEventListener('click',()=>{
        hidden=!hidden;
        try{localStorage.setItem(STORAGE_KEY,hidden?'1':'0');}catch{}
        applyPrivacy();
      });
    }
    return btn;
  }

  function applyPrivacy(){
    const amount=document.getElementById('homeNetAssets');
    const btn=ensureButton();
    if(!amount||!btn)return;

    if(!amount.dataset.visibleValue||!hidden){
      if(!amount.classList.contains('net-assets-hidden'))amount.dataset.visibleValue=amount.textContent;
      else if(!hidden&&amount.dataset.visibleValue)amount.textContent=amount.dataset.visibleValue;
    }

    if(hidden){
      if(!amount.classList.contains('net-assets-hidden'))amount.dataset.visibleValue=amount.textContent;
      amount.textContent='******';
      amount.classList.add('net-assets-hidden');
      btn.innerHTML=eyeClosed;
      btn.setAttribute('aria-label','Show Total Net Assets');
      btn.title='Show Total Net Assets';
    }else{
      if(amount.dataset.visibleValue)amount.textContent=amount.dataset.visibleValue;
      amount.classList.remove('net-assets-hidden');
      btn.innerHTML=eyeOpen;
      btn.setAttribute('aria-label','Hide Total Net Assets');
      btn.title='Hide Total Net Assets';
    }
    btn.setAttribute('aria-pressed',hidden?'true':'false');
  }

  const originalRenderHome=window.renderHome;
  if(typeof originalRenderHome==='function'){
    window.renderHome=renderHome=function(){
      originalRenderHome();
      const amount=document.getElementById('homeNetAssets');
      if(amount&&!amount.classList.contains('net-assets-hidden'))amount.dataset.visibleValue=amount.textContent;
      applyPrivacy();
    };
  }

  applyPrivacy();
})();