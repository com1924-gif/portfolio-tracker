(()=>{
  if(window.__portfolioTransactionPrefillInstalledV2255)return;
  window.__portfolioTransactionPrefillInstalledV2255=true;

  const ALLOWED_TYPES=new Set(['Buy','Sell']);
  const ALLOWED_ASSET_TYPES=new Set(['stock','option']);
  const ALLOWED_CURRENCIES=new Set(['HKD','USD','KRW','EUR']);

  function cleanPrefillQuery(){
    try{
      const url=new URL(window.location.href);
      ['prefill','portfolio','type','assetType','ticker','name','currency','qty','price','currentPrice','fee','date','optionType','strike','expiry','multiplier']
        .forEach(k=>url.searchParams.delete(k));
      history.replaceState(null,'',url.pathname+(url.searchParams.toString()?('?'+url.searchParams.toString()):'')+url.hash);
    }catch{}
  }

  function value(id,v){
    const el=document.getElementById(id);
    if(el&&v!=null&&v!=='')el.value=String(v);
  }

  function numberParam(params,key,{min=null}={}){
    if(!params.has(key))return null;
    const n=Number(params.get(key));
    if(!Number.isFinite(n)||(min!=null&&n<min))return null;
    return n;
  }

  async function applyTransactionPrefillFromUrl(){
    const params=new URLSearchParams(window.location.search);
    if(params.get('prefill')!=='transaction')return false;

    const portfolioRef=(params.get('portfolio')||'').trim();
    const type=ALLOWED_TYPES.has(params.get('type'))?params.get('type'):'Buy';
    const assetType=ALLOWED_ASSET_TYPES.has(params.get('assetType'))?params.get('assetType'):'stock';
    const ticker=normalizeTicker(params.get('ticker'));
    const currency=ALLOWED_CURRENCIES.has(params.get('currency'))?params.get('currency'):'USD';
    const qty=numberParam(params,'qty',{min:0});
    const price=numberParam(params,'price',{min:0});
    const fee=numberParam(params,'fee',{min:0});
    const date=params.get('date')||'';

    if(!ticker||!(qty>0)||price==null){
      cleanPrefillQuery();
      toast('Prefilled transaction link is incomplete.',true);
      return false;
    }

    const portfolio=state.accounts.find(a=>
      a.id===portfolioRef||
      String(a.name||'').trim().toLowerCase()===portfolioRef.toLowerCase()
    );
    if(!portfolio){
      cleanPrefillQuery();
      toast(`Portfolio "${portfolioRef||'unknown'}" was not found on this device.`,true);
      return false;
    }

    window.openTransactionModal();
    value('txPortfolio',portfolio.id);
    value('txType',type);
    value('txAssetType',assetType);
    value('txTicker',ticker);
    value('txName',params.get('name')||'');
    value('txCurrency',currency);
    value('txQty',qty);
    value('txPrice',price);
    const currentPriceInput=document.getElementById('txCurrentPrice');
    if(currentPriceInput){
      currentPriceInput.value='';
      currentPriceInput.dataset.autoDefault='0';
      currentPriceInput.dataset.suppressAutoDefault='1';
    }
    value('txFee',fee==null?0:fee);
    if(date)value('txDate',date);

    if(assetType==='option'){
      value('txOptionType',params.get('optionType')||'Call');
      value('txStrike',params.get('strike')||'');
      value('txExpiry',params.get('expiry')||'');
      value('txMultiplier',params.get('multiplier')||100);
    }

    if(typeof updateTxForm==='function')updateTxForm();

    const title=document.getElementById('txModalTitle');
    if(title)title.textContent='Review Transaction';
    const saveBtn=document.getElementById('saveTransactionBtn');
    if(saveBtn)saveBtn.textContent='Save Transaction';

    const form=document.querySelector('#transactionModal .modal-card');
    if(form&&!document.getElementById('transactionPrefillNote')){
      const note=document.createElement('div');
      note.id='transactionPrefillNote';
      note.style.cssText='font-size:11px;line-height:1.45;color:var(--muted);background:#151519;border:1px solid var(--line);border-radius:12px;padding:10px 12px;';
      note.textContent='Prefilled from a secure link. Current Price is intentionally left blank; stock quotes refresh automatically. Review the execution price, quantity, date and broker fee before saving.';
      saveBtn?.before(note);
    }

    cleanPrefillQuery();

    if(!params.get('name')&&typeof lookupCompanyName==='function'){
      try{await lookupCompanyName({force:true});}catch{}
    }
    document.getElementById('txFee')?.focus();
    return true;
  }

  window.applyTransactionPrefillFromUrl=applyTransactionPrefillFromUrl;
})();