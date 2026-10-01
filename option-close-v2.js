(()=>{
  if(window.__portfolioOptionCloseInstalledV224)return;
  window.__portfolioOptionCloseInstalledV224=true;

  const txModal=document.getElementById('transactionModal');
  const holdingModal=document.getElementById('holdingModal');
  const LOCK_IDS=['txPortfolio','txType','txAssetType','txTicker','txCurrency','txOptionType','txStrike','txExpiry','txMultiplier'];

  const style=document.createElement('style');
  style.textContent=`
    .option-close-btn{margin-top:10px;background:#b33a3a;color:#fff}
    .option-close-btn:hover{filter:brightness(1.05)}
    .option-close-note{font-size:11px;line-height:1.45;color:var(--muted);background:#151519;border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:2px 0 10px}
  `;
  document.head.appendChild(style);

  function ensureCloseButton(){
    let btn=document.getElementById('closeOptionPositionBtn');
    if(btn)return btn;
    const update=document.getElementById('updatePriceBtn');
    if(!update?.parentElement)return null;
    btn=document.createElement('button');
    btn.id='closeOptionPositionBtn';
    btn.type='button';
    btn.className='primary-btn full option-close-btn hidden';
    btn.textContent='Close Position';
    update.insertAdjacentElement('afterend',btn);
    btn.addEventListener('click',()=>{
      const id=btn.dataset.assetId||activeHoldingId;
      if(id)openOptionCloseForm(id);
    });
    return btn;
  }

  function positionById(id){
    if(typeof positionsFor!=='function')return null;
    return positionsFor(currentPortfolioId).find(p=>p.id===id)||null;
  }

  function setLocked(locked){
    LOCK_IDS.forEach(id=>{
      const el=document.getElementById(id);
      if(!el)return;
      el.disabled=!!locked;
    });
  }

  function removeCloseNote(){
    document.getElementById('optionCloseNote')?.remove();
  }

  function resetCloseMode(){
    if(txModal){
      delete txModal.dataset.optionCloseAssetId;
      delete txModal.dataset.optionCloseStartQty;
    }
    setLocked(false);
    removeCloseNote();
  }

  function decorateHoldingCloseButton(id){
    const btn=ensureCloseButton();
    if(!btn)return;
    const p=positionById(id);
    const show=!!p&&p.type==='option'&&!p.isClosed&&Number(p.qty)>0;
    btn.classList.toggle('hidden',!show);
    btn.dataset.assetId=show?p.id:'';
    if(show){
      const qty=Number(p.qty)||0;
      btn.textContent=`Close Position · ${qty} contract${qty===1?'':'s'}`;
    }
  }

  const originalOpenHoldingDetail=window.openHoldingDetail;
  if(typeof originalOpenHoldingDetail==='function'){
    window.openHoldingDetail=id=>{
      const result=originalOpenHoldingDetail(id);
      setTimeout(()=>decorateHoldingCloseButton(id),0);
      return result;
    };
  }

  const originalOpenTransactionModal=window.openTransactionModal;
  if(typeof originalOpenTransactionModal==='function'){
    window.openTransactionModal=(...args)=>{
      resetCloseMode();
      return originalOpenTransactionModal(...args);
    };
  }

  const originalOpenEditTransaction=window.openEditTransaction;
  if(typeof originalOpenEditTransaction==='function'){
    window.openEditTransaction=(...args)=>{
      resetCloseMode();
      return originalOpenEditTransaction(...args);
    };
  }

  function openOptionCloseForm(assetId){
    const p=positionById(assetId);
    if(!p||p.type!=='option'||p.isClosed||!(Number(p.qty)>0)){
      return toast('This option position is not open.',true);
    }

    closeModal('holdingModal');
    window.openTransactionModal();

    document.getElementById('txPortfolio').value=p.accountId;
    document.getElementById('txType').value='Sell';
    document.getElementById('txAssetType').value='option';
    document.getElementById('txTicker').value=p.underlying||String(p.symbol||'').split(' ')[0];
    document.getElementById('txName').value=p.name||p.underlying||p.symbol;
    document.getElementById('txCurrency').value=p.currency||'USD';
    document.getElementById('txQty').value=Number(p.qty);
    document.getElementById('txPrice').value=Number(p.price)||0;
    document.getElementById('txCurrentPrice').value=Number(p.price)||0;
    document.getElementById('txFee').value='0';
    document.getElementById('txDate').value=typeof today==='function'?today():new Date().toISOString().slice(0,10);
    document.getElementById('txOptionType').value=p.optionType||'Call';
    document.getElementById('txStrike').value=p.strike??'';
    document.getElementById('txExpiry').value=p.expiry||'';
    document.getElementById('txMultiplier').value=p.multiplier||100;

    if(typeof updateTxForm==='function')updateTxForm();

    txModal.dataset.optionCloseAssetId=p.id;
    txModal.dataset.optionCloseStartQty=String(Number(p.qty));
    setLocked(true);

    const form=txModal.querySelector('.modal-card');
    const save=document.getElementById('saveTransactionBtn');
    if(form&&save){
      const note=document.createElement('div');
      note.id='optionCloseNote';
      note.className='option-close-note';
      note.innerHTML=`Closing <strong>${esc(p.symbol)}</strong>. The form is prefilled to sell all <strong>${Number(p.qty)} contract${Number(p.qty)===1?'':'s'}</strong>. Change Contracts for a partial close, then enter the actual execution price and fee.`;
      save.before(note);
    }

    const title=document.getElementById('txModalTitle');
    if(title)title.textContent='Close Option Position';
    if(save)save.textContent='Record Close';
    document.getElementById('txPrice')?.focus();
    document.getElementById('txPrice')?.select?.();
  }
  window.openOptionCloseForm=openOptionCloseForm;

  document.getElementById('saveTransactionBtn')?.addEventListener('click',()=>{
    const assetId=txModal?.dataset.optionCloseAssetId;
    if(!assetId)return;
    const originalQty=Number(txModal.dataset.optionCloseStartQty)||0;
    const entered=Number(document.getElementById('txQty')?.value)||0;
    setTimeout(()=>{
      const p=typeof positionsFor==='function'?positionsFor(currentPortfolioId).find(x=>x.id===assetId):null;
      resetCloseMode();
      if(p?.isClosed){
        if(typeof showPortfolioTab==='function')showPortfolioTab('holdings');
        if(typeof showHoldingStatus==='function')showHoldingStatus('closed');
        toast('Option position closed.');
      }else if(entered>0&&entered<originalQty){
        if(typeof showPortfolioTab==='function')showPortfolioTab('holdings');
        if(typeof showHoldingStatus==='function')showHoldingStatus('open');
        toast('Option position partially closed.');
      }
    },0);
  });

  document.querySelectorAll('#transactionModal .modal-close').forEach(btn=>btn.addEventListener('click',resetCloseMode));
  ensureCloseButton();
})();