const HISTORY_API='https://portfolio-tracker-quotes.vercel.app/';
let historyPeriod='3M';
const historyMemoryCache=new Map();

function ensureHistoryPanel(){
  if(document.getElementById('portfolioHistoryPanel')) return;
  const overview=document.getElementById('tab-overview');
  if(!overview) return;
  const summary=overview.querySelector('.portfolio-summary');
  const panel=document.createElement('section');
  panel.id='portfolioHistoryPanel';
  panel.className='panel history-panel';
  panel.innerHTML=`
    <div class="section-head history-head">
      <div><h2>Portfolio Value</h2><div class="muted">Historical net assets</div></div>
      <div id="historyLatest" class="history-latest"></div>
    </div>
    <div id="historyChart" class="history-chart"><div class="empty">Open a portfolio to load history.</div></div>
    <div id="historyRange" class="history-range"></div>
    <div class="history-periods">
      ${['1M','3M','6M','YTD','1Y','ALL'].map(p=>`<button type="button" class="history-period ${p===historyPeriod?'active':''}" data-period="${p}">${p}</button>`).join('')}
    </div>
    <div id="historyNote" class="history-note">Stock history uses Yahoo Finance closing prices. Deposits and withdrawals are included in net assets.</div>`;
  if(summary?.nextSibling) overview.insertBefore(panel,summary.nextSibling); else overview.prepend(panel);
  panel.querySelectorAll('.history-period').forEach(btn=>btn.addEventListener('click',()=>{
    historyPeriod=btn.dataset.period;
    panel.querySelectorAll('.history-period').forEach(b=>b.classList.toggle('active',b===btn));
    renderPerformanceChart({force:false});
  }));
}

