const KEY='portfolioTrackerV1_3';
const LEGACY_KEYS=['portfolioTrackerV1_2','portfolioTrackerV1'];

const starter = {
  settings:{baseCurrency:'HKD', fx:{USD:7.80,HKD:1,KRW:0.0056}},
  accounts:[
    {id:'a1',name:'IBKR Long Term'},
    {id:'a2',name:'Futu'},
    {id:'a3',name:'IBKR Options'}
  ],
  assets:[
    {id:'s1',accountId:'a1',type:'stock',symbol:'VOO',name:'Vanguard S&P 500 ETF',currency:'USD',price:550},
    {id:'s2',accountId:'a1',type:'stock',symbol:'NVDA',name:'NVIDIA',currency:'USD',price:190},
    {id:'s3',accountId:'a2',type:'stock',symbol:'0700',name:'Tencent',currency:'HKD',price:520},
    {id:'o1',accountId:'a3',type:'option',symbol:'ACN 220C 2028-01-21',name:'ACN Jan 2028 $220 Call',currency:'USD',price:27.90,multiplier:100,optionType:'Call',strike:220,expiry:'2028-01-21'}
  ],
  transactions:[
    {id:'t1',accountId:'a1',type:'Deposit',currency:'USD',amount:25000,date:'2026-01-02'},
    {id:'t2',accountId:'a1',type:'Buy',assetId:'s1',currency:'USD',qty:20,price:480,fee:1,date:'2026-01-05'},
    {id:'t3',accountId:'a1',type:'Buy',assetId:'s2',currency:'USD',qty:50,price:150,fee:1,date:'2026-02-01'},
    {id:'t4',accountId:'a2',type:'Deposit',currency:'HKD',amount:120000,date:'2026-01-02'},
    {id:'t5',accountId:'a2',type:'Buy',assetId:'s3',currency:'HKD',qty:150,price:450,fee:30,date:'2026-03-01'},
    {id:'t6',accountId:'a3',type:'Deposit',currency:'USD',amount:3000,date:'2026-01-02'},
    {id:'t7',accountId:'a3',type:'Buy',assetId:'o1',currency:'USD',qty:2,price:10.01,fee:0,date:'2026-01-15'}
  ],
  fx:[]
};

let state=null;
try{
  state=JSON.parse(localStorage.getItem(KEY)||'null');
  if(!state){
    for(const k of LEGACY_KEYS){
      const legacy=JSON.parse(localStorage.getItem(k)||'null');
      if(legacy){ state=legacy; break; }
    }
  }
}catch(e){ console.warn('Could not load saved state',e); }
state=state||starter;
let selectedAccount='all';

const $=id=>document.getElementById(id);
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const fxRate=c=>state.settings.fx[c]||1;
const toBase=(amount,c)=>amount*fxRate(c);
const money=(n,c='HKD')=>new Intl.NumberFormat('en-HK',{style:'currency',currency:c,maximumFractionDigits:0}).format(n||0);
const uid=p=>p+Math.random().toString(36).slice(2,9);
function accountFilter(id){ return selectedAccount==='all'||id===selectedAccount; }
function multiplier(asset){ return asset?.type==='option' ? (asset.multiplier||100) : 1; }

function holdings(){
  return state.assets.filter(a=>accountFilter(a.accountId)).map(a=>{
    let qty=0,cost=0,realized=0;
    const mult=multiplier(a);
    const txs=state.transactions.filter(t=>t.assetId===a.id);
    let avgCost=0;
    for(const t of txs.sort((x,y)=>x.date.localeCompare(y.date))){
      if(t.type==='Buy'){
        const addCost=t.qty*t.price*mult+(t.fee||0);
        cost+=addCost; qty+=t.qty; avgCost=qty?cost/(qty*mult):0;
      }else if(t.type==='Sell'){
        const proceeds=t.qty*t.price*mult-(t.fee||0);
        realized+=proceeds-t.qty*avgCost*mult;
        cost-=t.qty*avgCost*mult; qty-=t.qty;
      }
    }
    const mv=qty*a.price*mult;
    const unrealized=mv-cost;
    return {...a,qty,cost,avgCost,marketValue:mv,unrealized,realized};
  }).filter(h=>Math.abs(h.qty)>1e-9);
}

