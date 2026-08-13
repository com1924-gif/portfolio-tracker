let editingTransactionId=null;

function updateTxForm(){
  const type=$('txType').value;const trading=['Buy','Sell'].includes(type);const dividend=type==='Dividend';
  $('assetTypeLabel').classList.toggle('hidden',!trading);
  $('tickerLabel').classList.toggle('hidden',!(trading||dividend));
  $('nameLabel').classList.toggle('hidden',!trading);
  $('qtyLabel').classList.toggle('hidden',!trading);
  $('currentPriceLabel').classList.toggle('hidden',!trading);
  $('optionTxFields').classList.toggle('hidden',!(trading&&$('txAssetType').value==='option'));
  $('priceLabel').firstChild.textContent=trading?'Price':'Amount';
}
$('txType').addEventListener('change',updateTxForm);$('txAssetType').addEventListener('change',updateTxForm);

function setTransactionModalMode(editing){
  if($('txModalTitle'))$('txModalTitle').textContent=editing?'Edit Transaction':'Add Transaction';
  $('saveTransactionBtn').textContent=editing?'Save Changes':'Save Transaction';
}

function resetTransactionForm(){
  populatePortfolioSelects();if(currentPortfolioId)$('txPortfolio').value=currentPortfolioId;
  $('txType').value='Buy';$('txAssetType').value='stock';$('txTicker').value='';$('txName').value='';
  $('txQty').value='1';$('txPrice').value='0';$('txCurrentPrice').value='';$('txFee').value='0';
  $('txDate').value=today();$('txMultiplier').value='100';$('txOptionType').value='Call';$('txStrike').value='';$('txExpiry').value='';
  setTransactionModalMode(false);updateTxForm();
}

window.openTransactionModal=()=>{
  editingTransactionId=null;
  resetTransactionForm();
  openModal('transactionModal');
};

window.openEditTransaction=id=>{
  const t=state.transactions.find(x=>x.id===id);if(!t)return toast('Transaction not found.',true);
  const a=state.assets.find(x=>x.id===t.assetId);
  editingTransactionId=id;
  populatePortfolioSelects();
  $('txPortfolio').value=t.accountId;
  $('txType').value=t.type;
  $('txCurrency').value=t.currency||a?.currency||'USD';
  $('txDate').value=t.date||today();
  $('txFee').value=Number(t.fee)||0;
  $('txQty').value=Number(t.qty)||1;
  $('txPrice').value=t.amount!=null?Number(t.amount):(Number(t.price)||0);
  $('txCurrentPrice').value=a?.price??'';
  $('txAssetType').value=a?.type||'stock';
  $('txTicker').value=a?(a.type==='option'?(a.underlying||a.symbol.split(' ')[0]):a.symbol):'';
  $('txName').value=a?.name||'';
  $('txOptionType').value=a?.optionType||'Call';
  $('txStrike').value=a?.strike??'';
  $('txExpiry').value=a?.expiry||'';
  $('txMultiplier').value=a?.multiplier||100;
  setTransactionModalMode(true);updateTxForm();openModal('transactionModal');
};

