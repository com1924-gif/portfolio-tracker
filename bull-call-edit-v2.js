(()=>{
if(window.__bullCallEdit22515)return;window.__bullCallEdit22515=true;

function getStrategy(strategyId){
  const txs=state.transactions.filter(t=>t.strategyId===strategyId&&t.strategyType==='bull_call_spread');
  const longTx=txs.find(t=>t.strategyLeg==='long'&&t.type==='Buy');
  const shortTx=txs.find(t=>t.strategyLeg==='short'&&t.type==='Sell');
  if(!longTx||!shortTx)return null;
  const longAsset=state.assets.find(a=>a.id===longTx.assetId);
  const shortAsset=state.assets.find(a=>a.id===shortTx.assetId);
  if(!longAsset||!shortAsset)return null;
  return {longTx,shortTx,longAsset,shortAsset};
}

function ensureModal(){
  let modal=document.getElementById('bullCallEditModal');
  if(modal)return modal;

  modal=document.createElement('div');
  modal.id='bullCallEditModal';
  modal.className='modal-overlay hidden';
  modal.innerHTML=`
    <div class="modal-wrap"><form class="modal-card" onsubmit="return false;">
      <div class="section-head">
        <div><div class="brand">BULL CALL SPREAD</div><h3 id="bullCallEditTitle">Update Current Prices</h3></div>
        <button type="button" class="icon-btn" id="closeBullCallEditBtn">×</button>
      </div>
      <div class="option-combo-note">Update current market prices only. Entry prices, fees, strikes, expiry and transaction history stay unchanged.</div>
      <div class="option-combo-leg">
        <div class="option-combo-leg-title"><span class="positive" id="bullLongLabel">LONG CALL</span><span id="bullLongEntry"></span></div>
        <label>Long Current Price<input id="bullLongCurrentPrice" type="number" min="0" step="0.0001" /></label>
      </div>
      <div class="option-combo-leg">
        <div class="option-combo-leg-title"><span class="negative" id="bullShortLabel">SHORT CALL</span><span id="bullShortEntry"></span></div>
        <label>Short Current Price<input id="bullShortCurrentPrice" type="number" min="0" step="0.0001" /></label>
      </div>
      <div id="bullCallPricePreview" class="option-combo-summary"></div>
      <button type="button" id="saveBullCallPricesBtn" class="primary-btn full">Save Current Prices</button>
    </form></div>`;
  document.body.appendChild(modal);

  document.getElementById('closeBullCallEditBtn').addEventListener('click',()=>closeModal('bullCallEditModal'));
  ['bullLongCurrentPrice','bullShortCurrentPrice'].forEach(id=>document.getElementById(id).addEventListener('input',renderPreview));
  document.getElementById('saveBullCallPricesBtn').addEventListener('click',savePrices);
  return modal;
}

function renderPreview(){
  const modal=document.getElementById('bullCallEditModal');
  const qty=Number(modal?.dataset.qty)||0;
  const ccy=modal?.dataset.currency||'USD';
  const longPrice=Number(document.getElementById('bullLongCurrentPrice')?.value);
  const shortPrice=Number(document.getElementById('bullShortCurrentPrice')?.value);
  const el=document.getElementById('bullCallPricePreview');
  if(!el)return;
  if(!Number.isFinite(longPrice)||!Number.isFinite(shortPrice)){
    el.textContent='Enter both current prices.';
    return;
  }
  const value=(longPrice-shortPrice)*qty*100;
  el.textContent=`Current spread value: ${money(value,ccy)} · ${qty} spread${qty===1?'':'s'}`;
}

window.openBullCallStrategyEditor=strategyId=>{
  const g=getStrategy(strategyId);
  if(!g)return toast('Bull Call Spread not found.',true);

  const modal=ensureModal();
  const qty=Math.min(Number(g.longTx.qty)||0,Number(g.shortTx.qty)||0);
  const ccy=g.longAsset.currency||g.shortAsset.currency||'USD';
  const under=normalizeTicker(g.longAsset.underlying||g.shortAsset.underlying||'');

  modal.dataset.strategyId=strategyId;
  modal.dataset.qty=String(qty);
  modal.dataset.currency=ccy;

  document.getElementById('bullCallEditTitle').textContent=`${under} Bull Call Spread`;
  document.getElementById('bullLongLabel').textContent=`LONG ${Number(g.longAsset.strike)}C`;
  document.getElementById('bullShortLabel').textContent=`SHORT ${Number(g.shortAsset.strike)}C`;
  document.getElementById('bullLongEntry').textContent=`Entry ${money(g.longTx.price,ccy)}`;
  document.getElementById('bullShortEntry').textContent=`Entry ${money(g.shortTx.price,ccy)}`;
  document.getElementById('bullLongCurrentPrice').value=Number(g.longAsset.price)||0;
  document.getElementById('bullShortCurrentPrice').value=Number(g.shortAsset.price)||0;

  renderPreview();
  openModal('bullCallEditModal');
};

function savePrices(){
  const modal=document.getElementById('bullCallEditModal');
  const strategyId=modal?.dataset.strategyId;
  const g=getStrategy(strategyId);
  if(!g)return toast('Bull Call Spread not found.',true);

  const longPrice=Number(document.getElementById('bullLongCurrentPrice').value);
  const shortPrice=Number(document.getElementById('bullShortCurrentPrice').value);
  if(!Number.isFinite(longPrice)||longPrice<0)return toast('Enter a valid Long current price.',true);
  if(!Number.isFinite(shortPrice)||shortPrice<0)return toast('Enter a valid Short current price.',true);

  g.longAsset.price=longPrice;
  g.shortAsset.price=shortPrice;
  save();
  closeModal('bullCallEditModal');
  renderAll();
  toast('Bull Call Spread current prices updated.');
}

ensureModal();
})();