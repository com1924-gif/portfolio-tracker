(()=>{
  if(window.__portfolioOptionComboInstalledV22510)return;
  window.__portfolioOptionComboInstalledV22510=true;

  const EPS=1e-9;

  function openPositions(accountId){
    if(typeof positionsFor!=='function')return [];
    return positionsFor(accountId).filter(p=>p.type==='option'&&Number(p.qty)>EPS);
  }

  function availableOnDate(assetId,date){
    const rows=state.transactions
      .map((t,index)=>({t,index}))
      .filter(x=>x.t.assetId===assetId&&['Buy','Sell'].includes(x.t.type)&&(x.t.date||'')<=date)
      .sort((a,b)=>(a.t.date||'').localeCompare(b.t.date||'')||a.index-b.index);
    let qty=0;
    for(const {t} of rows){
      const q=Number(t.qty)||0;
      if(t.type==='Buy')qty+=q;
      else qty-=q;
    }
    return Math.max(0,qty);
  }

  function inject(){
    if(document.getElementById('optionComboModal'))return;

    const head=document.querySelector('#tab-transactions .sticky-section-head');
    const newBtn=head?.querySelector('button.primary-btn');
    if(head&&newBtn&&!document.getElementById('openOptionComboBtn')){
      const actions=document.createElement('div');
      actions.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end';
      newBtn.parentElement.insertBefore(actions,newBtn);
      actions.appendChild(newBtn);
      const btn=document.createElement('button');
      btn.id='openOptionComboBtn';
      btn.type='button';
      btn.className='ghost-btn';
      btn.textContent='Call Roll / Spread';
      btn.addEventListener('click',openOptionCombo);
      actions.appendChild(btn);
    }

    const modal=document.createElement('div');
    modal.id='optionComboModal';
    modal.className='modal-overlay hidden';
    modal.innerHTML=`
      <div class="modal-wrap"><form class="modal-card" onsubmit="return false;">
        <div class="section-head"><div><div class="brand">OPTION COMBO</div><h3>Call Roll / Spread</h3></div><button type="button" class="icon-btn" id="closeOptionComboBtn">×</button></div>
        <div class="option-combo-note">Record a call combo in one step. The Sell leg must be an existing open call, so the app can preserve correct realized P/L and cost basis.</div>
        <label>Portfolio<select id="comboPortfolio"></select></label>
        <label>Underlying<input id="comboTicker" autocomplete="off" placeholder="COHR" /></label>
        <label>Name<input id="comboName" placeholder="Coherent Corp." /></label>
        <div class="option-fields">
          <label>Currency<select id="comboCurrency"><option>USD</option><option>HKD</option><option>KRW</option><option>EUR</option></select></label>
          <label>Contracts<input id="comboQty" type="number" min="1" step="1" value="1" /></label>
        </div>
        <div class="option-fields">
          <label>Strategy Expiry<input id="comboExpiry" type="date" /></label>
          <label>Date<input id="comboDate" type="date" /></label>
        </div>

        <div class="option-combo-leg">
          <div class="option-combo-leg-title"><span class="positive">BUY CALL</span><span>Lower strike / new leg</span></div>
          <div class="option-fields">
            <label>Buy Strike<input id="comboBuyStrike" type="number" step="0.01" placeholder="340" /></label>
            <label>Buy Price<input id="comboBuyPrice" type="number" step="0.01" placeholder="34.52" /></label>
          </div>
          <label>Buy Fee<input id="comboBuyFee" type="number" min="0" step="0.01" value="0" /></label>
        </div>

        <div class="option-combo-leg">
          <div class="option-combo-leg-title"><span class="negative">SELL CALL</span><span>Existing open leg</span></div>
          <label>Existing Call<select id="comboSellAsset"></select></label>
          <div id="comboSellMeta" class="muted"></div>
          <div class="option-fields">
            <label>Sell Price<input id="comboSellPrice" type="number" step="0.01" placeholder="24.37" /></label>
            <label>Sell Fee<input id="comboSellFee" type="number" min="0" step="0.01" value="0" /></label>
          </div>
          <label class="option-combo-check"><input id="comboAlignExpiry" type="checkbox" checked /> Align selected Sell leg to Strategy Expiry when saved</label>
        </div>

        <div id="comboSummary" class="option-combo-summary"></div>
        <button type="button" id="saveOptionComboBtn" class="primary-btn full">Record Both Legs</button>
      </form></div>`;
    document.body.appendChild(modal);

    const style=document.createElement('style');
    style.textContent=`
      .option-combo-note{font-size:11px;line-height:1.5;color:var(--muted);background:#151519;border:1px solid var(--line);border-radius:12px;padding:10px 12px}
      .option-combo-leg{display:grid;gap:10px;background:#151519;border:1px solid var(--line);border-radius:16px;padding:13px}
      .option-combo-leg-title{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:12px;color:var(--muted);font-weight:800}
      .option-combo-leg-title span:first-child{font-size:13px}
      .option-combo-check{display:flex!important;grid-template-columns:18px 1fr!important;align-items:center!important;gap:8px!important;font-weight:600!important}
      .option-combo-check input{width:18px!important;height:18px!important;margin:0}
      .option-combo-summary{font-size:12px;line-height:1.5;background:#101014;border:1px solid var(--line);border-radius:13px;padding:11px 12px;color:#ddd}
    `;
    document.head.appendChild(style);

    document.getElementById('closeOptionComboBtn').addEventListener('click',()=>closeModal('optionComboModal'));
    document.getElementById('comboPortfolio').addEventListener('change',refreshSellChoices);
    document.getElementById('comboTicker').addEventListener('input',refreshSellChoices);
    document.getElementById('comboSellAsset').addEventListener('change',()=>{syncFromSellLeg();renderSummary();});
    ['comboQty','comboBuyStrike','comboBuyPrice','comboSellPrice','comboBuyFee','comboSellFee'].forEach(id=>
      document.getElementById(id).addEventListener('input',renderSummary)
    );
    document.getElementById('saveOptionComboBtn').addEventListener('click',saveCombo);
  }

  function fillPortfolios(){
    const sel=document.getElementById('comboPortfolio');
    sel.innerHTML=state.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
    if(currentPortfolioId&&state.accounts.some(a=>a.id===currentPortfolioId))sel.value=currentPortfolioId;
  }

  function refreshSellChoices(){
    const accountId=document.getElementById('comboPortfolio').value;
    const ticker=normalizeTicker(document.getElementById('comboTicker').value);
    const rows=openPositions(accountId)
      .filter(p=>p.optionType==='Call')
      .filter(p=>!ticker||normalizeTicker(p.underlying||String(p.symbol||'').split(' ')[0])===ticker)
      .sort((a,b)=>Number(a.strike)-Number(b.strike));

    const sel=document.getElementById('comboSellAsset');
    sel.innerHTML=rows.length
      ?rows.map(p=>`<option value="${esc(p.id)}">${esc(p.symbol)} · ${Number(p.qty)} open</option>`).join('')
      :'<option value="">No matching open calls</option>';
    syncFromSellLeg();
    renderSummary();
  }

  function syncFromSellLeg(){
    const id=document.getElementById('comboSellAsset').value;
    const p=openPositions(document.getElementById('comboPortfolio').value).find(x=>x.id===id);
    const meta=document.getElementById('comboSellMeta');
    if(!p){meta.textContent='';return;}
    if(!document.getElementById('comboTicker').value){
      document.getElementById('comboTicker').value=p.underlying||String(p.symbol||'').split(' ')[0];
    }
    if(!document.getElementById('comboName').value)document.getElementById('comboName').value=p.name||'';
    document.getElementById('comboCurrency').value=p.currency||'USD';
    if(!document.getElementById('comboExpiry').value)document.getElementById('comboExpiry').value=p.expiry||'';
    meta.textContent=`Selected: ${p.symbol} · expiry ${p.expiry||'—'} · ${Number(p.qty)} contract${Number(p.qty)===1?'':'s'} open`;
  }

  function renderSummary(){
    const qty=Number(document.getElementById('comboQty')?.value)||0;
    const buy=Number(document.getElementById('comboBuyPrice')?.value);
    const sell=Number(document.getElementById('comboSellPrice')?.value);
    const bf=Number(document.getElementById('comboBuyFee')?.value)||0;
    const sf=Number(document.getElementById('comboSellFee')?.value)||0;
    const el=document.getElementById('comboSummary');
    if(!el)return;
    if(qty>0&&Number.isFinite(buy)&&Number.isFinite(sell)){
      const net=(buy-sell)*qty*100+bf+sf;
      el.textContent=`Net cash outflow: ${money(net,document.getElementById('comboCurrency').value)} · ${qty} combo${qty===1?'':'s'}`;
    }else el.textContent='Enter both execution prices to preview the net cash outflow.';
  }

  function openOptionCombo(){
    inject();
    fillPortfolios();
    document.getElementById('comboTicker').value='';
    document.getElementById('comboName').value='';
    document.getElementById('comboCurrency').value='USD';
    document.getElementById('comboQty').value='1';
    document.getElementById('comboExpiry').value='';
    document.getElementById('comboDate').value=typeof today==='function'?today():new Date().toISOString().slice(0,10);
    document.getElementById('comboBuyStrike').value='';
    document.getElementById('comboBuyPrice').value='';
    document.getElementById('comboBuyFee').value='0';
    document.getElementById('comboSellPrice').value='';
    document.getElementById('comboSellFee').value='0';
    document.getElementById('comboAlignExpiry').checked=true;
    refreshSellChoices();
    renderSummary();
    openModal('optionComboModal');
  }
  window.openOptionCombo=openOptionCombo;

  function saveCombo(){
    try{
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
      const sellPrice=Number(document.getElementById('comboSellPrice').value);
      const sellFee=Number(document.getElementById('comboSellFee').value)||0;
      const sellId=document.getElementById('comboSellAsset').value;
      const alignExpiry=document.getElementById('comboAlignExpiry').checked;

      if(!accountId||!ticker)return toast('Choose a portfolio and enter the underlying ticker.',true);
      if(!Number.isInteger(qty)||qty<=0)return toast('Contracts must be a positive whole number.',true);
      if(!expiry)return toast('Enter the strategy expiry.',true);
      if(expiry<date)return toast('Option expiry cannot be earlier than the transaction date.',true);
      if(!Number.isFinite(buyStrike)||buyStrike<=0)return toast('Enter a valid Buy strike.',true);
      if(!Number.isFinite(buyPrice)||buyPrice<0||!Number.isFinite(sellPrice)||sellPrice<0)return toast('Enter valid execution prices for both legs.',true);
      if(buyFee<0||sellFee<0)return toast('Fees cannot be negative.',true);

      const sellAsset=state.assets.find(a=>a.id===sellId&&a.accountId===accountId&&a.type==='option');
      if(!sellAsset)return toast('Select an existing open call for the Sell leg.',true);
      const sellUnderlying=normalizeTicker(sellAsset.underlying||String(sellAsset.symbol||'').split(' ')[0]);
      if(sellUnderlying!==ticker||sellAsset.optionType!=='Call')return toast('Sell leg must be an open call on the same underlying.',true);
      if(!(Number(sellAsset.strike)>buyStrike))return toast('For a bull call structure, the Sell strike must be above the Buy strike.',true);

      const available=availableOnDate(sellAsset.id,date);
      if(available+EPS<qty)return toast(`Only ${available} contract${available===1?'':'s'} of ${sellAsset.symbol} were available on ${date}.`,true);

      let buyAsset=findAsset({accountId,type:'option',ticker,optionType:'Call',strike:buyStrike,expiry});
      if(!buyAsset){
        buyAsset=ensureAsset({
          accountId,type:'option',ticker,name,currency,
          tradePrice:buyPrice,currentPrice:0,optionType:'Call',strike:buyStrike,expiry,multiplier:100
        });
      }
      buyAsset.name=name;
      buyAsset.currency=currency;
      buyAsset.multiplier=100;

      if(alignExpiry){
        sellAsset.underlying=ticker;
        sellAsset.optionType='Call';
        sellAsset.expiry=expiry;
        sellAsset.symbol=optionSymbol(ticker,'Call',sellAsset.strike,expiry);
      }

      const strategyId=uid('strategy_');
      state.transactions.push({
        id:uid('t_'),accountId,type:'Buy',assetId:buyAsset.id,currency,
        qty,price:buyPrice,fee:buyFee,date,enteredQty:qty,quantityMode:'contracts',
        strategyId,strategyType:'call_roll_spread',strategyLeg:'long'
      });
      state.transactions.push({
        id:uid('t_'),accountId,type:'Sell',assetId:sellAsset.id,currency:sellAsset.currency||currency,
        qty,price:sellPrice,fee:sellFee,date,enteredQty:qty,quantityMode:'contracts',
        strategyId,strategyType:'call_roll_spread',strategyLeg:'sell'
      });

      save();
      closeModal('optionComboModal');
      currentPortfolioId=accountId;
      renderAll();
      if(typeof showPortfolioTab==='function')showPortfolioTab('transactions');
      toast('Call combo recorded.');
    }catch(err){
      console.error(err);
      toast(`Could not record call combo: ${err.message}`,true);
    }
  }

  async function applyOptionComboPrefillFromUrl(){
    const params=new URLSearchParams(window.location.search);
    if(params.get('prefill')!=='optionCombo')return false;

    inject();
    fillPortfolios();

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
    set('comboSellPrice',params.get('sellPrice')||'');
    set('comboSellFee',params.get('sellFee')||0);
    document.getElementById('comboAlignExpiry').checked=params.get('alignExpiry')!=='0';

    refreshSellChoices();
    const sellStrike=Number(params.get('sellStrike'));
    if(Number.isFinite(sellStrike)){
      const sel=document.getElementById('comboSellAsset');
      const candidate=openPositions(portfolio.id).find(p=>
        p.type==='option'&&p.optionType==='Call'&&Number(p.strike)===sellStrike&&
        normalizeTicker(p.underlying||String(p.symbol||'').split(' ')[0])===normalizeTicker(params.get('ticker'))
      );
      if(candidate&&Array.from(sel.options).some(o=>o.value===candidate.id)){
        sel.value=candidate.id;
        syncFromSellLeg();
      }
    }
    renderSummary();
    openModal('optionComboModal');

    try{
      const url=new URL(window.location.href);
      ['prefill','portfolio','ticker','name','currency','qty','expiry','date','buyStrike','buyPrice','buyFee','sellStrike','sellPrice','sellFee','alignExpiry']
        .forEach(k=>url.searchParams.delete(k));
      history.replaceState(null,'',url.pathname+(url.searchParams.toString()?('?'+url.searchParams.toString()):'')+url.hash);
    }catch{}
    return true;
  }
  window.applyOptionComboPrefillFromUrl=applyOptionComboPrefillFromUrl;

  inject();
})();