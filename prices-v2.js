const QUOTE_API='https://portfolio-tracker-quotes.vercel.app/';
const PRICE_REFRESH_MS=10*60*1000;
const PRICE_REFRESH_KEY='portfolioTrackerLastQuoteRefreshV2';
let stockPriceRefreshPromise=null;

function yahooSymbolForAsset(asset){
  const raw=normalizeTicker(asset.symbol);
  if(asset.type!=='stock') return null;
  if(raw.includes('.')) return raw;
  if(asset.currency==='HKD' && /^\d{1,5}$/.test(raw)) return raw.padStart(4,'0')+'.HK';
  if(asset.currency==='KRW' && /^\d{6}$/.test(raw)) return raw+'.KS';
  if(asset.currency==='EUR' && raw==='ADYEN') return 'ADYEN.AS';
  if(asset.currency==='EUR' && raw==='BESI') return 'BESI.AS';
  return raw;
}

async function refreshStockPrices({force=false,silent=false}={}){
  if(stockPriceRefreshPromise)return stockPriceRefreshPromise;
  stockPriceRefreshPromise=performStockPriceRefresh({force,silent});
  try{return await stockPriceRefreshPromise;}
  finally{stockPriceRefreshPromise=null;}
}

async function performStockPriceRefresh({force=false,silent=false}={}){
  const button=document.getElementById('refreshPricesBtn');
  try{
    const now=Date.now();
    const last=Number(localStorage.getItem(PRICE_REFRESH_KEY)||0);
    if(!force && now-last<PRICE_REFRESH_MS) return;

    const assets=state.assets.filter(a=>a.type==='stock');
    if(!assets.length){
      if(!silent) toast('No stock holdings to refresh.');
      return;
    }

    if(button){button.disabled=true;button.textContent='Refreshing…';}
    const symbols=[...new Set(assets.map(yahooSymbolForAsset).filter(Boolean))];
    const res=await fetch(`${QUOTE_API}?symbols=${encodeURIComponent(symbols.join(','))}&quoteSchema=2${force?'&refresh='+now:''}`,{cache:'no-store'});
    if(!res.ok) throw new Error(`Quote service returned ${res.status}`);
    const data=await res.json();
    const quotes=data.quotes||{};
    let updated=0,skipped=0;

    // Cloud Sync can replace state while the request is in flight. Apply prices
    // to the current assets, never to objects captured before the download.
    for(const asset of state.assets.filter(a=>a.type==='stock')){
      const yahoo=yahooSymbolForAsset(asset);
      if(!symbols.includes(yahoo))continue;
      const q=quotes[yahoo];
      if(q && Number.isFinite(Number(q.price)) && Number(q.price)>0){
        if(asset.quoteDate&&(!q.priceDate||q.priceDate<asset.quoteDate)||
          asset.quoteTime&&q.priceTime&&q.priceTime<asset.quoteTime){skipped++;continue;}
        asset.price=Number(q.price);
        if(Number.isFinite(Number(q.previousClose)) && Number(q.previousClose)>0){
          asset.previousClose=Number(q.previousClose);
          asset.previousCloseUpdatedAt=new Date().toISOString();
        }else{
          // A new price must never inherit a comparison price from an old quote.
          asset.previousClose=null;
          asset.previousCloseUpdatedAt=null;
        }
        for(const [key,value] of Object.entries({quoteDate:q.priceDate,
          quoteTime:q.priceTime,previousCloseDate:asset.previousClose?q.previousCloseDate:null,
          quoteSession:q.session,quoteStatus:q.quoteStatus})){
          if(value)asset[key]=value;
          else delete asset[key];
        }
        asset.quoteSymbol=yahoo;
        asset.quoteUpdatedAt=new Date().toISOString();
        asset.quoteSource='Yahoo Finance / yfinance';
        updated++;
      }
    }

    if(updated){
      save();
      renderAll();
      localStorage.setItem(PRICE_REFRESH_KEY,String(Date.now()));
    }
    const failed=symbols.filter(s=>!quotes[s]||!Number.isFinite(Number(quotes[s].price))||Number(quotes[s].price)<=0);
    if(!silent)toast((updated?`Updated ${updated} stock price${updated===1?'':'s'}.`:'No prices were updated.')+
      (skipped?' Older quotes ignored.':'')+(failed.length?` Saved prices kept for ${failed.join(', ')}.`:''),updated===0||failed.length>0);
  }catch(err){
    console.error('Price refresh failed',err);
    if(!silent) toast('Could not refresh stock prices. Existing prices kept.',true);
  }finally{
    if(button){button.disabled=false;button.textContent='↻ Prices';}
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

installPriceRefreshButtons();
setTimeout(async()=>{
  await window.portfolioStartupSyncReady;
  await refreshStockPrices({silent:true});
},300);
setInterval(()=>{if(document.visibilityState!=='hidden')refreshStockPrices({silent:true});},PRICE_REFRESH_MS);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshStockPrices({silent:true});});
window.addEventListener('online',()=>refreshStockPrices({force:true,silent:true}));

