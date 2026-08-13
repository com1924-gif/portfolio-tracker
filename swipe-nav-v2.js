(()=>{
  if(window.__portfolioSwipeNavInstalledV211)return;
  window.__portfolioSwipeNavInstalledV211=true;

  const MIN_X=70;
  const MAX_MS=900;
  const HORIZONTAL_RATIO=1.35;
  let start=null;

  const style=document.createElement('style');
  style.textContent=`
    @keyframes pageSlideFromRight{from{opacity:.55;transform:translateX(22px)}to{opacity:1;transform:translateX(0)}}
    @keyframes pageSlideFromLeft{from{opacity:.55;transform:translateX(-22px)}to{opacity:1;transform:translateX(0)}}
    .page-swipe-from-right{animation:pageSlideFromRight .18s ease-out}
    .page-swipe-from-left{animation:pageSlideFromLeft .18s ease-out}
  `;
  document.head.appendChild(style);

  function blockedTarget(target){
    if(!target?.closest)return false;
    return !!target.closest([
      'button','a','input','select','textarea','label',
      '.chip-row','.tab-row','.holding-status-tabs',
      '.modal-overlay','.transaction-list','.holding-list',
      'canvas','svg'
    ].join(','));
  }

  function activePortfolioTab(){
    return document.querySelector('.tab-btn.active')?.dataset?.tab||'overview';
  }

  function animate(direction){
    requestAnimationFrame(()=>{
      const el=currentPortfolioId?document.getElementById('portfolioView'):document.getElementById('homeView');
      if(!el)return;
      const cls=direction>0?'page-swipe-from-right':'page-swipe-from-left';
      el.classList.remove('page-swipe-from-right','page-swipe-from-left');
      void el.offsetWidth;
      el.classList.add(cls);
      setTimeout(()=>el.classList.remove(cls),220);
    });
  }

  function navigate(direction){
    if(!Array.isArray(state.accounts)||!state.accounts.length)return;

    const oldTab=currentPortfolioId?activePortfolioTab():'overview';
    if(!currentPortfolioId){
      if(direction>0){
        openPortfolio(state.accounts[0].id);
        animate(direction);
      }
      return;
    }

    const index=state.accounts.findIndex(a=>a.id===currentPortfolioId);
    if(index<0)return;

    if(direction<0){
      if(index===0){
        goHome();
        animate(direction);
        return;
      }
      openPortfolio(state.accounts[index-1].id);
      if(oldTab!=='overview')showPortfolioTab(oldTab);
      animate(direction);
      return;
    }

    if(index<state.accounts.length-1){
      openPortfolio(state.accounts[index+1].id);
      if(oldTab!=='overview')showPortfolioTab(oldTab);
      animate(direction);
    }
  }

  const main=document.querySelector('main');
  if(!main)return;

  main.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||blockedTarget(e.target)||document.querySelector('.modal-overlay:not(.hidden)')){
      start=null;
      return;
    }
    const t=e.touches[0];
    start={x:t.clientX,y:t.clientY,time:Date.now()};
  },{passive:true});

  main.addEventListener('touchend',e=>{
    if(!start||e.changedTouches.length!==1){start=null;return;}
    const t=e.changedTouches[0];
    const dx=t.clientX-start.x;
    const dy=t.clientY-start.y;
    const dt=Date.now()-start.time;
    start=null;

    if(dt>MAX_MS||Math.abs(dx)<MIN_X||Math.abs(dx)<Math.abs(dy)*HORIZONTAL_RATIO)return;

    // Finger moves left => go to the next portfolio. Finger moves right => previous / Overview.
    navigate(dx<0?1:-1);
  },{passive:true});

  main.addEventListener('touchcancel',()=>{start=null;},{passive:true});
})();