function isoDate(d){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function periodStart(portfolioId,period){
  const now=new Date();
  const d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(period==='1M') d.setDate(d.getDate()-31);
  else if(period==='3M') d.setDate(d.getDate()-93);
  else if(period==='6M') d.setDate(d.getDate()-186);
  else if(period==='1Y') d.setDate(d.getDate()-366);
  else if(period==='YTD') return `${now.getFullYear()}-01-01`;
  else if(period==='ALL'){
    const dates=[
      ...state.transactions.filter(t=>t.accountId===portfolioId).map(t=>t.date),
      ...state.fx.filter(f=>f.accountId===portfolioId).map(f=>f.date)
    ].filter(Boolean).sort();
    if(dates.length) return dates[0];
    d.setDate(d.getDate()-366);
  }
  return isoDate(d);
}

async function fetchHistoryForPortfolio(portfolioId,start,{force=false}={}){
  const assets=state.assets.filter(a=>a.accountId===portfolioId&&a.type==='stock');
  const pairs=assets.map(a=>({asset:a,symbol:yahooSymbolForAsset(a)})).filter(x=>x.symbol);
  const symbols=[...new Set(pairs.map(x=>x.symbol))];
  if(!symbols.length) return {pairs,history:{}};
  const key=`${symbols.slice().sort().join(',')}|${start}`;
  const cached=historyMemoryCache.get(key);
  if(!force&&cached&&Date.now()-cached.time<15*60*1000) return {pairs,history:cached.history};
  const res=await fetch(`${HISTORY_API}?symbols=${encodeURIComponent(symbols.join(','))}&mode=history&start=${encodeURIComponent(start)}`);
  if(!res.ok) throw new Error(`History service returned ${res.status}`);
  const data=await res.json();
  const history=data.history||{};
  historyMemoryCache.set(key,{time:Date.now(),history});
  return {pairs,history};
}

function qtyAt(assetId,date){
  let qty=0;
  const txs=state.transactions.filter(t=>t.assetId===assetId&&(t.date||'')<=date).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  for(const t of txs){
    if(t.type==='Buy') qty+=Number(t.qty)||0;
    else if(t.type==='Sell') qty-=Number(t.qty)||0;
  }
  return Math.abs(qty)<1e-9?0:qty;
}

function lastTradePriceAt(assetId,date){
  const txs=state.transactions.filter(t=>t.assetId===assetId&&['Buy','Sell'].includes(t.type)&&(t.date||'')<=date).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  return txs.length?(Number(txs[txs.length-1].price)||0):0;
}

function cashBalancesAt(portfolioId,date){
  const bal={HKD:0,USD:0,KRW:0};
  for(const t of state.transactions.filter(t=>t.accountId===portfolioId&&(t.date||'')<=date)){
    if(!Object.prototype.hasOwnProperty.call(bal,t.currency)) bal[t.currency]=0;
    const asset=state.assets.find(a=>a.id===t.assetId);
    const trade=(Number(t.qty)||0)*(Number(t.price)||0)*multiplier(asset);
    const amount=Number(t.amount)||0,fee=Number(t.fee)||0;
    if(t.type==='Deposit'||t.type==='Dividend'||t.type==='Interest') bal[t.currency]+=t.amount!=null?amount:trade;
    if(t.type==='Withdrawal'||t.type==='Fee'||t.type==='Tax'||t.type==='Margin Interest') bal[t.currency]-=t.amount!=null?amount:trade;
    if(t.type==='Buy') bal[t.currency]-=trade+fee;
    if(t.type==='Sell') bal[t.currency]+=trade-fee;
  }
  for(const f of state.fx.filter(f=>f.accountId===portfolioId&&(f.date||'')<=date)){
    if(!Object.prototype.hasOwnProperty.call(bal,f.from)) bal[f.from]=0;
    if(!Object.prototype.hasOwnProperty.call(bal,f.to)) bal[f.to]=0;
    bal[f.from]-=(Number(f.fromAmount)||0)+(Number(f.fee)||0);
    bal[f.to]+=Number(f.toAmount)||0;
  }
  return bal;
}

function buildCloseLookup(points){
  if(!Array.isArray(points)) return [];
  return points.filter(p=>p&&p.date&&Number.isFinite(Number(p.close))).map(p=>({date:p.date,close:Number(p.close)})).sort((a,b)=>a.date.localeCompare(b.date));
}
function closeAt(points,date){
  let lo=0,hi=points.length-1,best=null;
  while(lo<=hi){
    const mid=(lo+hi)>>1;
    if(points[mid].date<=date){best=points[mid].close;lo=mid+1;} else hi=mid-1;
  }
  return best;
}

function optionPriceAt(asset,date){
  const todayStr=isoDate(new Date());
  if(date>=todayStr&&Number(asset.price)>0) return Number(asset.price);
  return lastTradePriceAt(asset.id,date)||Number(asset.price)||0;
}

function buildPortfolioHistory(portfolioId,start,pairs,history){
  const assets=state.assets.filter(a=>a.accountId===portfolioId);
  const lookups=new Map();
  for(const {asset,symbol} of pairs) lookups.set(asset.id,buildCloseLookup(history[symbol]));
  const dateSet=new Set();
  for(const points of lookups.values()) for(const p of points) if(p.date>=start) dateSet.add(p.date);
  for(const t of state.transactions.filter(t=>t.accountId===portfolioId&&t.date>=start)) dateSet.add(t.date);
  for(const f of state.fx.filter(f=>f.accountId===portfolioId&&f.date>=start)) dateSet.add(f.date);
  dateSet.add(isoDate(new Date()));
  const dates=[...dateSet].filter(d=>d>=start).sort();
  const series=[];
  for(const date of dates){
    let invested=0;
    for(const asset of assets){
      const qty=qtyAt(asset.id,date);if(!qty) continue;
      let price=0;
      if(asset.type==='stock'){
        price=closeAt(lookups.get(asset.id)||[],date);
        if(price==null) price=lastTradePriceAt(asset.id,date)||0;
        if(date===isoDate(new Date())&&Number(asset.price)>0) price=Number(asset.price);
      }else price=optionPriceAt(asset,date);
      invested+=convert(qty*price*multiplier(asset),asset.currency);
    }
    const cashBal=cashBalancesAt(portfolioId,date);
    const cash=Object.entries(cashBal).reduce((s,[c,v])=>s+convert(v,c),0);
    series.push({date,value:invested+cash});
  }
  if(series.length>280){
    const step=(series.length-1)/279;
    const sampled=[];
    for(let i=0;i<280;i++) sampled.push(series[Math.round(i*step)]);
    return [...new Map(sampled.map(p=>[p.date,p])).values()];
  }
  return series;
}

function shortDate(s){
  const d=new Date(`${s}T00:00:00`);
  return new Intl.DateTimeFormat('en-HK',{day:'numeric',month:'short',year:historyPeriod==='ALL'?'2-digit':undefined}).format(d);
}

function drawHistoryChart(series){
  const el=document.getElementById('historyChart');
  const latest=document.getElementById('historyLatest');
  const range=document.getElementById('historyRange');
  if(!el) return;
  if(series.length<2){
    el.innerHTML='<div class="empty">Not enough history yet.</div>';
    if(latest) latest.textContent=series.length?money(series[0].value):'';
    if(range) range.textContent='';
    return;
  }
  const values=series.map(p=>Number(p.value)||0);
  let min=Math.min(...values),max=Math.max(...values);
  if(max===min){max+=1;min-=1;}
  const w=700,h=230,padX=12,padY=20;
  const x=i=>padX+(w-padX*2)*(i/(series.length-1));
  const y=v=>padY+(h-padY*2)*(1-(v-min)/(max-min));
  const pts=series.map((p,i)=>`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area=`${padX},${h-padY} ${pts} ${w-padX},${h-padY}`;
  const startVal=series[0].value,endVal=series[series.length-1].value,chg=endVal-startVal,chgPct=startVal?chg/Math.abs(startVal)*100:0;
  const stroke=chg<0?'#ff5d57':'#d9b5e8';
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Portfolio value history">
    <defs><linearGradient id="historyFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${stroke}" stop-opacity=".28"/><stop offset="100%" stop-color="${stroke}" stop-opacity="0"/></linearGradient></defs>
    <line x1="${padX}" y1="${y(max)}" x2="${w-padX}" y2="${y(max)}" class="history-grid-line"/>
    <line x1="${padX}" y1="${y(min)}" x2="${w-padX}" y2="${y(min)}" class="history-grid-line"/>
    <polygon points="${area}" fill="url(#historyFill)"/>
    <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(series.length-1)}" cy="${y(endVal)}" r="5" fill="${stroke}"/>
  </svg>`;
  if(latest) latest.innerHTML=`<strong>${money(endVal)}</strong><span class="${chg<0?'negative':'positive'}">${signedMoney(chg)} · ${pct(chgPct)}</span>`;
  if(range) range.innerHTML=`<span>${shortDate(series[0].date)}</span><span>${money(min)} – ${money(max)}</span><span>${shortDate(series[series.length-1].date)}</span>`;
}

async function renderPerformanceChart({force=false}={}){
  ensureHistoryPanel();
  if(!currentPortfolioId) return;
  const el=document.getElementById('historyChart');
  const note=document.getElementById('historyNote');
  if(el) el.innerHTML='<div class="history-loading">Loading history…</div>';
  try{
    const start=periodStart(currentPortfolioId,historyPeriod);
    const {pairs,history}=await fetchHistoryForPortfolio(currentPortfolioId,start,{force});
    if(currentPortfolioId==null) return;
    const series=buildPortfolioHistory(currentPortfolioId,start,pairs,history);
    drawHistoryChart(series);
    const hasOptions=state.assets.some(a=>a.accountId===currentPortfolioId&&a.type==='option');
    if(note) note.textContent=hasOptions
      ?'Stocks use Yahoo Finance closing prices. Option history uses recorded trade prices before the latest manual price. Historical FX uses current reference rates.'
      :'Stocks use Yahoo Finance closing prices. Deposits/withdrawals are included in net assets. Historical FX uses current reference rates.';
  }catch(err){
    console.error('History chart failed',err);
    if(el) el.innerHTML='<div class="empty">Could not load price history. Current portfolio data is unaffected.</div>';
  }
}
window.renderPerformanceChart=renderPerformanceChart;

ensureHistoryPanel();
const originalOpenPortfolio=window.openPortfolio;
window.openPortfolio=id=>{originalOpenPortfolio(id);setTimeout(()=>renderPerformanceChart(),0);};
const originalRenderAll=renderAll;
renderAll=function(){originalRenderAll();if(currentPortfolioId)setTimeout(()=>renderPerformanceChart(),0);};
['homeCurrency','portfolioCurrency'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{if(currentPortfolioId)renderPerformanceChart();}));