$('saveTransactionBtn').addEventListener('click',()=>{
  try{
    const existing=editingTransactionId?state.transactions.find(x=>x.id===editingTransactionId):null;
    const oldAssetId=existing?.assetId||null;
    const accountId=$('txPortfolio').value,type=$('txType').value,currency=$('txCurrency').value,date=$('txDate').value||today();
    const trading=['Buy','Sell'].includes(type),dividend=type==='Dividend';
    if(!accountId)return toast('Select a portfolio.',true);
    let payload;

    if(trading||dividend){
      const ticker=normalizeTicker($('txTicker').value);if(!ticker)return toast('Enter a ticker.',true);
      const assetType=trading?$('txAssetType').value:'stock';
      const optionType=$('txOptionType').value,strike=Number($('txStrike').value),expiry=$('txExpiry').value;
      if(assetType==='option'&&(!Number.isFinite(strike)||!expiry))return toast('Option strike and expiry are required.',true);
      let a=findAsset({accountId,type:assetType,ticker,optionType,strike,expiry});
      const price=Number($('txPrice').value),qty=Number($('txQty').value),fee=Number($('txFee').value)||0,currentPrice=Number($('txCurrentPrice').value);
      if((type==='Sell'||dividend)&&!a)return toast('This holding does not exist in the selected portfolio.',true);
      if(trading&&(!Number.isFinite(qty)||qty<=0))return toast('Enter a valid quantity.',true);
      if(!Number.isFinite(price)||price<0)return toast('Enter a valid price.',true);
      if(!a)a=ensureAsset({accountId,type:assetType,ticker,name:$('txName').value.trim(),currency,tradePrice:price,currentPrice,optionType,strike,expiry,multiplier:Number($('txMultiplier').value)||100});
      a.currency=currency;
      if(trading&&$('txName').value.trim())a.name=$('txName').value.trim();
      if(Number.isFinite(currentPrice)&&currentPrice>0)a.price=currentPrice;
      if(a.type==='option')a.multiplier=Number($('txMultiplier').value)||100;
      payload={id:existing?.id||uid('t_'),accountId,type,assetId:a.id,currency,qty:trading?qty:0,price:trading?price:0,fee,amount:dividend?price:undefined,date};
    }else{
      const amount=Number($('txPrice').value);if(!Number.isFinite(amount)||amount<0)return toast('Enter a valid amount.',true);
      payload={id:existing?.id||uid('t_'),accountId,type,assetId:null,currency,amount,date,fee:0,qty:0,price:0};
    }

    if(existing)Object.assign(existing,payload);else state.transactions.push(payload);
    if(existing&&oldAssetId&&oldAssetId!==payload.assetId&&!state.transactions.some(t=>t.assetId===oldAssetId)){
      state.assets=state.assets.filter(a=>a.id!==oldAssetId);
    }
    const wasEditing=!!existing;
    editingTransactionId=null;
    save();closeModal('transactionModal');currentPortfolioId=accountId;renderAll();showPortfolioTab('transactions');toast(wasEditing?'Transaction updated.':'Transaction saved.');
  }catch(e){console.error(e);toast(`Could not save transaction: ${e.message}`,true);}
});

function updateCashForm(){
  const exchange=$('cashAction').value==='Exchange';
  $('cashSingleFields').classList.toggle('hidden',exchange);$('cashExchangeFields').classList.toggle('hidden',!exchange);
}
$('cashAction').addEventListener('change',updateCashForm);
window.openCashModal=()=>{
  populatePortfolioSelects();if(currentPortfolioId)$('cashPortfolio').value=currentPortfolioId;
  $('cashAction').value='Deposit';$('cashAmount').value='';$('cashFromAmount').value='';$('cashToAmount').value='';$('cashFxFee').value='0';$('cashDate').value=today();updateCashForm();openModal('cashModal');
};
$('saveCashBtn').addEventListener('click',()=>{
  const accountId=$('cashPortfolio').value,action=$('cashAction').value,date=$('cashDate').value||today();
  if(!accountId)return toast('Select a portfolio.',true);
  if(action==='Exchange'){
    const from=$('cashFrom').value,to=$('cashTo').value,fromAmount=Number($('cashFromAmount').value),toAmount=Number($('cashToAmount').value),fee=Number($('cashFxFee').value)||0;
    if(from===to)return toast('Choose two different currencies.',true);
    if(!Number.isFinite(fromAmount)||fromAmount<=0||!Number.isFinite(toAmount)||toAmount<=0)return toast('Enter valid exchange amounts.',true);
    state.fx.push({id:uid('fx_'),accountId,from,to,fromAmount,toAmount,fee,date});
  }else{
    const amount=Number($('cashAmount').value),currency=$('cashCurrency').value;if(!Number.isFinite(amount)||amount<=0)return toast('Enter a valid amount.',true);
    state.transactions.push({id:uid('t_'),accountId,type:action,currency,amount,date,assetId:null,qty:0,price:0,fee:0});
  }
  save();closeModal('cashModal');currentPortfolioId=accountId;renderAll();showPortfolioTab('cash');toast('Cash action saved.');
});

