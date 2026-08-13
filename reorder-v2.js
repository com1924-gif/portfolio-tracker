(()=>{
  if(window.__portfolioReorderInstalledV27)return;
  window.__portfolioReorderInstalledV27=true;

  let draggingPortfolioId=null;
  let suppressChipClickUntil=0;

  const style=document.createElement('style');
  style.textContent=`
    .portfolio-chip{cursor:grab;user-select:none;-webkit-user-select:none;transition:transform .14s ease,opacity .14s ease,box-shadow .14s ease}
    .portfolio-chip:active{cursor:grabbing}
    .portfolio-chip.dragging,.portfolio-chip.touch-dragging{opacity:.55;transform:scale(.96)}
    .portfolio-chip.drop-before{box-shadow:-4px 0 0 var(--accent)}
    .portfolio-chip.drop-after{box-shadow:4px 0 0 var(--accent)}
    .portfolio-reordering,.portfolio-reordering *{user-select:none!important;-webkit-user-select:none!important}
    .portfolio-reordering .chip-row{overscroll-behavior-x:contain}
  `;
  document.head.appendChild(style);

  function clearDropIndicators(row){
    row?.querySelectorAll('.portfolio-chip').forEach(el=>el.classList.remove('drop-before','drop-after'));
  }

  function targetSide(el,clientX){
    const rect=el.getBoundingClientRect();
    return clientX>=rect.left+rect.width/2?'after':'before';
  }

  function markTarget(row,target,side){
    clearDropIndicators(row);
    if(!target||target.dataset.portfolioId===draggingPortfolioId)return;
    target.classList.add(side==='after'?'drop-after':'drop-before');
  }

  function reorderPortfolio(sourceId,targetId,side='before'){
    if(!sourceId||!targetId||sourceId===targetId)return false;
    const from=state.accounts.findIndex(a=>a.id===sourceId);
    if(from<0)return false;
    const [moved]=state.accounts.splice(from,1);
    let to=state.accounts.findIndex(a=>a.id===targetId);
    if(to<0){
      state.accounts.splice(from,0,moved);
      return false;
    }
    if(side==='after')to+=1;
    state.accounts.splice(to,0,moved);
    save();
    renderHome();
    populatePortfolioSelects();
    return true;
  }

  function installDesktopDrag(btn,row,id){
    btn.draggable=true;
    btn.addEventListener('dragstart',e=>{
      draggingPortfolioId=id;
      suppressChipClickUntil=Date.now()+800;
      btn.classList.add('dragging');
      e.dataTransfer.effectAllowed='move';
      try{e.dataTransfer.setData('text/plain',id);}catch(_){ }
    });
    btn.addEventListener('dragover',e=>{
      if(!draggingPortfolioId||draggingPortfolioId===id)return;
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      markTarget(row,btn,targetSide(btn,e.clientX));
    });
    btn.addEventListener('drop',e=>{
      e.preventDefault();
      const source=draggingPortfolioId||(()=>{try{return e.dataTransfer.getData('text/plain');}catch(_){return '';}})();
      const side=targetSide(btn,e.clientX);
      clearDropIndicators(row);
      reorderPortfolio(source,id,side);
    });
    btn.addEventListener('dragend',()=>{
      suppressChipClickUntil=Date.now()+500;
      draggingPortfolioId=null;
      btn.classList.remove('dragging');
      clearDropIndicators(row);
    });
  }

  function installTouchDrag(btn,row,id){
    btn.addEventListener('pointerdown',downEvent=>{
      if(downEvent.pointerType==='mouse')return;
      const pointerId=downEvent.pointerId;
      const startX=downEvent.clientX,startY=downEvent.clientY;
      let active=false;
      let targetId=null;
      let side='before';

      const cleanup=()=>{
        clearTimeout(timer);
        btn.classList.remove('touch-dragging');
        document.body.classList.remove('portfolio-reordering');
        clearDropIndicators(row);
        btn.removeEventListener('pointermove',onMove);
        btn.removeEventListener('pointerup',onEnd);
        btn.removeEventListener('pointercancel',onCancel);
      };

      const timer=setTimeout(()=>{
        active=true;
        draggingPortfolioId=id;
        btn.classList.add('touch-dragging');
        document.body.classList.add('portfolio-reordering');
        try{btn.setPointerCapture(pointerId);}catch(_){ }
        if(navigator.vibrate)navigator.vibrate(18);
      },220);

      const onMove=e=>{
        if(e.pointerId!==pointerId)return;
        if(!active){
          if(Math.hypot(e.clientX-startX,e.clientY-startY)>9)clearTimeout(timer);
          return;
        }
        e.preventDefault();
        const under=document.elementFromPoint(e.clientX,e.clientY);
        const target=under?.closest?.('.portfolio-chip');
        if(!target||!row.contains(target)||target.dataset.portfolioId===id){
          targetId=null;
          clearDropIndicators(row);
          return;
        }
        targetId=target.dataset.portfolioId;
        side=targetSide(target,e.clientX);
        markTarget(row,target,side);
      };

      const onEnd=e=>{
        if(e.pointerId!==pointerId)return;
        const wasActive=active;
        cleanup();
        if(wasActive){
          suppressChipClickUntil=Date.now()+650;
          if(targetId)reorderPortfolio(id,targetId,side);
        }
        draggingPortfolioId=null;
      };
      const onCancel=e=>{
        if(e.pointerId!==pointerId)return;
        cleanup();
        draggingPortfolioId=null;
      };

      btn.addEventListener('pointermove',onMove,{passive:false});
      btn.addEventListener('pointerup',onEnd);
      btn.addEventListener('pointercancel',onCancel);
    });
  }

  function installPortfolioReorder(){
    const row=document.getElementById('portfolioChips');
    if(!row)return;
    const chips=[...row.querySelectorAll('.chip')].filter(el=>!el.classList.contains('active'));
    chips.forEach((btn,index)=>{
      const account=state.accounts[index];
      if(!account)return;
      const id=account.id;
      btn.dataset.portfolioId=id;
      btn.classList.add('portfolio-chip');
      btn.title='Drag to reorder';
      btn.setAttribute('aria-label',`${account.name}. Drag to reorder portfolio.`);
      btn.removeAttribute('onclick');
      btn.addEventListener('click',()=>{
        if(Date.now()<suppressChipClickUntil)return;
        openPortfolio(id);
      });
      installDesktopDrag(btn,row,id);
      installTouchDrag(btn,row,id);
    });
  }

  const originalRenderHome=renderHome;
  renderHome=function(){
    originalRenderHome();
    installPortfolioReorder();
  };
  window.renderHome=renderHome;

  installPortfolioReorder();
})();
