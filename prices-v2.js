const QUOTE_API='https://portfolio-tracker-quotes.vercel.app/';
const PRICE_REFRESH_MS=10*60*1000;

function yahooSymbolForAsset(asset){
  const raw=normalizeTicker(asset.symbol);
  if(asset.type!=='stock') return null;
  if(raw.includes('.')) return raw;
  if(asset.currency==='HKD' && /^\d{1,5}$/.test(raw)) return raw.padStart(4,'0')+'.HK';
  if(asset.currency==='KRW' && /^\d{6}$/.test(raw)) return raw+'.KS';
  return raw;
}

async function refreshStockPrices({force=false,silent=false}={}){
  try{
    const now=Date.now();
    const last=Number(localStorage.getItem('portfolioTrackerLastQuoteRefresh')||0);
    if(!force && now-last<PRICE_REFRESH_MS) return;

    const assets=state.assets.filter(a=>a.type==='stock');
    if(!assets.length){
      if(!silent) toast('No stock holdings to refresh.');
      return;
    }

    const pairs=assets.map(a=>({asset:a,yahoo:yahooSymbolForAsset(a)})).filter(x=>x.yahoo);
    const symbols=[...new Set(pairs.map(x=>x.yahoo))];
    const res=await fetch(`${QUOTE_API}?symbols=${encodeURIComponent(symbols.join(','))}`);
    if(!res.ok) throw new Error(`Quote service returned ${res.status}`);
    const data=await res.json();
    const quotes=data.quotes||{};
    let updated=0;

    for(const {asset,yahoo} of pairs){
      const q=quotes[yahoo];
      if(q && Number.isFinite(Number(q.price)) && Number(q.price)>0){
        asset.price=Number(q.price);
        asset.quoteSymbol=yahoo;
        asset.quoteUpdatedAt=new Date().toISOString();
        asset.quoteSource='Yahoo Finance / yfinance';
        updated++;
      }
    }

    if(updated){
      save();
      renderAll();
      localStorage.setItem('portfolioTrackerLastQuoteRefresh',String(now));
    }
    if(!silent) toast(updated?`Updated ${updated} stock price${updated===1?'':'s'}.`:'No prices were updated.',updated===0);
  }catch(err){
    console.error('Price refresh failed',err);
    if(!silent) toast('Could not refresh stock prices. Existing prices kept.',true);
  }
}
window.refreshStockPrices=refreshStockPrices;

function installPriceRefreshButtons(){
  const homeHeader=document.getElementById('homeHeader');
  if(homeHeader && !document.getElementById('refreshPricesBtn')){
    const btn=document.createElement('button');
    btn.id='refreshPricesBtn';
    btn.type='button';
    btn.className='icon-text-btn';
    btn.textContent='↻ Prices';
    btn.onclick=()=>refreshStockPrices({force:true});
    homeHeader.appendChild(btn);
  }
}

function loadLayoutEnhancements(){
  if(document.querySelector('script[data-layout-v210]'))return;
  const s=document.createElement('script');
  s.src='layout-v2.js?v=2.10';
  s.dataset.layoutV210='1';
  document.body.appendChild(s);
}

installPriceRefreshButtons();
loadLayoutEnhancements();
setTimeout(()=>refreshStockPrices({silent:true}),300);
