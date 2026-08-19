(()=>{
  if(window.__portfolioLiveFxInstalledV221)return;
  window.__portfolioLiveFxInstalledV221=true;

  const FX_API='https://portfolio-tracker-quotes.vercel.app/';
  const FX_CACHE_KEY='portfolioTrackerLiveFxV221';
  const REFRESH_MS=15*60*1000;
  let refreshing=false;

  const style=document.createElement('style');
  style.textContent=`
    .fx-live-line{font-size:11px;color:var(--muted);line-height:1.4;margin-top:10px;padding-top:9px;border-top:1px solid var(--line)}
    .fx-live-line strong{color:inherit;font-weight:800}
    .fx-live-ok{color:var(--positive)}
    .fx-live-stale{color:#f4c95d}
  `;
  document.head.appendChild(style);

  function readCache(){
    try{return JSON.parse(localStorage.getItem(FX_CACHE_KEY)||'null');}catch{return null;}
  }

  function validRates(rates){
    return !!rates&&Number(rates.HKD)===1&&Number(rates.USD)>0&&Number(rates.KRW)>0;
  }

  function activeRates(){
    const cached=readCache();
    if(validRates(cached?.ratesToHKD))return cached.ratesToHKD;
    return state?.settings?.fx||{HKD:1,USD:7.80,KRW:0.0056};
  }

  function liveFxToHKD(currency){
    const rates=activeRates();
    const value=Number(rates?.[currency]);
    if(Number.isFinite(value)&&value>0)return value;
    const fallback=Number(state?.settings?.fx?.[currency]);
    return Number.isFinite(fallback)&&fallback>0?fallback:1;
  }

  function liveConvert(amount,from,to=displayCurrency){
    return (Number(amount)||0)*liveFxToHKD(from)/liveFxToHKD(to);
  }

  window.fxToHKD=liveFxToHKD;
  window.convert=liveConvert;
  try{fxToHKD=liveFxToHKD;}catch{}
  try{convert=liveConvert;}catch{}

  function ageText(iso){
    if(!iso)return '—';
    const d=new Date(iso);if(Number.isNaN(d.getTime()))return '—';
    const sec=Math.max(0,Math.round((Date.now()-d.getTime())/1000));
    if(sec<60)return 'just now';
    const min=Math.floor(sec/60);if(min<60)return `${min}m ago`;
    const hr=Math.floor(min/60);if(hr<24)return `${hr}h ago`;
    return `${Math.floor(hr/24)}d ago`;
  }

  function statusText(){
    const cached=readCache();
    if(validRates(cached?.ratesToHKD)){
      const age=Date.now()-new Date(cached.updatedAt||cached.fetchedAt||0).getTime();
      const mode=Number.isFinite(age)&&age<=60*60*1000?'Live FX':'Saved FX';
      const cls=mode==='Live FX'?'fx-live-ok':'fx-live-stale';
      const usdHkd=Number(cached.pairs?.USDHKD);
      const usdKrw=Number(cached.pairs?.USDKRW);
      const pairText=(usdHkd>0&&usdKrw>0)?` · USD/HKD ${usdHkd.toFixed(4)} · USD/KRW ${usdKrw.toLocaleString('en-HK',{maximumFractionDigits:2})}`:'';
      return {html:`<strong class="${cls}">${mode}</strong>${pairText} · updated ${ageText(cached.updatedAt||cached.fetchedAt)}`};
    }
    const ref=state?.settings?.fx||{};
    const usd=Number(ref.USD)||7.80;
    const krw=Number(ref.KRW)||0.0056;
    const usdKrw=krw>0?usd/krw:null;
    return {html:`<strong class="fx-live-stale">Reference FX</strong> · USD/HKD ${usd.toFixed(4)}${usdKrw?` · USD/KRW ${usdKrw.toLocaleString('en-HK',{maximumFractionDigits:2})}`:''} · live quote unavailable`};
  }

  function ensureLine(card,id){
    if(!card)return null;
    let el=document.getElementById(id);
    if(!el){
      el=document.createElement('div');
      el.id=id;el.className='fx-live-line';
      card.appendChild(el);
    }
    return el;
  }

  function decorateFxStatus(){
    const text=statusText().html;
    const homeCard=document.querySelector('#homeView .summary-card');
    const portfolioCard=document.querySelector('#tab-overview .portfolio-summary');
    const home=ensureLine(homeCard,'homeFxStatusLine');
    const portfolio=ensureLine(portfolioCard,'portfolioFxStatusLine');
    if(home)home.innerHTML=text;
    if(portfolio)portfolio.innerHTML=text;
  }

  const originalRenderHome=window.renderHome;
  if(typeof originalRenderHome==='function'){
    window.renderHome=renderHome=function(){originalRenderHome();decorateFxStatus();};
  }
  const originalRenderPortfolio=window.renderPortfolio;
  if(typeof originalRenderPortfolio==='function'){
    window.renderPortfolio=renderPortfolio=function(){originalRenderPortfolio();decorateFxStatus();};
  }

  async function refreshLiveFx({force=false,silent=true}={}){
    if(refreshing)return false;
    const cached=readCache();
    const last=Number(cached?.fetchedAtMs)||0;
    if(!force&&last&&Date.now()-last<REFRESH_MS){decorateFxStatus();return true;}
    if(!navigator.onLine){decorateFxStatus();return false;}
    refreshing=true;
    try{
      const res=await fetch(`${FX_API}?mode=fx`,{cache:'no-store'});
      if(!res.ok)throw new Error(`FX service returned ${res.status}`);
      const data=await res.json();
      if(!validRates(data.ratesToHKD))throw new Error('Invalid FX response');
      localStorage.setItem(FX_CACHE_KEY,JSON.stringify({
        ratesToHKD:data.ratesToHKD,
        pairs:data.pairs||{},
        updatedAt:data.updatedAt||new Date().toISOString(),
        fetchedAt:new Date().toISOString(),
        fetchedAtMs:Date.now(),
        source:data.source||'Yahoo Finance / yfinance'
      }));
      decorateFxStatus();
      if(typeof renderAll==='function')renderAll();
      if(!silent)toast('FX rates updated.');
      return true;
    }catch(err){
      console.warn('Live FX refresh failed',err);
      decorateFxStatus();
      if(!silent)toast('Could not refresh FX. Saved/reference rates kept.',true);
      return false;
    }finally{refreshing=false;}
  }

  window.refreshLiveFx=refreshLiveFx;
  window.getLiveFxInfo=()=>readCache();

  decorateFxStatus();
  setTimeout(()=>refreshLiveFx({silent:true}),700);
  setInterval(()=>refreshLiveFx({silent:true}),REFRESH_MS);
  setInterval(decorateFxStatus,60*1000);
  window.addEventListener('online',()=>setTimeout(()=>refreshLiveFx({force:true,silent:true}),500));
})();