function cashBalances(){
  const bal={USD:0,HKD:0,KRW:0};
  for(const t of state.transactions.filter(t=>accountFilter(t.accountId))){
    if(!bal.hasOwnProperty(t.currency)) bal[t.currency]=0;
    const asset=state.assets.find(a=>a.id===t.assetId);
    const trade=(t.qty||0)*(t.price||0)*multiplier(asset);
    if(t.type==='Deposit'||t.type==='Dividend'||t.type==='Interest') bal[t.currency]+=t.amount??trade;
    if(t.type==='Withdrawal'||t.type==='Fee'||t.type==='Tax'||t.type==='Margin Interest') bal[t.currency]-=t.amount??trade;
    if(t.type==='Buy') bal[t.currency]-=trade+(t.fee||0);
    if(t.type==='Sell') bal[t.currency]+=trade-(t.fee||0);
  }
  for(const f of state.fx.filter(x=>accountFilter(x.accountId))){
    bal[f.from]-=f.fromAmount+(f.fee||0); bal[f.to]+=f.toAmount;
  }
  return bal;
}

function summary(){
  const hs=holdings();
  const invested=hs.reduce((s,h)=>s+toBase(h.marketValue,h.currency),0);
  const unreal=hs.reduce((s,h)=>s+toBase(h.unrealized,h.currency),0);
  const realized=hs.reduce((s,h)=>s+toBase(h.realized,h.currency),0);
  const cb=cashBalances();
  const cash=Object.entries(cb).reduce((s,[c,v])=>s+toBase(v,c),0);
  const net=invested+cash;
  return {hs,invested,unreal,realized,cash,net,exposure:net?invested/net:0,cb};
}

function render(){
  populateSelects();
  const s=summary();
  $('accountTitle').textContent=selectedAccount==='all'?'All Accounts':state.accounts.find(a=>a.id===selectedAccount)?.name||'Account';
  $('netAssets').textContent=money(s.net); $('investedValue').textContent=money(s.invested); $('cashValue').textContent=money(s.cash);
  $('cashValue').className=s.cash<0?'negative':'';
  $('unrealizedPL').textContent=money(s.unreal); $('unrealizedPL').className=s.unreal<0?'negative':'positive';
  $('realizedPL').textContent=money(s.realized); $('realizedPL').className=s.realized<0?'negative':'positive';
  $('totalPL').textContent='P/L '+money(s.unreal+s.realized); $('grossExposure').textContent='Exposure '+s.exposure.toFixed(2)+'×';
  renderHoldings('holdingsList',s.hs.slice(0,6),s.net); renderHoldings('allHoldingsList',s.hs,s.net); renderAllocation(s.hs,s.net,s.cb); renderTransactions(); renderCash(s.cb); renderFx();
}

function renderHoldings(target,hs,net){
  const el=$(target); if(!hs.length){el.innerHTML='<div class="muted">No holdings yet.</div>';return;}
  el.innerHTML=hs.map(h=>{const base=toBase(h.marketValue,h.currency),pl=toBase(h.unrealized,h.currency),weight=net?base/net*100:0;return `<div class="holding-row"><div><div class="holding-name">${h.symbol}</div><div class="holding-sub">${h.type==='option'?h.qty+' contracts · '+h.name:h.qty+' shares · '+h.name}</div></div><div class="right"><div>${money(base)}</div><div class="holding-sub">${money(h.marketValue,h.currency)}</div></div><div class="right"><div class="${pl<0?'negative':'positive'}">${money(pl)}</div><div class="holding-sub">${weight.toFixed(1)}%</div></div></div>`;}).join('');
}

