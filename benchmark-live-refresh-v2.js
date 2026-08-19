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