window.deleteTransaction=id=>{
  const t=state.transactions.find(x=>x.id===id);if(!t)return;if(!confirm(`Delete ${t.type} transaction?`))return;
  const assetId=t.assetId;
  state.transactions=state.transactions.filter(x=>x.id!==id);
  if(assetId&&!state.transactions.some(x=>x.assetId===assetId))state.assets=state.assets.filter(a=>a.id!==assetId);
  save();renderAll();toast('Transaction deleted.');
};
window.deleteFx=id=>{
  if(!confirm('Delete this FX exchange?'))return;state.fx=state.fx.filter(x=>x.id!==id);save();renderAll();toast('FX exchange deleted.');
};

window.openHoldingDetail=id=>{
  const h=holdingsFor(currentPortfolioId).find(x=>x.id===id);if(!h)return;activeHoldingId=id;
  $('holdingDetailTitle').textContent=h.symbol;
  const weight=summaryFor(currentPortfolioId).net?convert(h.marketValue,h.currency)/summaryFor(currentPortfolioId).net*100:0;
  const txs=state.transactions.filter(t=>t.assetId===id).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  $('holdingDetailBody').innerHTML=`
    <div class="detail-grid">
      <div class="detail-cell"><span>Quantity</span><strong>${h.qty}</strong></div>
      <div class="detail-cell"><span>Current Price</span><strong>${money(h.price,h.currency)}</strong></div>
      <div class="detail-cell"><span>Average Cost</span><strong>${money(h.avgCost,h.currency)}</strong></div>
      <div class="detail-cell"><span>Market Value</span><strong>${money(h.marketValue,h.currency)}</strong></div>
      <div class="detail-cell"><span>Unrealized P/L</span><strong class="${h.unrealized<0?'negative':'positive'}">${signedMoney(h.unrealized,h.currency)}</strong></div>
      <div class="detail-cell"><span>Realized P/L</span><strong class="${h.realized<0?'negative':'positive'}">${signedMoney(h.realized,h.currency)}</strong></div>
      <div class="detail-cell"><span>Return</span><strong class="${h.returnPct<0?'negative':'positive'}">${pct(h.returnPct)}</strong></div>
      <div class="detail-cell"><span>Portfolio Weight</span><strong>${weight.toFixed(1)}%</strong></div>
    </div>
    <div class="detail-title">Transaction history</div>
    <div class="detail-transactions">${txs.map(t=>`<div class="tx-row"><div><div class="tx-title">${esc(t.type)}</div><div class="tx-sub">${esc(t.date)} · ${t.qty||''}${t.qty?` @ ${money(t.price,t.currency)}`:''}</div></div><div>${t.amount!=null?money(t.amount,t.currency):money((t.qty||0)*(t.price||0)*multiplier(h),t.currency)}</div></div>`).join('')||'<div class="empty">No history.</div>'}</div>`;
  openModal('holdingModal');
};
$('updatePriceBtn').addEventListener('click',()=>{
  const a=state.assets.find(x=>x.id===activeHoldingId);if(!a)return;const v=prompt(`Current price for ${a.symbol}`,a.price);if(v===null)return;const n=Number(v);if(!Number.isFinite(n)||n<0)return toast('Invalid price.',true);a.price=n;save();closeModal('holdingModal');renderAll();toast('Price updated.');
});

function toast(msg,error=false){const el=$('toast');el.textContent=msg;el.classList.remove('hidden','error');if(error)el.classList.add('error');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.add('hidden'),2200);}
function today(){return new Date().toISOString().slice(0,10);}

$('homeCurrency').addEventListener('change',e=>{displayCurrency=e.target.value;$('portfolioCurrency').value=displayCurrency;renderAll();});
$('portfolioCurrency').addEventListener('change',e=>{displayCurrency=e.target.value;$('homeCurrency').value=displayCurrency;renderAll();});

$('homeCurrency').value=displayCurrency;$('portfolioCurrency').value=displayCurrency;
populatePortfolioSelects();renderHome();

if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations?.().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});}
