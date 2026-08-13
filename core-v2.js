const KEY='portfolioTrackerV2';
const LEGACY_KEYS=['portfolioTrackerV1_3','portfolioTrackerV1_2','portfolioTrackerV1'];

const starter={
  settings:{baseCurrency:'HKD',fx:{HKD:1,USD:7.80,KRW:0.0056}},
  accounts:[{id:'a1',name:'IBKR Long Term'},{id:'a2',name:'Futu'},{id:'a3',name:'IBKR Options'}],
  assets:[],transactions:[],fx:[]
};

let state=loadState();
let currentPortfolioId=null;
let displayCurrency='HKD';
let activeHoldingId=null;

const $=id=>document.getElementById(id);
const uid=p=>p+Math.random().toString(36).slice(2,10);
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));

function loadState(){
  try{
    let s=JSON.parse(localStorage.getItem(KEY)||'null');
    if(!s){
      for(const k of LEGACY_KEYS){
        const legacy=JSON.parse(localStorage.getItem(k)||'null');
        if(legacy){s=legacy;break;}
      }
    }
    s=s||structuredClone(starter);
    s.settings=s.settings||structuredClone(starter.settings);
    s.settings.fx={...starter.settings.fx,...(s.settings.fx||{})};
    s.accounts=Array.isArray(s.accounts)?s.accounts:[];
    s.assets=Array.isArray(s.assets)?s.assets:[];
    s.transactions=Array.isArray(s.transactions)?s.transactions:[];
    s.fx=Array.isArray(s.fx)?s.fx:[];
    return s;
  }catch(e){
    console.warn('State load failed',e);
    return structuredClone(starter);
  }
}