function renderAllocation(hs,net,cb){
  const rows=hs.map(h=>({name:h.symbol,val:toBase(h.marketValue,h.currency)}));
  const cashBase=Object.entries(cb).reduce((s,[c,v])=>s+toBase(v,c),0); rows.push({name:cashBase<0?'Margin':'Cash',val:cashBase});
  $('allocationList').innerHTML=rows.map(r=>{const w=net?r.val/net*100:0,width=Math.min(Math.abs(w),100);return `<div class="allocation-row"><div class="allocation-top"><span>${r.name}</span><strong class="${r.val<0?'negative':''}">${w.toFixed(1)}%</strong></div><div class="bar"><span style="width:${width}%"></span></div></div>`;}).join('');
}

function renderTransactions(){
  const txs=state.transactions.filter(t=>accountFilter(t.accountId)).slice().sort((a,b)=>b.date.localeCompare(a.date));
  $('transactionList').innerHTML=txs.map(t=>{const a=state.assets.find(x=>x.id===t.assetId);const amt=t.amount??((t.qty||0)*(t.price||0)*multiplier(a));return `<div class="tx-row"><div><div class="tx-title">${t.type}${a?' · '+a.symbol:''}</div><div class="tx-sub">${t.date} · ${state.accounts.find(x=>x.id===t.accountId)?.name||''}</div></div><div class="right">${money(amt,t.currency)}</div></div>`;}).join('')||'<div class="muted" style="padding:16px 0">No transactions.</div>';
}
function renderCash(cb){$('cashBalances').innerHTML=Object.entries(cb).map(([c,v])=>`<div class="cash-row"><strong>${c}</strong><span class="${v<0?'negative':''}">${money(v,c)}</span></div>`).join('');}
function renderFx(){const rows=state.fx.filter(f=>accountFilter(f.accountId)).slice().sort((a,b)=>b.date.localeCompare(a.date));$('fxList').innerHTML=rows.map(f=>`<div class="tx-row"><div><div class="tx-title">${f.from} → ${f.to}</div><div class="tx-sub">${f.date} · ${state.accounts.find(a=>a.id===f.accountId)?.name||''}</div></div><div class="right">${money(f.fromAmount,f.from)}<div class="tx-sub">→ ${money(f.toAmount,f.to)}</div></div></div>`).join('')||'<div class="muted" style="padding:16px 0">No FX transactions.</div>';}

function populateSelects(){
  const opts='<option value="all">All Accounts</option>'+state.accounts.map(a=>`<option value="${a.id}">${a.name}</option>`).join('');
  $('accountSelect').innerHTML=opts; $('accountSelect').value=selectedAccount;
  ['assetAccount','txAccount','fxAccount'].forEach(id=>$(id).innerHTML=state.accounts.map(a=>`<option value="${a.id}">${a.name}</option>`).join('')); refreshAssetSelect();
}
function refreshAssetSelect(){const acc=$('txAccount')?.value||state.accounts[0]?.id;$('txAsset').innerHTML=state.assets.filter(a=>a.accountId===acc).map(a=>`<option value="${a.id}">${a.symbol}</option>`).join('');}

function showToast(msg,isError=false){const el=$('toast');el.textContent=msg;el.classList.remove('hidden','error');if(isError)el.classList.add('error');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.add('hidden'),2200);}
function openModal(id){const el=$(id);if(el)el.classList.remove('hidden');}
function closeModal(id){const el=$(id);if(el)el.classList.add('hidden');}
document.querySelectorAll('.modal-close').forEach(btn=>btn.addEventListener('click',()=>closeModal(btn.closest('.modal-overlay').id)));
document.querySelectorAll('.modal-overlay').forEach(overlay=>overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal(overlay.id);}));
function showView(id){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===id));}
window.showView=showView;
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$('accountSelect').addEventListener('change',e=>{selectedAccount=e.target.value;render();}); $('txAccount').addEventListener('change',refreshAssetSelect);
$('assetType').addEventListener('change',e=>$('optionFields').classList.toggle('hidden',e.target.value!=='option'));
function updateTxFields(){const type=$('txType').value;const simple=['Deposit','Withdrawal','Fee','Tax','Interest','Margin Interest'].includes(type);const dividend=type==='Dividend';$('txAssetLabel').classList.toggle('hidden',simple);$('qtyLabel').classList.toggle('hidden',simple||dividend);$('priceLabel').classList.remove('hidden');$('priceLabel').firstChild.textContent=(simple||dividend)?'Amount':'Price';if(dividend)$('txAssetLabel').classList.remove('hidden');}
$('txType').addEventListener('change',updateTxFields);
window.openAssetModal=()=>openModal('assetModal'); window.openTransactionModal=()=>{refreshAssetSelect();openModal('transactionModal');}; window.openFxModal=()=>openModal('fxModal');

