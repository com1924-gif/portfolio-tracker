(()=>{
  if(window.__portfolioOptionComboInstalledV22511)return;
  window.__portfolioOptionComboInstalledV22511=true;

  function inject(){
    if(document.getElementById('optionComboModal'))return;

    const head=document.querySelector('#tab-transactions .sticky-section-head');
    const newBtn=head?.querySelector('button.primary-btn');
    if(head&&newBtn&&!document.getElementById('openOptionComboBtn')){
      const wrap=document.createElement('div');
      wrap.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end';
      newBtn.parentElement.insertBefore(wrap,newBtn);
      wrap.appendChild(newBtn);
      const btn=document.createElement('button');
      btn.id='openOptionComboBtn';
      btn.type='button';
      btn.className='ghost-btn';
      btn.textContent='Bull Call Spread';
      btn.addEventListener('click',openOptionCombo);
      wrap.appendChild(btn);
    }

    const modal=document.createElement('div');
    modal.id='optionComboModal';
    modal.className='modal-overlay hidden';
    modal.innerHTML=`
      <div class="modal-wrap"><form class="modal-card" onsubmit="return false;">
        <div class="section-head"><div><div class="brand">OPTION STRATEGY</div><h3>Bull Call Spread</h3></div><button type="button" class="icon-btn" id="closeOptionComboBtn">×</button></div>
        <div class="option-combo-note">Supports a true short call leg. Sell Call can open from zero position; it is tracked as a liability, not immediate realized profit.</div>

        <label>Mode<select id="comboMode">
          <option value="both">Open new spread (record both legs)</option>
          <option value="shortOnly">Add short leg only (long leg already recorded)</option>
        </select></label>

        <label>Portfolio<select id="comboPortfolio"></select></label>
        <label>Underlying<input id="comboTicker" autocomplete="off" placeholder="COHR" /></label>
        <label>Name<input id="comboName" placeholder="Coherent Corp." /></label>

        <div class="option-fields">
          <label>Currency<select id="comboCurrency"><option>USD</option><option>HKD</option><option>KRW</option><option>EUR</option></select></label>
          <label>Contracts<input id="comboQty" type="number" min="1" step="1" value="1" /></label>
        </div>
        <div class="option-fields">
          <label>Expiry<input id="comboExpiry" type="date" /></label>
          <label>Date<input id="comboDate" type="date" /></label>
        </div>

        <div id="comboBuyLeg" class="option-combo-leg">
          <div class="option-combo-leg-title"><span class="positive">BUY CALL</span><span>Long leg</span></div>
          <div class="option-fields">
            <label>Buy Strike<input id="comboBuyStrike" type="number" step="0.01" placeholder="340" /></label>
            <label>Buy Price<input id="comboBuyPrice" type="number" step="0.01" placeholder="34.52" /></label>
          </div>
          <label>Buy Fee<input id="comboBuyFee" type="number" min="0" step="0.01" value="0" /></label>
        </div>

        <div class="option-combo-leg">
          <div class="option-combo-leg-title"><span class="negative">SELL CALL</span><span>Short leg · Sell to Open</span></div>
          <div class="option-fields">
            <label>Sell Strike<input id="comboSellStrike" type="number" step="0.01" placeholder="420" /></label>
            <label>Sell Price<input id="comboSellPrice" type="number" step="0.01" placeholder="24.37" /></label>
          </div>
          <label>Sell Fee<input id="comboSellFee" type="number" min="0" step="0.01" value="0" /></label>
        </div>

        <div id="comboSummary" class="option-combo-summary"></div>
        <button type="button" id="saveOptionComboBtn" class="primary-btn full">Record Bull Call Spread</button>
      </form></div>`;
    document.body.appendChild(modal);

    const style=document.createElement('style');
    style.textContent=`
      .option-combo-note{font-size:11px;line-height:1.5;color:var(--muted);background:#151519;border:1px solid var(--line);border-radius:12px;padding:10px 12px}
      .option-combo-leg{display:grid;gap:10px;background:#151519;border:1px solid var(--line);border-radius:16px;padding:13px}
      .option-combo-leg-title{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:12px;color:var(--muted);font-weight:800}
      .option-combo-leg-title span:first-child{font-size:13px}
      .option-combo-summary{font-size:12px;line-height:1.5;background:#101014;border:1px solid var(--line);border-radius:13px;padding:11px 12px;color:#ddd}
    `;
    document.head.appendChild(style);

    document.getElementById('closeOptionComboBtn').addEventListener('click',()=>closeModal('optionComboModal'));
    document.getElementById('comboMode').addEventListener('change',syncMode);
    ['comboQty','comboBuyPrice','comboSellPrice','comboBuyFee','comboSellFee','comboCurrency'].forEach(id=>
      document.getElementById(id).addEventListener('input',renderSummary)
    );
    document.getElementById('saveOptionComboBtn').addEventListener('click',saveCombo);
  }

  function fillPortfolios(){
    const sel=document.getElementById('comboPortfolio');
    sel.innerHTML=state.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
    if(currentPortfolioId&&state.accounts.some(a=>a.id===currentPortfolioId))sel.value=currentPortfolioId;
  }

  function syncMode(){
    const shortOnly=document.getElementById('comboMode').value==='shortOnly';
    document.getElementById('comboBuyLeg').classList.toggle('hidden',shortOnly);
    document.getElementById('saveOptionComboBtn').textContent=shortOnly?'Record Short Call Leg':'Record Bull Call Spread';
    renderSummary();
  }

  function renderSummary(){
    const mode=document.getElementById('comboMode')?.value||'both';
    const qty=Number(document.getElementById('comboQty')?.value)||0;
    const buy=Number(document.getElementById('comboBuyPrice')?.value);
    const sell=Number(document.getElementById('comboSellPrice')?.value);
    const bf=Number(document.getElementById('comboBuyFee')?.value)||0;
    const sf=Number(document.getElementById('comboSellFee')?.value)||0;
    const c=document.getElementById('comboCurrency')?.value||'USD';
    const el=document.getElementById('comboSummary');
    if(!el)return;

    if(mode==='shortOnly'){
      if(qty>0&&Number.isFinite(sell)){
        const credit=sell*qty*100-sf;
        el.textContent=`Short leg opening credit: ${money(credit,c)} · ${qty} contract${qty===1?'':'s'}`;
      }else el.textContent='Enter the short call execution price.';
      return;
    }

    if(qty>0&&Number.isFinite(buy)&&Number.isFinite(sell)){
      const net=(buy-sell)*qty*100+bf+sf;
      el.textContent=`Net spread debit: ${money(net,c)} · ${qty} spread${qty===1?'':'s'}`;
    }else el.textContent='Enter both execution prices to preview the net debit.';
  }

  function reset(){
    fillPortfolios();
    document.getElementById('comboMode').value='both';
    document.getElementById('comboTicker').value='';
    document.getElementById('comboName').value='';
    document.getElementById('comboCurrency').value='USD';
    document.getElementById('comboQty').value='1';
    document.getElementById('comboExpiry').value='';
    document.getElementById('comboDate').value=typeof today==='function'?today():new Date().toISOString().slice(0,10);
    document.getElementById('comboBuyStrike').value='';
    document.getElementById('comboBuyPrice').value='';
    document.getElementById('comboBuyFee').value='0';
    document.getElementById('comboSellStrike').value='';
    document.getElementById('comboSellPrice').value='';
    document.getElementById('comboSellFee').value='0';
    syncMode();
  }

  function openOptionCombo(){
    inject();
    reset();
    openModal('optionComboModal');
  }
  window.openOptionCombo=openOptionCombo;

  function findOrCreateLongAsset({accountId,ticker,name,currency,strike,expiry,price}){
    let a=findAsset({accountId,type:'option',ticker,optionType:'Call',strike,expiry});
    if(!a){
      a=ensureAsset({
        accountId,type:'option',ticker,name,currency,tradePrice:price,currentPrice:0,
        optionType:'Call',strike,expiry,multiplier:100
      });
    }
    a.name=name;
    a.currency=currency;
    a.multiplier=100;
    return a;
  }

  function findOrCreateShortAsset({accountId,ticker,name,currency,strike,expiry,price}){
    let a=state.assets.find(x=>
      x.accountId===accountId&&x.type==='option'&&x.positionSide==='short'&&
      normalizeTicker(x.underlying||String(x.symbol||'').split(' ')[0])===ticker&&
      x.optionType==='Call'&&Number(x.strike)===Number(strike)&&x.expiry===expiry
    );
    if(a)return a;

    a={
      id:uid('asset_'),accountId,type:'option',positionSide:'short',
      symbol:optionSymbol(ticker,'Call',strike,expiry),
      underlying:ticker,name,currency,price,
      optionType:'Call',strike,expiry,multiplier:100
    };
    state.assets.push(a);
    return a;
  }

  function saveCombo(){
    try{
      const mode=document.getElementById('comboMode').value;
      const accountId=document.getElementById('comboPortfolio').value;
      const ticker=normalizeTicker(document.getElementById('comboTicker').value);
      const name=document.getElementById('comboName').value.trim()||ticker;
      const currency=document.getElementById('comboCurrency').value;
      const qty=Number(document.getElementById('comboQty').value);
      const expiry=document.getElementById('comboExpiry').value;
      const date=document.getElementById('comboDate').value||today();
      const buyStrike=Number(document.getElementById('comboBuyStrike').value);
      const buyPrice=Number(document.getElementById('comboBuyPrice').value);
      const buyFee=Number(document.getElementById('comboBuyFee').value)||0;
      const sellStrike=Number(document.getElementById('comboSellStrike').value);
      const sellPrice=Number(document.getElementById('comboSellPrice').value);
      const sellFee=Number(document.getElementById('comboSellFee').value)||0;

      if(!accountId||!ticker)return toast('Choose a portfolio and enter the underlying ticker.',true);
      if(!Number.isInteger(qty)||qty<=0)return toast('Contracts must be a positive whole number.',true);
      if(!expiry)return toast('Enter the option expiry.',true);
      if(expiry<date)return toast('Option expiry cannot be earlier than the transaction date.',true);
      if(!Number.isFinite(sellStrike)||sellStrike<=0)return toast('Enter a valid Sell strike.',true);
      if(!Number.isFinite(sellPrice)||sellPrice<0)return toast('Enter a valid Sell price.',true);
      if(sellFee<0||buyFee<0)return toast('Fees cannot be negative.',true);

      if(mode==='both'){
        if(!Number.isFinite(buyStrike)||buyStrike<=0)return toast('Enter a valid Buy strike.',true);
        if(!Number.isFinite(buyPrice)||buyPrice<0)return toast('Enter a valid Buy price.',true);
        if(!(sellStrike>buyStrike))return toast('For a bull call spread, the Sell strike must be above the Buy strike.',true);
      }

      const strategyId=uid('strategy_');

      if(mode==='both'){
        const buyAsset=findOrCreateLongAsset({accountId,ticker,name,currency,strike:buyStrike,expiry,price:buyPrice});
        state.transactions.push({
          id:uid('t_'),accountId,type:'Buy',assetId:buyAsset.id,currency,
          qty,price:buyPrice,fee:buyFee,date,enteredQty:qty,quantityMode:'contracts',
          strategyId,strategyType:'bull_call_spread',strategyLeg:'long'
        });
      }

      const shortAsset=findOrCreateShortAsset({accountId,ticker,name,currency,strike:sellStrike,expiry,price:sellPrice});
      shortAsset.price=sellPrice;
      state.transactions.push({
        id:uid('t_'),accountId,type:'Sell',assetId:shortAsset.id,currency,
        qty,price:sellPrice,fee:sellFee,date,enteredQty:qty,quantityMode:'contracts',
        strategyId,strategyType:'bull_call_spread',strategyLeg:'short',positionEffect:'open'
      });

      save();
      closeModal('optionComboModal');
      currentPortfolioId=accountId;
      renderAll();
      if(typeof showPortfolioTab==='function')showPortfolioTab('transactions');
      toast(mode==='shortOnly'?'Short call leg recorded.':'Bull call spread recorded.');
    }catch(err){
      console.error(err);
      toast(`Could not record bull call spread: ${err.message}`,true);
    }
  }

  async function applyOptionComboPrefillFromUrl(){
    const params=new URLSearchParams(window.location.search);
    if(params.get('prefill')!=='optionCombo')return false;

    inject();
    reset();

    const portfolioRef=(params.get('portfolio')||'').trim();
    const portfolio=state.accounts.find(a=>
      a.id===portfolioRef||
      String(a.name||'').trim().toLowerCase()===portfolioRef.toLowerCase()
    );
    if(!portfolio){
      toast(`Portfolio "${portfolioRef||'unknown'}" was not found on this device.`,true);
      return false;
    }

    const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!=null&&v!=='')el.value=String(v);};
    set('comboMode',params.get('mode')==='shortOnly'?'shortOnly':'both');
    set('comboPortfolio',portfolio.id);
    set('comboTicker',normalizeTicker(params.get('ticker')));
    set('comboName',params.get('name')||'');
    set('comboCurrency',params.get('currency')||'USD');
    set('comboQty',params.get('qty')||1);
    set('comboExpiry',params.get('expiry')||'');
    set('comboDate',params.get('date')||(typeof today==='function'?today():new Date().toISOString().slice(0,10)));
    set('comboBuyStrike',params.get('buyStrike')||'');
    set('comboBuyPrice',params.get('buyPrice')||'');
    set('comboBuyFee',params.get('buyFee')||0);
    set('comboSellStrike',params.get('sellStrike')||'');
    set('comboSellPrice',params.get('sellPrice')||'');
    set('comboSellFee',params.get('sellFee')||0);
    syncMode();
    renderSummary();
    openModal('optionComboModal');

    try{
      const url=new URL(window.location.href);
      ['prefill','portfolio','mode','ticker','name','currency','qty','expiry','date','buyStrike','buyPrice','buyFee','sellStrike','sellPrice','sellFee']
        .forEach(k=>url.searchParams.delete(k));
      history.replaceState(null,'',url.pathname+(url.searchParams.toString()?('?'+url.searchParams.toString()):'')+url.hash);
    }catch{}
    return true;
  }

  window.applyOptionComboPrefillFromUrl=applyOptionComboPrefillFromUrl;
  inject();
})();