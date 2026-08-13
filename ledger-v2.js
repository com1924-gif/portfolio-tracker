(()=>{
  if(window.__portfolioLedgerInstalledV29)return;
  window.__portfolioLedgerInstalledV29=true;

  const EPS=1e-9;
  const cashModal=document.getElementById('cashModal');
  const txModal=document.getElementById('transactionModal');

  // Keep the Open / Closed tabs clean: no position counts.
  const noCountStyle=document.createElement('style');
  noCountStyle.textContent='.holding-status-count{display:none!important}';
  document.head.appendChild(noCountStyle);

  function canonicalStockTicker(ticker,currency){
    const raw=normalizeTicker(ticker);
    if(!raw)return '';
    if(raw.includes('.'))return raw;
    if(currency==='HKD'&&/^\d{1,5}$/.test(raw))return raw.padStart(4,'0')+'.HK';
    if(currency==='KRW'&&/^\d{6}$/.test(raw))return raw+'.KS';
    return raw;
  }

  function canonicalAssetTicker(asset){
    if(!asset||asset.type!=='stock')return '';
    return canonicalStockTicker(asset.symbol,asset.currency);
  }

  function marketCurrencyError(ticker,currency){
    const raw=normalizeTicker(ticker);
    if(/\.HK$/.test(raw)&&currency!=='HKD')return 'Hong Kong tickers (.HK) must use HKD.';
    if(/\.(KS|KQ)$/.test(raw)&&currency!=='KRW')return 'Korean tickers (.KS / .KQ) must use KRW.';
    return '';
  }

  function findStockAcrossCurrency(accountId,ticker,currency){
    const raw=normalizeTicker(ticker);
    const canonical=canonicalStockTicker(ticker,currency);
    return state.assets.find(a=>a.accountId===accountId&&a.type==='stock'&&(
      normalizeTicker(a.symbol)===raw ||
      normalizeTicker(a.symbol)===canonical ||
      canonicalAssetTicker(a)===canonical ||
      canonicalAssetTicker(a)===raw
    ));
  }

  function findOptionFromForm(accountId,ticker){
    return findAsset({
      accountId,type:'option',ticker:normalizeTicker(ticker),
      optionType:document.getElementById('txOptionType').value,
      strike:Number(document.getElementById('txStrike').value),
      expiry:document.getElementById('txExpiry').value
    });
  }

  function formTradeQty(assetType,currency,asset){
    const entered=Number(document.getElementById('txQty').value);
    if(!Number.isFinite(entered)||entered<=0)return {ok:false,message:'Enter a valid quantity.'};
    if(assetType==='option')return {ok:true,qty:entered,enteredQty:entered,lotSize:null};
    if(currency==='HKD'){
      const mode=document.getElementById('txQtyMode').value;
      const typedLot=Number(document.getElementById('txLotSize').value);
      const storedLot=Number(asset?.lotSize)||0;
      const lotSize=Number.isFinite(typedLot)&&typedLot>0?typedLot:storedLot;
      if(storedLot>0&&Number.isFinite(typedLot)&&typedLot>0&&typedLot!==storedLot){
        return {ok:false,message:`Board lot size for ${asset.symbol} is already ${storedLot}.`};
      }
      if(mode==='lots'){
        if(!Number.isInteger(lotSize)||lotSize<=0)return {ok:false,message:'Enter the board lot size for this Hong Kong stock.'};
        return {ok:true,qty:entered*lotSize,enteredQty:entered,lotSize};
      }
      return {ok:true,qty:entered,enteredQty:entered,lotSize:lotSize||null};
    }
    return {ok:true,qty:entered,enteredQty:entered,lotSize:null};
  }

  function sortedTradeRows(assetId,excludeId=null,proposed=null,preferredIndex=null){
    const rows=[];
    state.transactions.forEach((t,index)=>{
      if(t.assetId!==assetId||!['Buy','Sell'].includes(t.type)||t.id===excludeId)return;
      rows.push({t,index});
    });
    if(proposed)rows.push({t:proposed,index:Number.isInteger(preferredIndex)?preferredIndex:state.transactions.length+1});
    rows.sort((a,b)=>(a.t.date||'').localeCompare(b.t.date||'')||a.index-b.index);
    return rows;
  }

  function validateSequence(assetId,excludeId=null,proposed=null,preferredIndex=null){
    if(!assetId)return {ok:true};
    let qty=0;
    for(const {t} of sortedTradeRows(assetId,excludeId,proposed,preferredIndex)){
      const q=Number(t.qty)||0;
      if(t.type==='Buy')qty+=q;
      else{
        if(q>qty+EPS)return {ok:false,available:Math.max(0,qty),date:t.date||''};
        qty-=q;
        if(Math.abs(qty)<EPS)qty=0;
      }
    }
    return {ok:true,available:qty};
  }

  function availableText(asset,qty){
    if(asset?.type==='option')return `${qty} contract${qty===1?'':'s'}`;
    const lot=Number(asset?.lotSize)||0;
    if(asset?.currency==='HKD'&&lot>0){
      const lots=qty/lot;
      return `${qty} shares (${Number.isInteger(lots)?lots:lots.toFixed(2)} lots)`;
    }
    return `${qty} shares`;
  }

  function blockEvent(ev,message){
    ev.preventDefault();
    ev.stopImmediatePropagation();
    toast(message,true);
  }

  // Capture-phase validation runs before the original save handler.
  document.getElementById('saveTransactionBtn')?.addEventListener('click',ev=>{
    const editId=txModal?.dataset.editingTransactionId||null;
    const existing=editId?state.transactions.find(t=>t.id===editId):null;
    const existingIndex=existing?state.transactions.findIndex(t=>t.id===editId):null;
    const oldAsset=existing?.assetId?state.assets.find(a=>a.id===existing.assetId):null;

    const accountId=document.getElementById('txPortfolio').value;
    const type=document.getElementById('txType').value;
    const trading=['Buy','Sell'].includes(type);

    // If an old trade is being changed into another asset/non-trade, make sure removing it does not break history.
    if(existing?.assetId&&['Buy','Sell'].includes(existing.type)){
      let sameOldAsset=false;
      if(trading){
        const ticker=normalizeTicker(document.getElementById('txTicker').value);
        const assetType=document.getElementById('txAssetType').value;
        const currency=document.getElementById('txCurrency').value;
        const target=assetType==='stock'?findStockAcrossCurrency(accountId,ticker,currency):findOptionFromForm(accountId,ticker);
        sameOldAsset=!!target&&target.id===existing.assetId;
      }
      if(!sameOldAsset){
        const oldCheck=validateSequence(existing.assetId,existing.id,null,existingIndex);
        if(!oldCheck.ok)return blockEvent(ev,`This edit would oversell ${oldAsset?.symbol||'the old holding'} on ${oldCheck.date}. Available: ${availableText(oldAsset,oldCheck.available)}.`);
      }
    }

    if(!trading)return;

    const assetType=document.getElementById('txAssetType').value;
    const ticker=normalizeTicker(document.getElementById('txTicker').value);
    const currency=document.getElementById('txCurrency').value;
    const date=document.getElementById('txDate').value||new Date().toISOString().slice(0,10);
    if(!ticker)return;

    const marketError=assetType==='stock'?marketCurrencyError(ticker,currency):'';
    if(marketError)return blockEvent(ev,marketError);

    let asset=assetType==='stock'?findStockAcrossCurrency(accountId,ticker,currency):findOptionFromForm(accountId,ticker);
    if(asset&&asset.currency&&asset.currency!==currency){
      return blockEvent(ev,`${asset.symbol} already uses ${asset.currency} in this portfolio. Keep the same currency for the same holding.`);
    }

    if(assetType==='option'){
      const strike=Number(document.getElementById('txStrike').value);
      const expiry=document.getElementById('txExpiry').value;
      if(!Number.isFinite(strike)||strike<=0)return blockEvent(ev,'Option strike must be greater than zero.');
      if(expiry&&date&&expiry<date)return blockEvent(ev,'Option expiry cannot be earlier than the transaction date.');
    }

    const q=formTradeQty(assetType,currency,asset);
    if(!q.ok)return blockEvent(ev,q.message);

    if(type==='Sell'&&!asset)return blockEvent(ev,'This holding does not exist in the selected portfolio. Record the Buy first.');

    if(asset){
      const proposed={
        id:existing?.id||'__proposed__',assetId:asset.id,type,qty:q.qty,date,
        price:Number(document.getElementById('txPrice').value)||0,
        fee:Number(document.getElementById('txFee').value)||0
      };
      const check=validateSequence(asset.id,existing?.id||null,proposed,existingIndex);
      if(!check.ok)return blockEvent(ev,`Not enough ${asset.type==='option'?'contracts':'shares'} on ${check.date}. Available: ${availableText(asset,check.available)}.`);
    }
  },true);

  // Cash / FX edit mode.
  function setCashModalMode(editing){
    const title=cashModal?.querySelector('h3');
    if(title)title.textContent=editing?'Edit Cash Action':'Cash Action';
    const btn=document.getElementById('saveCashBtn');
    if(btn)btn.textContent=editing?'Save Changes':'Save Cash Action';
  }

  const originalOpenCashModal=window.openCashModal;
  window.openCashModal=()=>{
    if(cashModal){delete cashModal.dataset.editKind;delete cashModal.dataset.editId;}
    setCashModalMode(false);
    return originalOpenCashModal();
  };

  window.openEditCash=id=>{
    const t=state.transactions.find(x=>x.id===id&&['Deposit','Withdrawal'].includes(x.type));
    if(!t)return toast('Cash transaction not found.',true);
    populatePortfolioSelects();
    cashModal.dataset.editKind='cash';cashModal.dataset.editId=id;
    document.getElementById('cashPortfolio').value=t.accountId;
    document.getElementById('cashAction').value=t.type;
    document.getElementById('cashCurrency').value=t.currency||'HKD';
    document.getElementById('cashAmount').value=Number(t.amount)||0;
    document.getElementById('cashDate').value=t.date||new Date().toISOString().slice(0,10);
    updateCashForm();setCashModalMode(true);openModal('cashModal');
  };

  window.openEditFx=id=>{
    const f=state.fx.find(x=>x.id===id);
    if(!f)return toast('FX transaction not found.',true);
    populatePortfolioSelects();
    cashModal.dataset.editKind='fx';cashModal.dataset.editId=id;
    document.getElementById('cashPortfolio').value=f.accountId;
    document.getElementById('cashAction').value='Exchange';
    document.getElementById('cashFrom').value=f.from;
    document.getElementById('cashFromAmount').value=Number(f.fromAmount)||0;
    document.getElementById('cashTo').value=f.to;
    document.getElementById('cashToAmount').value=Number(f.toAmount)||0;
    document.getElementById('cashFxFee').value=Number(f.fee)||0;
    document.getElementById('cashDate').value=f.date||new Date().toISOString().slice(0,10);
    updateCashForm();setCashModalMode(true);openModal('cashModal');
  };

  document.getElementById('saveCashBtn')?.addEventListener('click',ev=>{
    const kind=cashModal?.dataset.editKind;
    const id=cashModal?.dataset.editId;
    if(!kind||!id)return;
    ev.preventDefault();ev.stopImmediatePropagation();

    const accountId=document.getElementById('cashPortfolio').value;
    const action=document.getElementById('cashAction').value;
    const date=document.getElementById('cashDate').value||new Date().toISOString().slice(0,10);
    if(!accountId)return toast('Select a portfolio.',true);

    if(action==='Exchange'){
      const from=document.getElementById('cashFrom').value,to=document.getElementById('cashTo').value;
      const fromAmount=Number(document.getElementById('cashFromAmount').value),toAmount=Number(document.getElementById('cashToAmount').value),fee=Number(document.getElementById('cashFxFee').value)||0;
      if(from===to)return toast('Choose two different currencies.',true);
      if(!Number.isFinite(fromAmount)||fromAmount<=0||!Number.isFinite(toAmount)||toAmount<=0)return toast('Enter valid exchange amounts.',true);
      if(fee<0)return toast('FX fee cannot be negative.',true);
      if(kind==='fx'){
        const f=state.fx.find(x=>x.id===id);if(!f)return toast('FX transaction not found.',true);
        Object.assign(f,{accountId,from,to,fromAmount,toAmount,fee,date});
      }else{
        // Converting a Deposit/Withdrawal into FX is intentionally not allowed during edit.
        return toast('Change the action back to Deposit/Withdraw, or delete it and add an FX exchange.',true);
      }
    }else{
      if(!['Deposit','Withdrawal'].includes(action))return toast('Choose Deposit or Withdraw.',true);
      const currency=document.getElementById('cashCurrency').value,amount=Number(document.getElementById('cashAmount').value);
      if(!Number.isFinite(amount)||amount<=0)return toast('Enter a valid amount.',true);
      if(kind==='cash'){
        const t=state.transactions.find(x=>x.id===id);if(!t)return toast('Cash transaction not found.',true);
        Object.assign(t,{accountId,type:action,currency,amount,date,assetId:null,qty:0,price:0,fee:0});
      }else{
        return toast('Change the action back to Exchange, or delete it and add a cash transaction.',true);
      }
    }

    delete cashModal.dataset.editKind;delete cashModal.dataset.editId;
    setCashModalMode(false);
    save();closeModal('cashModal');currentPortfolioId=accountId;renderAll();showPortfolioTab('cash');toast('Cash action updated.');
  },true);

  // Replace cash rendering so every cash/FX entry has Edit + Delete.
  window.renderCashTab=renderCashTab=function(){
    if(!currentPortfolioId)return;
    const bal=cashBalancesFor(currentPortfolioId);
    document.getElementById('portfolioCashBalances').innerHTML=Object.entries(bal).map(([c,v])=>`<div class="cash-row"><strong>${c}</strong><span class="cash-balance ${v<0?'negative':''}">${money(v,c)}</span></div>`).join('');
    const cashTx=state.transactions.filter(t=>t.accountId===currentPortfolioId&&['Deposit','Withdrawal'].includes(t.type)).map(t=>({...t,kind:'cash'}));
    const fxTx=state.fx.filter(f=>f.accountId===currentPortfolioId).map(f=>({...f,kind:'fx'}));
    const rows=[...cashTx,...fxTx].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    document.getElementById('portfolioCashHistory').innerHTML=rows.length?rows.map(r=>{
      if(r.kind==='fx')return `<div class="tx-row"><div><div class="tx-title">Exchange · ${esc(r.from)} → ${esc(r.to)}</div><div class="tx-sub">${esc(r.date)}</div></div><div class="tx-actions"><div class="right">${money(r.fromAmount,r.from)}<div class="tx-sub">→ ${money(r.toAmount,r.to)}</div></div><button class="edit-btn" type="button" onclick="openEditFx('${r.id}')">Edit</button><button class="delete-btn" type="button" onclick="deleteFx('${r.id}')">Delete</button></div></div>`;
      return `<div class="tx-row"><div><div class="tx-title">${esc(r.type)}</div><div class="tx-sub">${esc(r.date)} · ${esc(r.currency)}</div></div><div class="tx-actions"><div class="right">${money(r.amount,r.currency)}</div><button class="edit-btn" type="button" onclick="openEditCash('${r.id}')">Edit</button><button class="delete-btn" type="button" onclick="deleteTransaction('${r.id}')">Delete</button></div></div>`;
    }).join(''):'<div class="empty">No cash activity yet.</div>';
  };

  // Position cycles: a fully closed cycle stays in Closed even if the same ticker is bought again later.
  function closedCyclesForAsset(asset){
    const rows=sortedTradeRows(asset.id);
    const mult=multiplier(asset);
    const cycles=[];
    let cycleNo=0,qty=0,cost=0,realized=0,buyCost=0,saleProceeds=0,buyQty=0,sellQty=0,startDate=null,txIds=[];

    const reset=()=>{qty=0;cost=0;realized=0;buyCost=0;saleProceeds=0;buyQty=0;sellQty=0;startDate=null;txIds=[];};
    for(const {t} of rows){
      const q=Number(t.qty)||0,p=Number(t.price)||0,fee=Number(t.fee)||0;
      if(q<=0)continue;
      if(t.type==='Buy'){
        if(qty<=EPS&&!startDate){cycleNo+=1;startDate=t.date||null;}
        qty+=q;
        const c=q*p*mult+fee;
        cost+=c;buyCost+=c;buyQty+=q;txIds.push(t.id);
      }else if(t.type==='Sell'){
        if(q>qty+EPS)continue;
        const avg=qty>EPS?cost/(qty*mult):0;
        realized+=q*(p-avg)*mult-fee;
        saleProceeds+=q*p*mult-fee;sellQty+=q;txIds.push(t.id);
        cost-=q*avg*mult;qty-=q;
        if(Math.abs(qty)<EPS){
          qty=0;cost=0;
          cycles.push({
            id:`${asset.id}::cycle::${cycleNo}`,assetId:asset.id,cycleNo,
            symbol:asset.symbol,name:asset.name,currency:asset.currency,type:asset.type,multiplier:asset.multiplier,
            startDate,closedDate:t.date||null,totalBuyCost:buyCost,totalSaleProceeds:saleProceeds,
            realized,closedReturnPct:buyCost?realized/buyCost*100:0,totalBuyQty:buyQty,totalSellQty:sellQty,txIds:[...txIds]
          });
          reset();
        }
      }
    }
    return cycles;
  }

  function closedCyclesFor(portfolioId){
    return state.assets.filter(a=>a.accountId===portfolioId).flatMap(closedCyclesForAsset).sort((a,b)=>(b.closedDate||'').localeCompare(a.closedDate||'')||b.cycleNo-a.cycleNo);
  }
  window.closedPositionCyclesFor=closedCyclesFor;

  function prettyDate(date){
    if(!date)return '—';
    const d=new Date(`${date}T00:00:00`);
    if(Number.isNaN(d.getTime()))return date;
    return new Intl.DateTimeFormat('en-HK',{day:'numeric',month:'short',year:'numeric'}).format(d);
  }

  function renderCycleClosedPositions(){
    document.querySelectorAll('.holding-status-count').forEach(el=>el.remove());
    const el=document.getElementById('portfolioClosedPositions');
    if(!el||!currentPortfolioId)return;
    const cycles=closedCyclesFor(currentPortfolioId);
    el.innerHTML=cycles.length?cycles.map(c=>`<div class="holding-row closed-position-row" onclick="openHoldingDetail('${c.id}')">
      <div><div class="holding-name">${esc(c.symbol)}</div><div class="holding-sub">${esc(c.name)}${c.cycleNo>1?` · Cycle ${c.cycleNo}`:''}</div></div>
      <div><div class="closed-date">Closed ${prettyDate(c.closedDate)}</div><div class="holding-sub">Buy cost ${money(c.totalBuyCost,c.currency)}</div></div>
      <div class="right"><div class="closed-pl ${c.realized<0?'negative':'positive'}">${signedMoney(c.realized,c.currency)}</div><div class="holding-sub">${pct(c.closedReturnPct)}</div></div>
    </div>`).join(''):'<div class="empty">No closed positions yet.</div>';
  }

  const previousRenderPortfolio=window.renderPortfolio||renderPortfolio;
  window.renderPortfolio=renderPortfolio=function(){
    previousRenderPortfolio();
    renderCycleClosedPositions();
  };

  const previousOpenHoldingDetail=window.openHoldingDetail;
  window.openHoldingDetail=id=>{
    if(!String(id).includes('::cycle::'))return previousOpenHoldingDetail(id);
    const cycle=closedCyclesFor(currentPortfolioId).find(c=>c.id===id);
    if(!cycle)return;
    const asset=state.assets.find(a=>a.id===cycle.assetId);
    const txs=state.transactions.filter(t=>cycle.txIds.includes(t.id)).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const updateBtn=document.getElementById('updatePriceBtn');if(updateBtn)updateBtn.classList.add('hidden');
    activeHoldingId=cycle.assetId;
    document.getElementById('holdingDetailTitle').textContent=cycle.symbol;
    document.getElementById('holdingDetailBody').innerHTML=`
      <div class="detail-grid">
        <div class="detail-cell"><span>Status</span><strong>Closed</strong></div>
        <div class="detail-cell"><span>Closed Date</span><strong>${prettyDate(cycle.closedDate)}</strong></div>
        <div class="detail-cell"><span>Total Buy Cost</span><strong>${money(cycle.totalBuyCost,cycle.currency)}</strong></div>
        <div class="detail-cell"><span>Sale Proceeds</span><strong>${money(cycle.totalSaleProceeds,cycle.currency)}</strong></div>
        <div class="detail-cell"><span>Realized P/L</span><strong class="${cycle.realized<0?'negative':'positive'}">${signedMoney(cycle.realized,cycle.currency)}</strong></div>
        <div class="detail-cell"><span>Realized Return</span><strong class="${cycle.closedReturnPct<0?'negative':'positive'}">${pct(cycle.closedReturnPct)}</strong></div>
        <div class="detail-cell"><span>Total Bought</span><strong>${cycle.totalBuyQty}</strong></div>
        <div class="detail-cell"><span>Total Sold</span><strong>${cycle.totalSellQty}</strong></div>
      </div>
      <div class="detail-title">Transaction history</div>
      <div class="detail-transactions">${txs.map(t=>`<div class="tx-row"><div><div class="tx-title">${esc(t.type)}</div><div class="tx-sub">${esc(t.date)} · ${formatTransactionQuantity(t,asset)} @ ${money(t.price,t.currency)}</div></div><div>${money((Number(t.qty)||0)*(Number(t.price)||0)*multiplier(asset),t.currency)}</div></div>`).join('')}</div>`;
    openModal('holdingModal');
  };

  // Make sure the current screen picks up the enhanced cash/cycle UI immediately.
  if(currentPortfolioId){renderCashTab();renderCycleClosedPositions();}
})();
