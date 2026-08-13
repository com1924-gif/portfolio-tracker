(()=>{
  if(window.__portfolioLifecycleInstalledV28)return;
  window.__portfolioLifecycleInstalledV28=true;

  const EPS=1e-9;
  let holdingStatusMode='open';

  function tradeRowsForAsset(assetId){
    return state.transactions
      .map((t,index)=>({t,index}))
      .filter(x=>x.t.assetId===assetId&&['Buy','Sell'].includes(x.t.type))
      .sort((a,b)=>(a.t.date||'').localeCompare(b.t.date||'')||a.index-b.index);
  }

  function calculatePosition(asset){
    const rows=tradeRowsForAsset(asset.id);
    const mult=multiplier(asset);
    let qty=0,cost=0,realized=0,totalBuyCost=0,totalSaleProceeds=0,totalBuyQty=0,totalSellQty=0;
    let firstBuyDate=null,lastTradeDate=null,closedDate=null;

    for(const {t} of rows){
      const q=Number(t.qty)||0,p=Number(t.price)||0,fee=Number(t.fee)||0;
      if(!q)continue;
      lastTradeDate=t.date||lastTradeDate;
      if(t.type==='Buy'){
        qty+=q;
        const buyCost=q*p*mult+fee;
        cost+=buyCost;
        totalBuyCost+=buyCost;
        totalBuyQty+=q;
        if(!firstBuyDate)firstBuyDate=t.date||null;
        closedDate=null;
      }else if(t.type==='Sell'){
        const avg=qty>EPS?cost/(qty*mult):0;
        realized+=q*(p-avg)*mult-fee;
        totalSaleProceeds+=q*p*mult-fee;
        totalSellQty+=q;
        cost-=q*avg*mult;
        qty-=q;
        if(Math.abs(qty)<EPS){qty=0;cost=0;closedDate=t.date||null;}
      }
    }

    const avgCost=qty>EPS?cost/(qty*mult):0;
    const marketValue=qty*(Number(asset.price)||0)*mult;
    const unrealized=marketValue-cost;
    const totalPL=realized+unrealized;
    const returnPct=cost?unrealized/cost*100:0;
    const closedReturnPct=totalBuyCost?realized/totalBuyCost*100:0;
    return {
      ...asset,qty,cost,avgCost,realized,marketValue,unrealized,totalPL,returnPct,
      totalBuyCost,totalSaleProceeds,totalBuyQty,totalSellQty,firstBuyDate,lastTradeDate,closedDate,
      closedReturnPct,isClosed:Math.abs(qty)<EPS&&totalBuyQty>EPS
    };
  }

  function positionsFor(portfolioId=null){
    return state.assets
      .filter(a=>!portfolioId||a.accountId===portfolioId)
      .map(calculatePosition)
      .filter(p=>p.totalBuyQty>EPS||Math.abs(p.qty)>EPS);
  }

  function lifecycleHoldingsFor(portfolioId=null){
    return positionsFor(portfolioId).filter(p=>p.qty>EPS);
  }

  function closedPositionsFor(portfolioId=null){
    return positionsFor(portfolioId).filter(p=>p.isClosed);
  }

  function lifecycleSummaryFor(portfolioId=null){
    const positions=positionsFor(portfolioId);
    const hs=positions.filter(p=>p.qty>EPS);
    const closed=positions.filter(p=>p.isClosed);
    const cashBal=cashBalancesFor(portfolioId);
    const invested=hs.reduce((s,h)=>s+convert(h.marketValue,h.currency),0);
    const unrealized=hs.reduce((s,h)=>s+convert(h.unrealized,h.currency),0);
    const realized=positions.reduce((s,h)=>s+convert(h.realized,h.currency),0);
    const cash=Object.entries(cashBal).reduce((s,[c,v])=>s+convert(v,c),0);
    const net=invested+cash;
    return {positions,closed,hs,cashBal,invested,unrealized,realized,totalPL:unrealized+realized,cash,net,exposure:net?invested/net:0};
  }

  window.positionsFor=positionsFor;
  window.holdingsFor=lifecycleHoldingsFor;
  window.closedPositionsFor=closedPositionsFor;
  window.summaryFor=lifecycleSummaryFor;

  const style=document.createElement('style');
  style.textContent=`
    .holding-status-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#111115;border:1px solid var(--line);padding:5px;border-radius:15px;margin:0 0 12px}
    .holding-status-btn{border:0;background:transparent;color:var(--muted);padding:10px 12px;border-radius:11px;font-weight:800;cursor:pointer}
    .holding-status-btn.active{background:var(--accent);color:#202025}
    .holding-status-count{opacity:.75;margin-left:4px}
    .closed-position-row{grid-template-columns:minmax(0,1.25fr) .9fr .8fr}
    .closed-position-row .closed-date{font-size:12px;color:var(--muted)}
    .closed-position-row .closed-pl{font-weight:800}
    @media(max-width:520px){.closed-position-row{grid-template-columns:minmax(0,1.15fr) .9fr .8fr}}
  `;
  document.head.appendChild(style);

  function injectHoldingsLifecycleUI(){
    const tab=document.getElementById('tab-holdings');
    if(!tab||document.getElementById('holdingStatusTabs'))return;
    const head=tab.querySelector('.sticky-section-head');
    const hint=head?.querySelector('.muted');
    if(hint)hint.textContent='Open and closed positions';
    const openList=document.getElementById('portfolioHoldingsFull');
    if(!openList)return;

    const tabs=document.createElement('div');
    tabs.id='holdingStatusTabs';
    tabs.className='holding-status-tabs';
    tabs.innerHTML=`
      <button type="button" class="holding-status-btn active" data-status="open">Open <span id="openPositionCount" class="holding-status-count">0</span></button>
      <button type="button" class="holding-status-btn" data-status="closed">Closed <span id="closedPositionCount" class="holding-status-count">0</span></button>`;
    openList.before(tabs);

    const closed=document.createElement('div');
    closed.id='portfolioClosedPositions';
    closed.className='holding-list hidden';
    openList.after(closed);

    tabs.querySelectorAll('.holding-status-btn').forEach(btn=>btn.addEventListener('click',()=>showHoldingStatus(btn.dataset.status)));
  }

  function showHoldingStatus(mode){
    holdingStatusMode=mode==='closed'?'closed':'open';
    const open=document.getElementById('portfolioHoldingsFull');
    const closed=document.getElementById('portfolioClosedPositions');
    if(open)open.classList.toggle('hidden',holdingStatusMode!=='open');
    if(closed)closed.classList.toggle('hidden',holdingStatusMode!=='closed');
    document.querySelectorAll('.holding-status-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.status===holdingStatusMode));
  }
  window.showHoldingStatus=showHoldingStatus;

  function prettyDate(date){
    if(!date)return '—';
    const d=new Date(`${date}T00:00:00`);
    if(Number.isNaN(d.getTime()))return date;
    return new Intl.DateTimeFormat('en-HK',{day:'numeric',month:'short',year:'numeric'}).format(d);
  }

  function renderClosedPositions(){
    injectHoldingsLifecycleUI();
    if(!currentPortfolioId)return;
    const open=holdingsFor(currentPortfolioId);
    const closed=closedPositionsFor(currentPortfolioId).slice().sort((a,b)=>(b.closedDate||'').localeCompare(a.closedDate||''));
    const openCount=document.getElementById('openPositionCount');
    const closedCount=document.getElementById('closedPositionCount');
    if(openCount)openCount.textContent=String(open.length);
    if(closedCount)closedCount.textContent=String(closed.length);
    const el=document.getElementById('portfolioClosedPositions');
    if(el){
      el.innerHTML=closed.length?closed.map(p=>`<div class="holding-row closed-position-row" onclick="openHoldingDetail('${p.id}')">
        <div><div class="holding-name">${esc(p.symbol)}</div><div class="holding-sub">${esc(p.name)}</div></div>
        <div><div class="closed-date">Closed ${prettyDate(p.closedDate)}</div><div class="holding-sub">Buy cost ${money(p.totalBuyCost,p.currency)}</div></div>
        <div class="right"><div class="closed-pl ${p.realized<0?'negative':'positive'}">${signedMoney(p.realized,p.currency)}</div><div class="holding-sub">${pct(p.closedReturnPct)}</div></div>
      </div>`).join(''):'<div class="empty">No closed positions yet.</div>';
    }
    showHoldingStatus(holdingStatusMode);
  }

  const originalRenderPortfolio=window.renderPortfolio||renderPortfolio;
  window.renderPortfolio=renderPortfolio=function(){
    originalRenderPortfolio();
    renderClosedPositions();
  };

  const originalOpenHoldingDetail=window.openHoldingDetail;
  if(originalOpenHoldingDetail){
    window.openHoldingDetail=id=>{
      const p=positionsFor(currentPortfolioId).find(x=>x.id===id);
      if(!p)return;
      const updateBtn=document.getElementById('updatePriceBtn');
      if(!p.isClosed){
        if(updateBtn)updateBtn.classList.remove('hidden');
        return originalOpenHoldingDetail(id);
      }
      activeHoldingId=id;
      if(updateBtn)updateBtn.classList.add('hidden');
      document.getElementById('holdingDetailTitle').textContent=p.symbol;
      const txs=state.transactions.filter(t=>t.assetId===id).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      document.getElementById('holdingDetailBody').innerHTML=`
        <div class="detail-grid">
          <div class="detail-cell"><span>Status</span><strong>Closed</strong></div>
          <div class="detail-cell"><span>Closed Date</span><strong>${prettyDate(p.closedDate)}</strong></div>
          <div class="detail-cell"><span>Total Buy Cost</span><strong>${money(p.totalBuyCost,p.currency)}</strong></div>
          <div class="detail-cell"><span>Sale Proceeds</span><strong>${money(p.totalSaleProceeds,p.currency)}</strong></div>
          <div class="detail-cell"><span>Realized P/L</span><strong class="${p.realized<0?'negative':'positive'}">${signedMoney(p.realized,p.currency)}</strong></div>
          <div class="detail-cell"><span>Realized Return</span><strong class="${p.closedReturnPct<0?'negative':'positive'}">${pct(p.closedReturnPct)}</strong></div>
          <div class="detail-cell"><span>Total Bought</span><strong>${p.totalBuyQty}</strong></div>
          <div class="detail-cell"><span>Total Sold</span><strong>${p.totalSellQty}</strong></div>
        </div>
        <div class="detail-title">Transaction history</div>
        <div class="detail-transactions">${txs.map(t=>`<div class="tx-row"><div><div class="tx-title">${esc(t.type)}</div><div class="tx-sub">${esc(t.date)}${t.qty?` · ${formatTransactionQuantity(t,p)} @ ${money(t.price,t.currency)}`:''}</div></div><div>${t.amount!=null?money(t.amount,t.currency):money((t.qty||0)*(t.price||0)*multiplier(p),t.currency)}</div></div>`).join('')||'<div class="empty">No history.</div>'}</div>`;
      openModal('holdingModal');
    };
  }

  function canonicalStockTickerLocal(ticker,currency){
    const raw=normalizeTicker(ticker);
    if(!raw)return '';
    if(raw.includes('.'))return raw;
    if(currency==='HKD'&&/^\d{1,5}$/.test(raw))return raw.padStart(4,'0')+'.HK';
    if(currency==='KRW'&&/^\d{6}$/.test(raw))return raw+'.KS';
    return raw;
  }

  function findFormAsset(accountId,assetType,ticker,currency){
    if(assetType==='stock'){
      const raw=normalizeTicker(ticker);
      const canonical=canonicalStockTickerLocal(ticker,currency);
      return state.assets.find(a=>a.accountId===accountId&&a.type==='stock'&&(
        normalizeTicker(a.symbol)===raw||canonicalStockTickerLocal(a.symbol,a.currency)===canonical
      ));
    }
    return findAsset({
      accountId,type:'option',ticker:normalizeTicker(ticker),optionType:document.getElementById('txOptionType').value,
      strike:Number(document.getElementById('txStrike').value),expiry:document.getElementById('txExpiry').value
    });
  }

  function validateTradeSequence(assetId,proposed=null,excludeId=null,preferredOrder=null){
    if(!assetId)return {ok:true};
    const rows=[];
    state.transactions.forEach((t,index)=>{
      if(t.assetId!==assetId||!['Buy','Sell'].includes(t.type)||t.id===excludeId)return;
      rows.push({t,index});
    });
    if(proposed)rows.push({t:proposed,index:Number.isInteger(preferredOrder)?preferredOrder:state.transactions.length+1});
    rows.sort((a,b)=>(a.t.date||'').localeCompare(b.t.date||'')||a.index-b.index);
    let qty=0;
    for(const {t} of rows){
      const q=Number(t.qty)||0;
      if(t.type==='Buy')qty+=q;
      else if(t.type==='Sell'){
        if(q>qty+EPS)return {ok:false,available:Math.max(0,qty),date:t.date||'',transaction:t};
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

  const txModal=document.getElementById('transactionModal');
  const originalOpenTransactionModal=window.openTransactionModal;
  window.openTransactionModal=()=>{
    if(txModal)delete txModal.dataset.editingTransactionId;
    return originalOpenTransactionModal();
  };
  const originalOpenEditTransaction=window.openEditTransaction;
  window.openEditTransaction=id=>{
    if(txModal)txModal.dataset.editingTransactionId=id;
    return originalOpenEditTransaction(id);
  };

  document.getElementById('saveTransactionBtn')?.addEventListener('click',ev=>{
    const editId=txModal?.dataset.editingTransactionId||null;
    const existing=editId?state.transactions.find(t=>t.id===editId):null;
    const existingIndex=existing?state.transactions.findIndex(t=>t.id===editId):null;
    const oldAsset=existing?.assetId?state.assets.find(a=>a.id===existing.assetId):null;

    const accountId=document.getElementById('txPortfolio').value;
    const type=document.getElementById('txType').value;
    const trading=['Buy','Sell'].includes(type);
    const assetType=document.getElementById('txAssetType').value;
    const ticker=normalizeTicker(document.getElementById('txTicker').value);
    const currency=document.getElementById('txCurrency').value;
    const date=document.getElementById('txDate').value||new Date().toISOString().slice(0,10);
    const targetAsset=trading&&ticker?findFormAsset(accountId,assetType,ticker,currency):null;

    if(existing?.assetId&&(!trading||!targetAsset||targetAsset.id!==existing.assetId)){
      const oldCheck=validateTradeSequence(existing.assetId,null,editId,existingIndex);
      if(!oldCheck.ok){
        ev.preventDefault();ev.stopImmediatePropagation();
        toast(`This edit would oversell ${oldAsset?.symbol||'the old holding'} on ${oldCheck.date}. Available: ${availableText(oldAsset,oldCheck.available)}.`,true);
        return;
      }
    }

    if(!trading||!targetAsset)return;
    const enteredQty=Number(document.getElementById('txQty').value);
    if(!Number.isFinite(enteredQty)||enteredQty<=0)return;
    let qty=enteredQty;
    if(assetType==='stock'&&currency==='HKD'&&document.getElementById('txQtyMode').value==='lots'){
      const lotSize=Number(document.getElementById('txLotSize').value)||Number(targetAsset.lotSize)||0;
      if(lotSize>0)qty=enteredQty*lotSize;
    }
    const proposed={id:editId||'__proposed__',accountId,type,assetId:targetAsset.id,currency,qty,date};
    const check=validateTradeSequence(targetAsset.id,proposed,editId,existingIndex);
    if(!check.ok){
      ev.preventDefault();ev.stopImmediatePropagation();
      toast(`Sell exceeds available ${targetAsset.symbol} on ${check.date}. Available: ${availableText(targetAsset,check.available)}.`,true);
    }
  },true);

  injectHoldingsLifecycleUI();
  renderAll();
})();