function saveAssetDirect(){
  try{const symbol=$('assetSymbol').value.trim();const price=Number($('assetPrice').value);if(!symbol)return showToast('Please enter a symbol.',true);if(!Number.isFinite(price))return showToast('Please enter a valid current price.',true);state.assets.push({id:uid('a'),accountId:$('assetAccount').value,type:$('assetType').value,symbol,name:$('assetName').value.trim()||symbol,currency:$('assetCurrency').value,price,optionType:$('optionType').value,strike:Number($('optionStrike').value)||null,expiry:$('optionExpiry').value||null,multiplier:Number($('optionMultiplier').value)||100});save();closeModal('assetModal');$('assetForm').reset();$('optionMultiplier').value='100';$('optionFields').classList.add('hidden');render();showToast('Asset saved.');}catch(err){console.error(err);showToast('Could not save asset: '+err.message,true);}
}
function saveTransactionDirect(){
  try{const type=$('txType').value;const price=Number($('txPrice').value);const qty=Number($('txQty').value);const fee=Number($('txFee').value)||0;const date=$('txDate').value||new Date().toISOString().slice(0,10);const simple=['Deposit','Withdrawal','Fee','Tax','Interest','Margin Interest'].includes(type);const dividend=type==='Dividend';if(!Number.isFinite(price))return showToast(simple||dividend?'Please enter a valid amount.':'Please enter a valid price.',true);if(!simple&&!dividend&&(!Number.isFinite(qty)||qty<=0))return showToast('Please enter a valid quantity.',true);if(!simple&&!$('txAsset').value)return showToast('Please select an asset.',true);state.transactions.push({id:uid('t'),accountId:$('txAccount').value,type,assetId:simple?null:$('txAsset').value,currency:$('txCurrency').value,qty:(simple||dividend)?0:qty,price:(simple||dividend)?0:price,fee,amount:(simple||dividend)?price:undefined,date});save();closeModal('transactionModal');render();showToast('Transaction saved.');}catch(err){console.error(err);showToast('Could not save transaction: '+err.message,true);}
}
function saveFxDirect(){
  try{const fromAmount=Number($('fxFromAmount').value);const toAmount=Number($('fxToAmount').value);const fee=Number($('fxFee').value)||0;if(!Number.isFinite(fromAmount)||fromAmount<=0)return showToast('Please enter a valid From amount.',true);if(!Number.isFinite(toAmount)||toAmount<=0)return showToast('Please enter a valid Received amount.',true);if($('fxFrom').value===$('fxTo').value)return showToast('From and To currencies must be different.',true);state.fx.push({id:uid('f'),accountId:$('fxAccount').value,from:$('fxFrom').value,to:$('fxTo').value,fromAmount,toAmount,fee,date:$('fxDate').value||new Date().toISOString().slice(0,10)});save();closeModal('fxModal');render();showToast('FX transaction saved.');}catch(err){console.error(err);showToast('Could not save FX: '+err.message,true);}
}
$('saveAssetBtn').addEventListener('click',saveAssetDirect); $('saveTransactionBtn').addEventListener('click',saveTransactionDirect); $('saveFxBtn').addEventListener('click',saveFxDirect);
const today=new Date().toISOString().slice(0,10); $('txDate').value=today; $('fxDate').value=today; updateTxFields();
if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations?.().then(regs=>regs.forEach(r=>r.unregister())).catch(()=>{});} render();