function fxToHKD(currency){return state.settings.fx[currency]||1;}
function convert(amount,from,to=displayCurrency){return amount*fxToHKD(from)/fxToHKD(to);}
function money(n,c=displayCurrency){return new Intl.NumberFormat('en-HK',{style:'currency',currency:c,maximumFractionDigits:2}).format(Number(n)||0);}
function signedMoney(n,c=displayCurrency){return `${n>=0?'+':''}${money(n,c)}`;}
function pct(n){return `${n>=0?'+':''}${(Number(n)||0).toFixed(2)}%`;}
function esc(s){return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
function multiplier(asset){return asset?.type==='option'?(Number(asset.multiplier)||100):1;}
function portfolioName(id){return state.accounts.find(a=>a.id===id)?.name||'Portfolio';}

function normalizeTicker(v){return String(v||'').trim().toUpperCase();}
function optionSymbol(ticker,type,strike,expiry){return `${normalizeTicker(ticker)} ${Number(strike)}${type==='Put'?'P':'C'} ${expiry}`;}

function assetMatches(a,{accountId,type,ticker,optionType,strike,expiry}){
  if(a.accountId!==accountId||a.type!==type)return false;
  if(type==='stock')return normalizeTicker(a.symbol)===normalizeTicker(ticker);
  return normalizeTicker(a.underlying||a.symbol.split(' ')[0])===normalizeTicker(ticker)
    && a.optionType===optionType
    && Number(a.strike)===Number(strike)
    && a.expiry===expiry;
}

function findAsset(args){return state.assets.find(a=>assetMatches(a,args));}
function ensureAsset(args){
  let a=findAsset(args);
  if(a){
    if(Number.isFinite(args.currentPrice)&&args.currentPrice>0)a.price=args.currentPrice;
    if(args.name)a.name=args.name;
    return a;
  }
  const symbol=args.type==='option'?optionSymbol(args.ticker,args.optionType,args.strike,args.expiry):normalizeTicker(args.ticker);
  a={
    id:uid('asset_'),accountId:args.accountId,type:args.type,symbol,
    underlying:args.type==='option'?normalizeTicker(args.ticker):null,
    name:args.name||symbol,currency:args.currency,
    price:(Number.isFinite(args.currentPrice)&&args.currentPrice>0)?args.currentPrice:args.tradePrice,
    optionType:args.optionType||null,strike:args.strike||null,expiry:args.expiry||null,
    multiplier:args.type==='option'?(Number(args.multiplier)||100):1
  };
  state.assets.push(a);
  return a;
}

function portfolioFilter(id){return !id||id==='all'||currentPortfolioId===null?true:id===currentPortfolioId;}

function holdingsFor(portfolioId=null){
  const assets=state.assets.filter(a=>!portfolioId||a.accountId===portfolioId);
  return assets.map(a=>{
    const txs=state.transactions.filter(t=>t.assetId===a.id).slice().sort((x,y)=>(x.date||'').localeCompare(y.date||''));
    const mult=multiplier(a);
    let qty=0,cost=0,realized=0;
    for(const t of txs){
      const q=Number(t.qty)||0,p=Number(t.price)||0,fee=Number(t.fee)||0;
      if(t.type==='Buy'){
        qty+=q;cost+=q*p*mult+fee;
      }else if(t.type==='Sell'){
        const avg=qty>0?cost/(qty*mult):0;
        realized+=q*(p-avg)*mult-fee;
        cost-=q*avg*mult;qty-=q;
        if(Math.abs(qty)<1e-9){qty=0;cost=0;}
      }
    }
    const avgCost=qty>0?cost/(qty*mult):0;
    const marketValue=qty*(Number(a.price)||0)*mult;
    const unrealized=marketValue-cost;
    const totalPL=realized+unrealized;
    const returnPct=cost?unrealized/cost*100:0;
    return {...a,qty,cost,avgCost,realized,marketValue,unrealized,totalPL,returnPct};
  }).filter(h=>h.qty>1e-9);
}

function cashBalancesFor(portfolioId=null){
  const bal={HKD:0,USD:0,KRW:0};
  for(const t of state.transactions.filter(t=>!portfolioId||t.accountId===portfolioId)){
    if(!bal.hasOwnProperty(t.currency))bal[t.currency]=0;
    const asset=state.assets.find(a=>a.id===t.assetId);
    const trade=(Number(t.qty)||0)*(Number(t.price)||0)*multiplier(asset);
    const amt=Number(t.amount)||0,fee=Number(t.fee)||0;
    if(t.type==='Deposit'||t.type==='Dividend'||t.type==='Interest')bal[t.currency]+=t.amount!=null?amt:trade;
    if(t.type==='Withdrawal'||t.type==='Fee'||t.type==='Tax'||t.type==='Margin Interest')bal[t.currency]-=t.amount!=null?amt:trade;
    if(t.type==='Buy')bal[t.currency]-=trade+fee;
    if(t.type==='Sell')bal[t.currency]+=trade-fee;
  }
  for(const f of state.fx.filter(f=>!portfolioId||f.accountId===portfolioId)){
    if(!bal.hasOwnProperty(f.from))bal[f.from]=0;
    if(!bal.hasOwnProperty(f.to))bal[f.to]=0;
    bal[f.from]-=(Number(f.fromAmount)||0)+(Number(f.fee)||0);
    bal[f.to]+=Number(f.toAmount)||0;
  }
  return bal;
}

function summaryFor(portfolioId=null){
  const hs=holdingsFor(portfolioId);
  const cashBal=cashBalancesFor(portfolioId);
  const invested=hs.reduce((s,h)=>s+convert(h.marketValue,h.currency),0);
  const unrealized=hs.reduce((s,h)=>s+convert(h.unrealized,h.currency),0);
  const realized=hs.reduce((s,h)=>s+convert(h.realized,h.currency),0);
  const cash=Object.entries(cashBal).reduce((s,[c,v])=>s+convert(v,c),0);
  const net=invested+cash;
  return {hs,cashBal,invested,unrealized,realized,totalPL:unrealized+realized,cash,net,exposure:net?invested/net:0};
}

function setText(id,text,cls=''){
  const el=$(id);if(!el)return;el.textContent=text;el.className=cls||el.className;
}

