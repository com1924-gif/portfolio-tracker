/* v2.25 consolidated performance modules: performance-v2.js, performance-cleanup-v2.js, benchmark-live-refresh-v2.js */
(()=>{
  if(window.__portfolioPerformanceInstalledV221)return;
  window.__portfolioPerformanceInstalledV221=true;

  const PERF_API='https://portfolio-tracker-quotes.vercel.app/';
  const PERF_PERIODS=['1M','3M','6M','YTD','1Y','ALL'];
  let performancePeriod='YTD';
  let benchmarkLastFetchedAt=null;
  const benchmarkCache=new Map();

  const style=document.createElement('style');
  style.textContent=`
    .performance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
    .performance-metric{border:1px solid var(--line);background:#111115;border-radius:14px;padding:13px}
    .performance-metric span{display:block;color:var(--muted);font-size:12px;margin-bottom:5px}
    .performance-metric strong{display:block;font-size:17px;line-height:1.25}
    .performance-contribution-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid var(--line)}
    .performance-contribution-row:last-child{border-bottom:0}
    .performance-contribution-sub{font-size:12px;color:var(--muted);margin-top:3px}
    .benchmark-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}
    .benchmark-periods{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 12px}
    .benchmark-period{border:1px solid var(--line);background:#111115;color:var(--muted);border-radius:999px;padding:7px 10px;font-weight:700;cursor:pointer}
    .benchmark-period.active{background:var(--accent);color:#202025;border-color:transparent}
    .benchmark-legend{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0 12px}
    .benchmark-legend-item{border:1px solid var(--line);border-radius:12px;padding:10px;background:#111115}
    .benchmark-legend-item span{display:block;color:var(--muted);font-size:11px;margin-bottom:3px}
    .benchmark-legend-item strong{font-size:15px}
    .benchmark-chart{min-height:230px;display:flex;align-items:center;justify-content:center}
    .benchmark-chart svg{width:100%;height:auto;display:block}
    .benchmark-grid-line{stroke:rgba(255,255,255,.08);stroke-width:1}
    .benchmark-note{font-size:12px;color:var(--muted);line-height:1.45;margin-top:10px}
    @media(max-width:700px){.performance-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.benchmark-legend{grid-template-columns:1fr 1fr 1fr}}
    @media(max-width:460px){.performance-grid{grid-template-columns:1fr 1fr}.benchmark-legend{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function ensurePerformanceTab(){
    const tabs=document.getElementById('portfolioTabs');
    const portfolioView=document.getElementById('portfolioView');
    if(!tabs||!portfolioView)return;

    if(!tabs.querySelector('[data-tab="performance"]')){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='tab-btn';
      btn.dataset.tab='performance';
      btn.textContent='Performance';
      const overviewBtn=tabs.querySelector('[data-tab="overview"]');
      if(overviewBtn?.nextSibling)tabs.insertBefore(btn,overviewBtn.nextSibling);else tabs.appendChild(btn);
      btn.addEventListener('click',()=>showPortfolioTab('performance'));
    }

    if(document.getElementById('tab-performance'))return;
    const section=document.createElement('section');
    section.id='tab-performance';
    section.className='portfolio-tab';
    section.innerHTML=`
      <div class="section-head sticky-section-head">
        <div><h2>Performance</h2><div class="muted">Tracked analytics · VOO / QQQ benchmark</div></div>
      </div>

      <div id="performanceMetrics" class="performance-grid"></div>

      <section class="panel">
        <div class="section-head"><div><h3>P/L Contribution</h3><div class="muted">Tracked realized + unrealized by asset</div></div></div>
        <div id="performanceContributions"></div>
      </section>

      <section class="panel">
        <div class="benchmark-head">
          <div><h3>Portfolio vs VOO / QQQ</h3><div class="muted">Total return · common baseline</div></div>
          <button id="refreshPerformanceBtn" type="button" class="ghost-btn">Refresh</button>
        </div>
        <div id="benchmarkPeriods" class="benchmark-periods"></div>
        <div id="benchmarkLegend" class="benchmark-legend"></div>
        <div id="benchmarkChart" class="benchmark-chart"><div class="empty">Open Performance to load comparison.</div></div>
        <div id="benchmarkNote" class="benchmark-note"></div>
      </section>`;

    const overview=document.getElementById('tab-overview');
    if(overview?.nextSibling)portfolioView.insertBefore(section,overview.nextSibling);else portfolioView.appendChild(section);

    document.getElementById('refreshPerformanceBtn')?.addEventListener('click',()=>renderBenchmark({force:true}));
    renderBenchmarkPeriodButtons();
  }

  function renderBenchmarkPeriodButtons(){
    const el=document.getElementById('benchmarkPeriods');
    if(!el)return;
    el.innerHTML=PERF_PERIODS.map(p=>`<button type="button" class="benchmark-period ${p===performancePeriod?'active':''}" data-period="${p}">${p}</button>`).join('');
    el.querySelectorAll('.benchmark-period').forEach(btn=>btn.addEventListener('click',()=>{
      performancePeriod=btn.dataset.period;
      renderBenchmarkPeriodButtons();
      renderBenchmark({force:false});
    }));
  }

  function todayPLStocks(portfolioId){
    return holdingsFor(portfolioId).filter(h=>h.type==='stock').reduce((sum,h)=>{
      const prev=Number(h.previousClose),price=Number(h.price),qty=Number(h.qty)||0;
      if(!(prev>0)||!(price>0)||!qty)return sum;
      return sum+convert(qty*(price-prev),h.currency);
    },0);
  }

  function metric(label,value,number=null,sub=''){
    const cls=number==null?'':number<0?'negative':'positive';
    return `<div class="performance-metric"><span>${label}</span><strong class="${cls}">${value}</strong>${sub?`<div class="performance-contribution-sub">${sub}</div>`:''}</div>`;
  }

  function renderPerformanceSummary(){
    ensurePerformanceTab();
    if(!currentPortfolioId)return;
    const s=typeof capitalSummary==='function'?capitalSummary(currentPortfolioId):summaryFor(currentPortfolioId);
    const base=summaryFor(currentPortfolioId);
    const lifetimeReturn=s.capitalComplete&&Number(s.netContributions)>0?s.lifetimePL/s.netContributions*100:null;
    const today=todayPLStocks(currentPortfolioId);
    const metrics=document.getElementById('performanceMetrics');
    if(metrics){
      metrics.innerHTML=[
        metric('Lifetime P/L',s.capitalComplete?signedMoney(s.lifetimePL):'Set capital',s.capitalComplete?s.lifetimePL:null),
        metric('Lifetime Return',lifetimeReturn==null?'—':pct(lifetimeReturn),lifetimeReturn,'Simple return; not annualized'),
        metric('Today P/L (stocks)',signedMoney(today),today,'Options excluded'),
        metric('Open P/L',signedMoney(base.unrealized),base.unrealized,'Current holdings only'),
        metric('Tracked Realized P/L',signedMoney(base.realized),base.realized,'Recorded transactions only'),
        metric('Net Contributions',s.capitalComplete?money(s.netContributions):'—',null,'Deposits less withdrawals snapshot')
      ].join('');
    }

    const positions=typeof positionsFor==='function'?positionsFor(currentPortfolioId):holdingsFor(currentPortfolioId);
    const rows=positions.map(p=>({p,pl:convert(Number(p.totalPL)||0,p.currency)})).sort((a,b)=>Math.abs(b.pl)-Math.abs(a.pl));
    const contributions=document.getElementById('performanceContributions');
    if(contributions){
      contributions.innerHTML=rows.length?rows.slice(0,12).map(({p,pl})=>`<div class="performance-contribution-row">
        <div><strong>${esc(p.symbol)}</strong><div class="performance-contribution-sub">${p.qty>1e-9?'Open':'Closed'} · ${esc(p.name||'')}</div></div>
        <div class="right ${pl<0?'negative':'positive'}"><strong>${signedMoney(pl)}</strong></div>
      </div>`).join(''):'<div class="empty">No tracked positions yet.</div>';
    }
  }

  async function fetchBenchmarks(start,{force=false}={}){
    const key=start;
    const cached=benchmarkCache.get(key);
    if(!force&&cached&&Date.now()-cached.time<15*60*1000){benchmarkLastFetchedAt=cached.fetchedAt;return cached.data;}
    const res=await fetch(`${PERF_API}?symbols=VOO%2CQQQ&mode=history&start=${encodeURIComponent(start)}`);
    if(!res.ok)throw new Error(`Benchmark service returned ${res.status}`);
    const data=await res.json();
    const history=data.history||{};
    benchmarkLastFetchedAt=new Date().toISOString();
    benchmarkCache.set(key,{time:Date.now(),fetchedAt:benchmarkLastFetchedAt,data:history});
    return history;
  }

  function externalFlowsByDate(portfolioId,start){
    const flows=new Map();
    state.transactions.filter(t=>t.accountId===portfolioId&&['Deposit','Withdrawal'].includes(t.type)&&(t.date||'')>=start).forEach(t=>{
      const amount=convert(Number(t.amount)||0,t.currency);
      const signed=t.type==='Deposit'?amount:-amount;
      flows.set(t.date,(flows.get(t.date)||0)+signed);
    });
    return flows;
  }

  function trackedReturnSeries(series,portfolioId,start){
    if(!Array.isArray(series)||series.length<2)return [];
    const flows=externalFlowsByDate(portfolioId,start);
    let first=series.findIndex(p=>Number(p.value)>0);
    if(first<0||first>=series.length-1)return [];
    let index=100;
    const out=[{date:series[first].date,value:index}];
    let prev=Number(series[first].value);
    for(let i=first+1;i<series.length;i++){
      const cur=Number(series[i].value);
      if(!(prev>0)||!Number.isFinite(cur)){prev=cur;continue;}
      const flow=flows.get(series[i].date)||0;
      const r=(cur-flow-prev)/prev;
      if(Number.isFinite(r)&&r>-1){
        index*=1+r;
        out.push({date:series[i].date,value:index});
      }
      prev=cur;
    }
    return out;
  }

  function cleanBenchmarkPoints(points){
    let fallback=false;
    const clean=Array.isArray(points)?points.filter(p=>p&&p.date).map(p=>{
      const adjusted=Number(p.adjClose),close=Number(p.close);
      const price=adjusted>0?adjusted:close;
      if(!(adjusted>0)&&close>0)fallback=true;
      return {date:p.date,price};
    }).filter(p=>p.price>0).sort((a,b)=>a.date.localeCompare(b.date)):[];
    return {points:clean,fallback};
  }

  function commonBaselineDate(portfolioSeries,vooPoints,qqqPoints){
    if(!portfolioSeries.length||!vooPoints.length||!qqqPoints.length)return null;
    let common=new Set(portfolioSeries.map(p=>p.date));
    const vooDates=new Set(vooPoints.map(p=>p.date));
    const qqqDates=new Set(qqqPoints.map(p=>p.date));
    common=new Set([...common].filter(d=>vooDates.has(d)&&qqqDates.has(d)));
    return [...common].sort()[0]||null;
  }

  function rebasePortfolio(points,baseline){
    const basePoint=points.find(p=>p.date===baseline);
    if(!basePoint||!(Number(basePoint.value)>0))return [];
    const base=Number(basePoint.value);
    return points.filter(p=>p.date>=baseline).map(p=>({date:p.date,value:Number(p.value)/base*100}));
  }

  function benchmarkIndexed(cleanPoints,baseline){
    const basePoint=cleanPoints.find(p=>p.date===baseline);
    if(!basePoint||!(Number(basePoint.price)>0))return [];
    const base=Number(basePoint.price);
    return cleanPoints.filter(p=>p.date>=baseline).map(p=>({date:p.date,value:Number(p.price)/base*100}));
  }

  function drawBenchmarkChart(lines){
    const el=document.getElementById('benchmarkChart');
    if(!el)return;
    const all=lines.flatMap(l=>l.points.map(p=>({date:p.date,value:p.value})));
    if(all.length<2){el.innerHTML='<div class="empty">Not enough comparable history for this period.</div>';return;}
    const times=all.map(p=>new Date(`${p.date}T00:00:00`).getTime());
    const vals=all.map(p=>Number(p.value)).filter(Number.isFinite);
    if(!vals.length){el.innerHTML='<div class="empty">Not enough comparable history for this period.</div>';return;}
    const minT=Math.min(...times),maxT=Math.max(...times);
    let minV=Math.min(...vals),maxV=Math.max(...vals);
    if(minV===maxV){minV-=1;maxV+=1;}
    const pad=(maxV-minV)*0.08;minV-=pad;maxV+=pad;
    const w=760,h=265,padX=18,padY=22;
    const x=date=>{const t=new Date(`${date}T00:00:00`).getTime();return padX+(w-padX*2)*((t-minT)/Math.max(1,maxT-minT));};
    const y=v=>padY+(h-padY*2)*(1-(v-minV)/(maxV-minV));
    const zeroY=y(100);
    const colors=['#d9b5e8','#59c3c3','#f4c95d'];
    const polylines=lines.map((line,i)=>{
      if(!line.points.length)return '';
      const pts=line.points.map(p=>`${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="${colors[i]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    }).join('');
    el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Portfolio versus VOO and QQQ total return comparison">
      <line x1="${padX}" y1="${zeroY}" x2="${w-padX}" y2="${zeroY}" class="benchmark-grid-line"/>
      <line x1="${padX}" y1="${y(maxV)}" x2="${w-padX}" y2="${y(maxV)}" class="benchmark-grid-line"/>
      <line x1="${padX}" y1="${y(minV)}" x2="${w-padX}" y2="${y(minV)}" class="benchmark-grid-line"/>
      ${polylines}
    </svg>`;
  }

  function finalReturn(points){
    if(!Array.isArray(points)||points.length<2)return null;
    return Number(points[points.length-1].value)-100;
  }

  function renderBenchmarkLegend(lines){
    const el=document.getElementById('benchmarkLegend');
    if(!el)return;
    el.innerHTML=lines.map(line=>{
      const r=finalReturn(line.points);
      return `<div class="benchmark-legend-item"><span>${line.name}</span><strong class="${r==null?'':r<0?'negative':'positive'}">${r==null?'—':pct(r)}</strong></div>`;
    }).join('');
  }

  function shortDate(date){
    if(!date)return '—';
    const d=new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime())?date:new Intl.DateTimeFormat('en-HK',{day:'numeric',month:'short',year:'numeric'}).format(d);
  }

  function ageText(iso){
    if(!iso)return '—';
    const d=new Date(iso);if(Number.isNaN(d.getTime()))return '—';
    const min=Math.max(0,Math.floor((Date.now()-d.getTime())/60000));
    if(min<1)return 'just now';
    if(min<60)return `${min}m ago`;
    return `${Math.floor(min/60)}h ago`;
  }

  async function renderBenchmark({force=false}={}){
    ensurePerformanceTab();
    if(!currentPortfolioId)return;
    const portfolioId=currentPortfolioId;
    const chart=document.getElementById('benchmarkChart');
    const note=document.getElementById('benchmarkNote');
    if(chart)chart.innerHTML='<div class="history-loading">Loading total-return benchmark…</div>';
    try{
      const start=periodStart(portfolioId,performancePeriod);
      const [{pairs,history},benchmarks]=await Promise.all([
        fetchHistoryForPortfolio(portfolioId,start,{force}),
        fetchBenchmarks(start,{force})
      ]);
      if(currentPortfolioId!==portfolioId)return;
      const netSeries=buildPortfolioHistory(portfolioId,start,pairs,history);
      const rawPortfolio=trackedReturnSeries(netSeries,portfolioId,start);
      const vooClean=cleanBenchmarkPoints(benchmarks.VOO);
      const qqqClean=cleanBenchmarkPoints(benchmarks.QQQ);
      const baseline=commonBaselineDate(rawPortfolio,vooClean.points,qqqClean.points);
      if(!baseline){
        if(chart)chart.innerHTML='<div class="empty">No common baseline date across Portfolio, VOO and QQQ for this period.</div>';
        const legend=document.getElementById('benchmarkLegend');if(legend)legend.innerHTML='';
        if(note)note.textContent='Benchmark comparison requires one shared trading date across all three series.';
        return;
      }

      const lines=[
        {name:'Portfolio',points:rebasePortfolio(rawPortfolio,baseline)},
        {name:'VOO Total Return',points:benchmarkIndexed(vooClean.points,baseline)},
        {name:'QQQ Total Return',points:benchmarkIndexed(qqqClean.points,baseline)}
      ];
      drawBenchmarkChart(lines);
      renderBenchmarkLegend(lines);

      const cashFlows=state.transactions.some(t=>t.accountId===portfolioId&&['Deposit','Withdrawal'].includes(t.type)&&(t.date||'')>=baseline);
      const hasOptions=state.assets.some(a=>a.accountId===portfolioId&&a.type==='option');
      const fxInfo=typeof getLiveFxInfo==='function'?getLiveFxInfo():null;
      const fxText=fxInfo?.updatedAt?'current live/saved FX':'reference FX';
      if(note){
        const parts=[
          `Common baseline: ${shortDate(baseline)}.`,
          'VOO / QQQ use Yahoo adjusted close as a dividend- and split-adjusted total-return proxy.',
          'Portfolio is a tracked-period cash-flow-adjusted proxy; it is not formal Lifetime TWR/XIRR because older contribution dates are unavailable.',
          `Historical FX uses ${fxText}.`,
          `Benchmark updated ${ageText(benchmarkLastFetchedAt)}.`
        ];
        if(cashFlows)parts.push('Dated deposits/withdrawals in this period are adjusted in the portfolio return proxy.');
        if(hasOptions)parts.push('Historical option values remain approximate before the latest manual option price.');
        if(vooClean.fallback||qqqClean.fallback)parts.push('Some adjusted-close points were unavailable and fell back to closing price.');
        note.textContent=parts.join(' ');
      }
    }catch(err){
      console.error('Performance benchmark failed',err);
      if(chart)chart.innerHTML='<div class="empty">Could not load benchmark history. Portfolio data is unaffected.</div>';
      const legend=document.getElementById('benchmarkLegend');if(legend)legend.innerHTML='';
      if(note)note.textContent='Benchmark comparison is temporarily unavailable.';
    }
  }
  window.renderBenchmark=renderBenchmark;

  ensurePerformanceTab();

  const originalShowPortfolioTab=window.showPortfolioTab;
  window.showPortfolioTab=showPortfolioTab=function(tab){
    originalShowPortfolioTab(tab);
    if(tab==='performance'){
      renderPerformanceSummary();
      setTimeout(()=>renderBenchmark({force:false}),0);
    }
  };

  const originalRenderPortfolio=window.renderPortfolio;
  window.renderPortfolio=renderPortfolio=function(){
    originalRenderPortfolio();
    renderPerformanceSummary();
    if(document.querySelector('.tab-btn[data-tab="performance"]')?.classList.contains('active'))setTimeout(()=>renderBenchmark({force:false}),0);
  };

  ['homeCurrency','portfolioCurrency'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{
    if(currentPortfolioId){
      renderPerformanceSummary();
      if(document.querySelector('.tab-btn[data-tab="performance"]')?.classList.contains('active'))renderBenchmark({force:false});
    }
  }));
})();


(()=>{
  if(window.__portfolioPerformanceCleanupInstalledV219)return;
  window.__portfolioPerformanceCleanupInstalledV219=true;

  function removeBestWorst(){
    document.getElementById('performanceBestWorst')?.remove();
  }

  removeBestWorst();

  const originalShowPortfolioTab=window.showPortfolioTab;
  if(typeof originalShowPortfolioTab==='function'){
    window.showPortfolioTab=tab=>{
      originalShowPortfolioTab(tab);
      if(tab==='performance')removeBestWorst();
    };
  }

  const originalRenderAll=window.renderAll||renderAll;
  window.renderAll=renderAll=function(){
    originalRenderAll();
    removeBestWorst();
  };
})();


(()=>{
  if(window.__portfolioBenchmarkLiveRefreshInstalledV2212)return;
  window.__portfolioBenchmarkLiveRefreshInstalledV2212=true;

  const API='https://portfolio-tracker-quotes.vercel.app/';
  const REFRESH_MS=5*60*1000;
  let busy=false;

  function performanceActive(){
    return !!document.getElementById('tab-performance')?.classList.contains('active');
  }

  function activePeriod(){
    return document.querySelector('#benchmarkPeriods .benchmark-period.active')?.dataset?.period||'YTD';
  }

  function newYorkDate(){
    const parts=new Intl.DateTimeFormat('en-US',{
      timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(new Date());
    const get=type=>parts.find(p=>p.type===type)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function externalFlows(portfolioId,start){
    const flows=new Map();
    state.transactions.filter(t=>t.accountId===portfolioId&&['Deposit','Withdrawal'].includes(t.type)&&(t.date||'')>=start).forEach(t=>{
      const amount=convert(Number(t.amount)||0,t.currency);
      const signed=t.type==='Deposit'?amount:-amount;
      flows.set(t.date,(flows.get(t.date)||0)+signed);
    });
    return flows;
  }

  function portfolioIndex(series,portfolioId,start){
    if(!Array.isArray(series)||series.length<2)return [];
    const flows=externalFlows(portfolioId,start);
    const first=series.findIndex(p=>Number(p.value)>0);
    if(first<0||first>=series.length-1)return [];
    let index=100;
    let prev=Number(series[first].value);
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

  function adjustedPoints(raw,quote){
    const rows=Array.isArray(raw)?raw.filter(p=>p&&p.date&&Number(p.close)>0).map(p=>({
      date:p.date,
      close:Number(p.close),
      adjusted:Number(p.adjClose)>0?Number(p.adjClose):Number(p.close)
    })).sort((a,b)=>a.date.localeCompare(b.date)):[];
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

  function commonBaseline(portfolio,voo,qqq){
    if(!portfolio.length||!voo.length||!qqq.length)return null;
    const vd=new Set(voo.map(p=>p.date));
    const qd=new Set(qqq.map(p=>p.date));
    return portfolio.map(p=>p.date).filter(d=>vd.has(d)&&qd.has(d)).sort()[0]||null;
  }

  function rebase(points,baseline,key='value'){
    const basePoint=points.find(p=>p.date===baseline);
    const base=Number(basePoint?.[key]);
    if(!(base>0))return [];
    return points.filter(p=>p.date>=baseline).map(p=>({date:p.date,value:Number(p[key])/base*100}));
  }

  function finalReturn(points){
    if(!points.length)return null;
    return Number(points[points.length-1].value)-100;
  }

  function renderLegend(lines){
    const el=document.getElementById('benchmarkLegend');
    if(!el)return;
    el.innerHTML=lines.map(line=>{
      const r=finalReturn(line.points);
      return `<div class="benchmark-legend-item"><span>${line.name}</span><strong class="${r==null?'':r<0?'negative':'positive'}">${r==null?'—':pct(r)}</strong></div>`;
    }).join('');
  }

  function draw(lines){
    const el=document.getElementById('benchmarkChart');
    if(!el)return;
    const all=lines.flatMap(line=>line.points);
    if(all.length<2){el.innerHTML='<div class="empty">Not enough comparable history for this period.</div>';return;}
    const times=all.map(p=>new Date(`${p.date}T00:00:00`).getTime());
    const vals=all.map(p=>Number(p.value)).filter(Number.isFinite);
    const minT=Math.min(...times),maxT=Math.max(...times);
    let minV=Math.min(...vals),maxV=Math.max(...vals);
    if(minV===maxV){minV-=1;maxV+=1;}
    const pad=(maxV-minV)*0.08;minV-=pad;maxV+=pad;
    const w=760,h=265,padX=18,padY=22;
    const x=date=>{const t=new Date(`${date}T00:00:00`).getTime();return padX+(w-padX*2)*((t-minT)/Math.max(1,maxT-minT));};
    const y=v=>padY+(h-padY*2)*(1-(v-minV)/(maxV-minV));
    const colors=['#d9b5e8','#59c3c3','#f4c95d'];
    const paths=lines.map((line,i)=>{
      const pts=line.points.map(p=>`${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
      return pts?`<polyline points="${pts}" fill="none" stroke="${colors[i]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`:'';
    }).join('');
    el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Portfolio versus VOO and QQQ benchmark">
      <line x1="${padX}" y1="${y(100)}" x2="${w-padX}" y2="${y(100)}" class="benchmark-grid-line"/>
      <line x1="${padX}" y1="${y(maxV)}" x2="${w-padX}" y2="${y(maxV)}" class="benchmark-grid-line"/>
      <line x1="${padX}" y1="${y(minV)}" x2="${w-padX}" y2="${y(minV)}" class="benchmark-grid-line"/>
      ${paths}
    </svg>`;
  }

  async function fetchBench(start){
    const stamp=Math.floor(Date.now()/60000);
    const [historyRes,quoteRes]=await Promise.all([
      fetch(`${API}?symbols=VOO%2CQQQ&mode=history&start=${encodeURIComponent(start)}&_=${stamp}`,{cache:'no-store'}),
      fetch(`${API}?symbols=VOO%2CQQQ&_=${stamp}`,{cache:'no-store'})
    ]);
    if(!historyRes.ok||!quoteRes.ok)throw new Error('Benchmark data unavailable');
    const history=await historyRes.json();
    const quotes=await quoteRes.json();
    return {history:history.history||{},quotes:quotes.quotes||{}};
  }

  async function renderLive(){
    if(busy||!performanceActive()||!currentPortfolioId)return;
    busy=true;
    const portfolioId=currentPortfolioId;
    const chart=document.getElementById('benchmarkChart');
    const note=document.getElementById('benchmarkNote');
    try{
      const period=activePeriod();
      const start=periodStart(portfolioId,period);
      if(typeof refreshStockPrices==='function')await refreshStockPrices({force:true,silent:true});
      const [portfolioData,bench]=await Promise.all([
        (async()=>{
          const result=await fetchHistoryForPortfolio(portfolioId,start,{force:false});
          return buildPortfolioHistory(portfolioId,start,result.pairs,result.history);
        })(),
        fetchBench(start)
      ]);
      if(currentPortfolioId!==portfolioId||!performanceActive())return;

      const portfolioRaw=portfolioIndex(portfolioData,portfolioId,start);
      const vooRaw=adjustedPoints(bench.history.VOO,bench.quotes.VOO);
      const qqqRaw=adjustedPoints(bench.history.QQQ,bench.quotes.QQQ);
      const baseline=commonBaseline(portfolioRaw,vooRaw,qqqRaw);
      if(!baseline){
        if(chart)chart.innerHTML='<div class="empty">No common baseline date across Portfolio, VOO and QQQ.</div>';
        return;
      }

      const lines=[
        {name:'Portfolio',points:rebase(portfolioRaw,baseline,'value')},
        {name:'VOO Total Return',points:rebase(vooRaw,baseline,'price')},
        {name:'QQQ Total Return',points:rebase(qqqRaw,baseline,'price')}
      ];
      draw(lines);renderLegend(lines);
      if(note){
        const quoteTime=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        note.textContent=`Common baseline: ${baseline}. Historical VOO / QQQ use adjusted close; the latest point is joined to the newest Yahoo quote and refreshes while Performance is open. Last benchmark check: ${quoteTime}. Yahoo quotes may be delayed and pre-market may still show the prior regular-market price. Portfolio remains a tracked-period cash-flow-adjusted proxy, not formal TWR/XIRR.`;
      }
    }catch(err){
      console.warn('Live benchmark refresh failed',err);
    }finally{busy=false;}
  }

  window.renderLiveBenchmark=renderLive;

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('[data-tab="performance"]'))setTimeout(renderLive,1500);
    if(event.target?.closest?.('#benchmarkPeriods .benchmark-period'))setTimeout(renderLive,1500);
    if(event.target?.closest?.('#refreshPerformanceBtn'))setTimeout(renderLive,1500);
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&performanceActive())setTimeout(renderLive,800);
  });

  setInterval(renderLive,REFRESH_MS);
})();
