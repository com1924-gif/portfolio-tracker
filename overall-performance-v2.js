(()=>{
  if(window.__portfolioOverallPerformanceInstalledV222)return;
  window.__portfolioOverallPerformanceInstalledV222=true;

  const API='https://portfolio-tracker-quotes.vercel.app/';
  const PERIODS=['1M','3M','6M','YTD','1Y','ALL'];
  const REFRESH_MS=5*60*1000;
  let period='YTD';
  let busy=false;
  let benchmarkFetchedAt=null;
  const benchmarkCache=new Map();

  const style=document.createElement('style');
  style.textContent=`
    .overall-performance-panel{margin-top:14px}
    .overall-performance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:10px 0 14px}
    .overall-performance-metric{border:1px solid var(--line);background:#111115;border-radius:14px;padding:13px}
    .overall-performance-metric span{display:block;color:var(--muted);font-size:12px;margin-bottom:5px}
    .overall-performance-metric strong{display:block;font-size:17px;line-height:1.25}
    .overall-performance-sub{font-size:11px;color:var(--muted);line-height:1.35;margin-top:4px}
    .overall-performance-section{border-top:1px solid var(--line);padding-top:13px;margin-top:13px}
    .overall-performance-contribution-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
    .overall-performance-contribution-row:last-child{border-bottom:0}
    .overall-performance-periods{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 12px}
    .overall-performance-period{border:1px solid var(--line);background:#111115;color:var(--muted);border-radius:999px;padding:7px 10px;font-weight:700;cursor:pointer}
    .overall-performance-period.active{background:var(--accent);color:#202025;border-color:transparent}
    .overall-performance-legend{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0 12px}
    .overall-performance-legend-item{border:1px solid var(--line);border-radius:12px;padding:10px;background:#111115}
    .overall-performance-legend-item span{display:block;color:var(--muted);font-size:11px;margin-bottom:3px}
    .overall-performance-legend-item strong{font-size:15px}
    .overall-performance-chart{min-height:230px;display:flex;align-items:center;justify-content:center}
    .overall-performance-chart svg{width:100%;height:auto;display:block}
    .overall-performance-note{font-size:12px;color:var(--muted);line-height:1.45;margin-top:10px}
    @media(max-width:700px){.overall-performance-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.overall-performance-legend{grid-template-columns:1fr 1fr 1fr}}
    @media(max-width:460px){.overall-performance-grid{grid-template-columns:1fr 1fr}.overall-performance-legend{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function homeActive(){return !!document.getElementById('homeView')?.classList.contains('active');}

  function ensurePanel(){
    const home=document.getElementById('homeView');
    if(!home||document.getElementById('overallPerformancePanel'))return;
    const panel=document.createElement('section');
    panel.id='overallPerformancePanel';
    panel.className='panel overall-performance-panel';
    panel.innerHTML=`
      <div class="section-head">
        <div><h2>Overall Performance</h2><div class="muted">All portfolios combined</div></div>
        <button id="refreshOverallPerformanceBtn" type="button" class="ghost-btn">Refresh</button>
      </div>
      <div id="overallPerformanceMetrics" class="overall-performance-grid"></div>
      <div class="overall-performance-section">
        <div class="section-head"><div><h3>P/L Contribution</h3><div class="muted">Tracked realized + unrealized across all portfolios</div></div></div>
        <div id="overallPerformanceContributions"></div>
      </div>
      <div class="overall-performance-section">
        <div class="section-head"><div><h3>Whole Portfolio vs VOO / QQQ</h3><div class="muted">Total return · common baseline</div></div></div>
        <div id="overallPerformancePeriods" class="overall-performance-periods"></div>
        <div id="overallPerformanceLegend" class="overall-performance-legend"></div>
        <div id="overallPerformanceChart" class="overall-performance-chart"><div class="empty">Loading comparison…</div></div>
        <div id="overallPerformanceNote" class="overall-performance-note"></div>
      </div>`;

    const summary=home.querySelector('.summary-card');
    if(summary?.nextSibling)home.insertBefore(panel,summary.nextSibling);else home.prepend(panel);
    document.getElementById('refreshOverallPerformanceBtn')?.addEventListener('click',()=>refreshOverallPerformance({force:true,refreshPrices:true}));
    renderPeriodButtons();
  }

  function renderPeriodButtons(){
    const box=document.getElementById('overallPerformancePeriods');
    if(!box)return;
    box.innerHTML=PERIODS.map(p=>`<button type="button" class="overall-performance-period ${p===period?'active':''}" data-period="${p}">${p}</button>`).join('');
    box.querySelectorAll('.overall-performance-period').forEach(btn=>btn.addEventListener('click',()=>{
      period=btn.dataset.period;
      renderPeriodButtons();
      renderOverallBenchmark({force:false});
    }));
  }

  function metric(label,value,number=null,sub=''){
    const cls=number==null?'':number<0?'negative':'positive';
    return `<div class="overall-performance-metric"><span>${label}</span><strong class="${cls}">${value}</strong>${sub?`<div class="overall-performance-sub">${sub}</div>`:''}</div>`;
  }

  function todayPL(){
    const stocks=holdingsFor().filter(h=>h.type==='stock');
    const options=holdingsFor().filter(h=>h.type==='option');
    const eligible=stocks.filter(h=>Number(h.price)>0&&Number(h.previousClose)>0);
    const value=eligible.reduce((sum,h)=>sum+convert((Number(h.qty)||0)*(Number(h.price)-Number(h.previousClose))*multiplier(h),h.currency),0);
    return {value,eligibleCount:eligible.length,stockCount:stocks.length,optionCount:options.length};
  }

  function renderSummary(){
    ensurePanel();
    const cap=capitalSummary();
    const base=summaryFor();
    const day=todayPL();
    const lifetimeReturn=cap.capitalComplete&&Number(cap.netContributions)>0?cap.lifetimePL/cap.netContributions*100:null;
    const box=document.getElementById('overallPerformanceMetrics');
    if(box){
      box.innerHTML=[
        metric('Lifetime P/L',cap.capitalComplete?signedMoney(cap.lifetimePL):`Set capital (${cap.capitalConfiguredCount||0}/${cap.capitalRequiredCount||0})`,cap.capitalComplete?cap.lifetimePL:null),
        metric('Lifetime Return',lifetimeReturn==null?'—':pct(lifetimeReturn),lifetimeReturn,'Simple return; not annualized'),
        metric(day.optionCount?'Today P/L (stocks)':'Today P/L',day.eligibleCount?signedMoney(day.value):(day.stockCount?'Refresh prices':'—'),day.eligibleCount?day.value:null,day.optionCount?'Options excluded':''),
        metric('Open P/L',signedMoney(base.unrealized),base.unrealized,'Current holdings only'),
        metric('Tracked Realized P/L',signedMoney(base.realized),base.realized,'Recorded transactions only'),
        metric('Net Contributions',cap.capitalComplete?money(cap.netContributions):'—',null,'All configured portfolios combined')
      ].join('');
    }
    renderContributions();
  }

  function renderContributions(){
    const positions=typeof positionsFor==='function'?positionsFor():holdingsFor();
    const grouped=new Map();
    positions.forEach(p=>{
      const key=p.type==='option'?p.symbol:(p.symbol||p.name||'Unknown');
      const pl=convert(Number(p.totalPL)||0,p.currency);
      const row=grouped.get(key)||{symbol:key,name:p.name||'',pl:0,accounts:new Set(),open:false};
      row.pl+=pl;row.accounts.add(p.accountId);if(Number(p.qty)>1e-9)row.open=true;
      grouped.set(key,row);
    });
    const rows=[...grouped.values()].sort((a,b)=>Math.abs(b.pl)-Math.abs(a.pl)).slice(0,12);
    const box=document.getElementById('overallPerformanceContributions');
    if(!box)return;
    box.innerHTML=rows.length?rows.map(r=>`<div class="overall-performance-contribution-row">
      <div><strong>${esc(r.symbol)}</strong><div class="overall-performance-sub">${r.open?'Open / tracked':'Closed'} · ${r.accounts.size} portfolio${r.accounts.size===1?'':'s'}${r.name&&r.name!==r.symbol?` · ${esc(r.name)}`:''}</div></div>
      <div class="right ${r.pl<0?'negative':'positive'}"><strong>${signedMoney(r.pl)}</strong></div>
    </div>`).join(''):'<div class="empty">No tracked positions yet.</div>';
  }

  function isoDate(d){
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function overallPeriodStart(p){
    const now=new Date();
    const d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if(p==='1M')d.setDate(d.getDate()-31);
    else if(p==='3M')d.setDate(d.getDate()-93);
    else if(p==='6M')d.setDate(d.getDate()-186);
    else if(p==='1Y')d.setDate(d.getDate()-366);
    else if(p==='YTD')return `${now.getFullYear()}-01-01`;
    else if(p==='ALL'){
      const dates=[...state.transactions.map(t=>t.date),...state.fx.map(f=>f.date)].filter(Boolean).sort();
      if(dates.length)return dates[0];
      d.setDate(d.getDate()-366);
    }
    return isoDate(d);
  }

  function activeAccounts(){
    return state.accounts.filter(a=>
      state.assets.some(x=>x.accountId===a.id)||
      state.transactions.some(x=>x.accountId===a.id)||
      state.fx.some(x=>x.accountId===a.id)||
      a.capitalConfigured
    );
  }

  function valueAt(series,date){
    let lo=0,hi=series.length-1,best=null;
    while(lo<=hi){
      const mid=(lo+hi)>>1;
      if(series[mid].date<=date){best=Number(series[mid].value);lo=mid+1;}else hi=mid-1;
    }
    return Number.isFinite(best)?best:0;
  }

  async function combinedHistory(start,{force=false}={}){
    const accounts=activeAccounts();
    if(!accounts.length)return [];
    const seriesList=await Promise.all(accounts.map(async account=>{
      const {pairs,history}=await fetchHistoryForPortfolio(account.id,start,{force});
      return buildPortfolioHistory(account.id,start,pairs,history);
    }));
    const dates=new Set();
    seriesList.forEach(series=>series.forEach(p=>{if(p.date>=start)dates.add(p.date);}));
    dates.add(isoDate(new Date()));
    return [...dates].sort().map(date=>({
      date,
      value:seriesList.reduce((sum,series)=>sum+valueAt(series,date),0)
    }));
  }

  function externalFlows(start){
    const flows=new Map();
    state.transactions.filter(t=>['Deposit','Withdrawal'].includes(t.type)&&(t.date||'')>=start).forEach(t=>{
      const amount=convert(Number(t.amount)||0,t.currency);
      const signed=t.type==='Deposit'?amount:-amount;
      flows.set(t.date,(flows.get(t.date)||0)+signed);
    });
    return flows;
  }

  function portfolioIndex(series,start){
    if(!Array.isArray(series)||series.length<2)return [];
    const flows=externalFlows(start);
    const first=series.findIndex(p=>Number(p.value)>0);
    if(first<0||first>=series.length-1)return [];
    let prev=Number(series[first].value),index=100;
    const out=[{date:series[first].date,value:100}];
    for(let i=first+1;i<series.length;i++){
      const cur=Number(series[i].value);
      if(!(prev>0)||!Number.isFinite(cur)){prev=cur;continue;}
      const flow=flows.get(series[i].date)||0;
      const r=(cur-flow-prev)/prev;
      if(Number.isFinite(r)&&r>-1){index*=1+r;out.push({date:series[i].date,value:index});}
      prev=cur;
    }
    return out;
  }

  function newYorkDate(){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get=type=>parts.find(p=>p.type===type)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function adjustedPoints(raw,quote){
    const rows=Array.isArray(raw)?raw.filter(p=>p&&p.date&&Number(p.close)>0).map(p=>({date:p.date,close:Number(p.close),adjusted:Number(p.adjClose)>0?Number(p.adjClose):Number(p.close)})).sort((a,b)=>a.date.localeCompare(b.date)):[];
    if(!rows.length)return [];
    const live=Number(quote?.price);
    if(live>0){
      const last=rows[rows.length-1];
      const factor=last.close>0&&last.adjusted>0?last.adjusted/last.close:1;
      const point={date:newYorkDate(),close:live,adjusted:live*factor};
      if(last.date===point.date)rows[rows.length-1]=point;
      else if(last.date<point.date)rows.push(point);
    }
    return rows.map(p=>({date:p.date,price:p.adjusted}));
  }

  async function fetchBenchmarks(start,{force=false}={}){
    const cached=benchmarkCache.get(start);
    if(!force&&cached&&Date.now()-cached.time<5*60*1000){benchmarkFetchedAt=cached.fetchedAt;return cached.data;}
    const stamp=Math.floor(Date.now()/60000);
    const [historyRes,quoteRes]=await Promise.all([
      fetch(`${API}?symbols=VOO%2CQQQ&mode=history&start=${encodeURIComponent(start)}&_=${stamp}`,{cache:'no-store'}),
      fetch(`${API}?symbols=VOO%2CQQQ&_=${stamp}`,{cache:'no-store'})
    ]);
    if(!historyRes.ok||!quoteRes.ok)throw new Error('Benchmark data unavailable');
    const history=await historyRes.json();
    const quotes=await quoteRes.json();
    benchmarkFetchedAt=new Date().toISOString();
    const data={history:history.history||{},quotes:quotes.quotes||{}};
    benchmarkCache.set(start,{time:Date.now(),fetchedAt:benchmarkFetchedAt,data});
    return data;
  }

  function commonBaseline(portfolio,voo,qqq){
    if(!portfolio.length||!voo.length||!qqq.length)return null;
    const vd=new Set(voo.map(p=>p.date)),qd=new Set(qqq.map(p=>p.date));
    return portfolio.map(p=>p.date).filter(d=>vd.has(d)&&qd.has(d)).sort()[0]||null;
  }

  function rebase(points,baseline,key){
    const base=Number(points.find(p=>p.date===baseline)?.[key]);
    if(!(base>0))return [];
    return points.filter(p=>p.date>=baseline).map(p=>({date:p.date,value:Number(p[key])/base*100}));
  }

  function finalReturn(points){return points.length?Number(points[points.length-1].value)-100:null;}

  function renderLegend(lines){
    const box=document.getElementById('overallPerformanceLegend');if(!box)return;
    box.innerHTML=lines.map(line=>{
      const r=finalReturn(line.points);
      return `<div class="overall-performance-legend-item"><span>${line.name}</span><strong class="${r==null?'':r<0?'negative':'positive'}">${r==null?'—':pct(r)}</strong></div>`;
    }).join('');
  }

  function drawChart(lines){
    const el=document.getElementById('overallPerformanceChart');if(!el)return;
    const all=lines.flatMap(line=>line.points);
    if(all.length<2){el.innerHTML='<div class="empty">Not enough comparable history for this period.</div>';return;}
    const times=all.map(p=>new Date(`${p.date}T00:00:00`).getTime());
    const vals=all.map(p=>Number(p.value)).filter(Number.isFinite);
    const minT=Math.min(...times),maxT=Math.max(...times);
    let minV=Math.min(...vals),maxV=Math.max(...vals);if(minV===maxV){minV-=1;maxV+=1;}
    const pad=(maxV-minV)*0.08;minV-=pad;maxV+=pad;
    const w=760,h=265,padX=18,padY=22;
    const x=date=>{const t=new Date(`${date}T00:00:00`).getTime();return padX+(w-padX*2)*((t-minT)/Math.max(1,maxT-minT));};
    const y=v=>padY+(h-padY*2)*(1-(v-minV)/(maxV-minV));
    const colors=['#d9b5e8','#59c3c3','#f4c95d'];
    const paths=lines.map((line,i)=>{
      const pts=line.points.map(p=>`${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
      return pts?`<polyline points="${pts}" fill="none" stroke="${colors[i]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`:'';
    }).join('');
    el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Whole portfolio versus VOO and QQQ">
      <line x1="${padX}" y1="${y(100)}" x2="${w-padX}" y2="${y(100)}" class="benchmark-grid-line"/>
      <line x1="${padX}" y1="${y(maxV)}" x2="${w-padX}" y2="${y(maxV)}" class="benchmark-grid-line"/>
      <line x1="${padX}" y1="${y(minV)}" x2="${w-padX}" y2="${y(minV)}" class="benchmark-grid-line"/>
      ${paths}
    </svg>`;
  }

  function ageText(iso){
    if(!iso)return '—';
    const d=new Date(iso);if(Number.isNaN(d.getTime()))return '—';
    const min=Math.max(0,Math.floor((Date.now()-d.getTime())/60000));
    if(min<1)return 'just now';if(min<60)return `${min}m ago`;return `${Math.floor(min/60)}h ago`;
  }

  async function renderOverallBenchmark({force=false}={}){
    ensurePanel();
    if(!homeActive()||busy)return;
    busy=true;
    const chart=document.getElementById('overallPerformanceChart');
    const note=document.getElementById('overallPerformanceNote');
    if(chart)chart.innerHTML='<div class="history-loading">Loading combined performance…</div>';
    try{
      const start=overallPeriodStart(period);
      const [combined,bench]=await Promise.all([combinedHistory(start,{force}),fetchBenchmarks(start,{force})]);
      const portfolio=portfolioIndex(combined,start);
      const voo=adjustedPoints(bench.history.VOO,bench.quotes.VOO);
      const qqq=adjustedPoints(bench.history.QQQ,bench.quotes.QQQ);
      const baseline=commonBaseline(portfolio,voo,qqq);
      if(!baseline){
        if(chart)chart.innerHTML='<div class="empty">No common baseline date across Whole Portfolio, VOO and QQQ.</div>';
        const legend=document.getElementById('overallPerformanceLegend');if(legend)legend.innerHTML='';
        if(note)note.textContent='A shared trading date is required before the comparison can be shown.';
        return;
      }
      const lines=[
        {name:'Whole Portfolio',points:rebase(portfolio,baseline,'value')},
        {name:'VOO Total Return',points:rebase(voo,baseline,'price')},
        {name:'QQQ Total Return',points:rebase(qqq,baseline,'price')}
      ];
      drawChart(lines);renderLegend(lines);
      const hasOptions=state.assets.some(a=>a.type==='option');
      const flowCount=state.transactions.filter(t=>['Deposit','Withdrawal'].includes(t.type)&&(t.date||'')>=baseline).length;
      if(note){
        const parts=[
          `Common baseline: ${baseline}.`,
          'Whole Portfolio combines the net-asset history of every active portfolio before calculating the return proxy; portfolio returns are not averaged.',
          'VOO / QQQ use adjusted close for history and the latest Yahoo quote for the newest point.',
          'Whole Portfolio is cash-flow adjusted for dated deposits/withdrawals, but is not formal Lifetime TWR/XIRR.',
          `Benchmark checked ${ageText(benchmarkFetchedAt)}.`
        ];
        if(flowCount)parts.push(`${flowCount} dated external cash flow${flowCount===1?' was':'s were'} adjusted in this period.`);
        if(hasOptions)parts.push('Historical option values remain approximate before the latest manual option price.');
        note.textContent=parts.join(' ');
      }
    }catch(err){
      console.error('Overall performance failed',err);
      if(chart)chart.innerHTML='<div class="empty">Could not load combined performance history. Current portfolio data is unaffected.</div>';
      if(note)note.textContent='Overall benchmark comparison is temporarily unavailable.';
    }finally{busy=false;}
  }

  async function refreshOverallPerformance({force=false,refreshPrices=false}={}){
    ensurePanel();renderSummary();
    if(refreshPrices&&typeof refreshStockPrices==='function'){
      try{await refreshStockPrices({force:true,silent:true});renderSummary();}catch{}
    }
    await renderOverallBenchmark({force});
  }
  window.renderOverallPerformance=refreshOverallPerformance;

  const originalRenderHome=window.renderHome;
  if(typeof originalRenderHome==='function'){
    window.renderHome=renderHome=function(){
      originalRenderHome();
      ensurePanel();renderSummary();
      if(homeActive())setTimeout(()=>renderOverallBenchmark({force:false}),0);
    };
  }

  document.getElementById('homeCurrency')?.addEventListener('change',()=>setTimeout(()=>refreshOverallPerformance({force:false}),0));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&homeActive())setTimeout(()=>refreshOverallPerformance({force:false}),300);});
  setInterval(()=>{if(homeActive())refreshOverallPerformance({force:true,refreshPrices:true});},REFRESH_MS);

  ensurePanel();
  renderSummary();
  if(homeActive())setTimeout(()=>renderOverallBenchmark({force:false}),0);
})();
