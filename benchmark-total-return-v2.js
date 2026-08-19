(()=>{
  if(window.__portfolioBenchmarkTotalReturnInstalledV221)return;
  window.__portfolioBenchmarkTotalReturnInstalledV221=true;

  const API='https://portfolio-tracker-quotes.vercel.app/';
  const cache=new Map();
  let busy=false;
  let lastUpdatedAt=null;

  function activePeriod(){
    return document.querySelector('#benchmarkPeriods .benchmark-period.active')?.dataset?.period||'YTD';
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

  function benchmarkIndex(points){
    if(!Array.isArray(points))return {points:[],fallback:false};
    let fallback=false;
    const clean=points.filter(p=>p&&p.date).map(p=>{
      const adjusted=Number(p.adjClose);
      const close=Number(p.close);
      const price=adjusted>0?adjusted:close;
      if(!(adjusted>0)&&close>0)fallback=true;
      return {date:p.date,price};
    }).filter(p=>p.price>0).sort((a,b)=>a.date.localeCompare(b.date));
    if(!clean.length)return {points:[],fallback};
    const base=clean[0].price;
    return {points:clean.map(p=>({date:p.date,value:p.price/base*100})),fallback};
  }

  function commonBaseline(lines){
    if(lines.some(line=>!line.points.length))return null;
    let common=new Set(lines[0].points.map(p=>p.date));
    for(const line of lines.slice(1)){
      const dates=new Set(line.points.map(p=>p.date));
      common=new Set([...common].filter(d=>dates.has(d)));
      if(!common.size)return null;
    }
    return [...common].sort()[0]||null;
  }

  function rebase(points,baseline){
    const filtered=points.filter(p=>p.date>=baseline);
    const exact=filtered.find(p=>p.date===baseline)||filtered[0];
    if(!exact||!(Number(exact.value)>0))return [];
    const base=Number(exact.value);
    return filtered.filter(p=>p.date>=exact.date).map(p=>({date:p.date,value:Number(p.value)/base*100}));
  }

  async function fetchBench(start,{force=false}={}){
    const cached=cache.get(start);
    if(!force&&cached&&Date.now()-cached.at<15*60*1000)return cached.data;
    const res=await fetch(`${API}?symbols=VOO%2CQQQ&mode=history&start=${encodeURIComponent(start)}`,{cache:'no-store'});
    if(!res.ok)throw new Error(`Benchmark service returned ${res.status}`);
    const data=await res.json();
    const history=data.history||{};
    cache.set(start,{at:Date.now(),data:history});
    lastUpdatedAt=new Date().toISOString();
    return history;
  }

  function pctValue(points){
    if(!points.length)return null;
    return Number(points[points.length-1].value)-100;
  }

  function draw(lines){
    const el=document.getElementById('benchmarkChart');
    if(!el)return;
    const all=lines.flatMap(line=>line.points);
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
    const y=value=>padY+(h-padY*2)*(1-(value-minV)/(maxV-minV));
    const colors=['#d9b5e8','#59c3c3','#f4c95d'];
    const paths=lines.map((line,i)=>{
      if(!line.points.length)return '';
      const pts=line.points.map(p=>`${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="${colors[i]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    }).join('');
    el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Portfolio versus VOO and QQQ total return comparison">
      <line x1="${padX}" y1="${y(100)}" x2="${w-padX}" y2="${y(100)}" class="benchmark-grid-line"/>
      <line x1="${padX}" y1="${y(maxV)}" x2="${w-padX}" y2="${y(maxV)}" class="benchmark-grid-line"/>
      <line x1="${padX}" y1="${y(minV)}" x2="${w-padX}" y2="${y(minV)}" class="benchmark-grid-line"/>
      ${paths}
    </svg>`;
  }

  function renderLegend(lines){
    const el=document.getElementById('benchmarkLegend');
    if(!el)return;
    el.innerHTML=lines.map(line=>{
      const r=pctValue(line.points);
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

  async function renderTotalReturn({force=false}={}){
    if(busy||!currentPortfolioId)return;
    if(!document.getElementById('benchmarkChart'))return;
    busy=true;
    const portfolioId=currentPortfolioId;
    const chart=document.getElementById('benchmarkChart');
    const note=document.getElementById('benchmarkNote');
    try{
      const period=activePeriod();
      const start=typeof periodStart==='function'?periodStart(portfolioId,period):`${new Date().getFullYear()}-01-01`;
      if(chart)chart.innerHTML='<div class="history-loading">Loading total-return benchmark…</div>';
      const [portfolioData,bench]=await Promise.all([
        (async()=>{
          const result=await fetchHistoryForPortfolio(portfolioId,start,{force});
          return buildPortfolioHistory(portfolioId,start,result.pairs,result.history);
        })(),
        fetchBench(start,{force})
      ]);
      if(currentPortfolioId!==portfolioId)return;

      const portfolioLine={name:'Portfolio',points:portfolioIndex(portfolioData,portfolioId,start)};
      const voo=benchmarkIndex(bench.VOO);
      const qqq=benchmarkIndex(bench.QQQ);
      const rawLines=[portfolioLine,{name:'VOO Total Return',points:voo.points},{name:'QQQ Total Return',points:qqq.points}];
      const baseline=commonBaseline(rawLines);
      if(!baseline){
        renderLegend(rawLines.map(line=>({...line,points:[]})));
        if(chart)chart.innerHTML='<div class="empty">No common baseline date across Portfolio, VOO and QQQ for this period.</div>';
        if(note)note.textContent='Benchmark comparison requires one shared trading date for all three series.';
        return;
      }
      const lines=rawLines.map(line=>({...line,points:rebase(line.points,baseline)}));
      draw(lines);
      renderLegend(lines);

      const warnings=[];
      if(voo.fallback||qqq.fallback)warnings.push('Some adjusted-close points were unavailable, so closing price was used for those points.');
      if(lines.some(line=>line.points.length<2))warnings.push('One or more series has limited comparable history.');
      const fxInfo=typeof getLiveFxInfo==='function'?getLiveFxInfo():null;
      const fxText=fxInfo?.updatedAt?'current live/saved FX':'reference FX';
      if(note)note.textContent=`Common baseline: ${shortDate(baseline)}. VOO / QQQ use adjusted close as a dividend- and split-adjusted total-return proxy. Portfolio is a tracked-period cash-flow-adjusted proxy, not formal TWR/XIRR. Historical FX uses ${fxText}. Benchmark updated ${ageText(lastUpdatedAt)}.${warnings.length?' '+warnings.join(' '):''}`;

      const subtitle=document.querySelector('#tab-performance .benchmark-head .muted');
      if(subtitle)subtitle.textContent='Total return · common baseline';
    }catch(err){
      console.error('Total return benchmark failed',err);
      if(chart)chart.innerHTML='<div class="empty">Could not load total-return benchmark. Existing portfolio data is unaffected.</div>';
      if(note)note.textContent='Benchmark refresh failed; try again later.';
    }finally{busy=false;}
  }

  window.renderTotalReturnBenchmark=renderTotalReturn;

  const originalShow=window.showPortfolioTab;
  if(typeof originalShow==='function'){
    window.showPortfolioTab=showPortfolioTab=function(tab){
      const result=originalShow(tab);
      if(tab==='performance')setTimeout(()=>renderTotalReturn({force:false}),80);
      return result;
    };
  }

  document.addEventListener('click',event=>{
    const periodBtn=event.target?.closest?.('#benchmarkPeriods .benchmark-period');
    if(periodBtn)setTimeout(()=>renderTotalReturn({force:false}),120);
    if(event.target?.closest?.('#refreshPerformanceBtn'))setTimeout(()=>renderTotalReturn({force:true}),120);
  });

  const observer=new MutationObserver(()=>{
    const tab=document.getElementById('tab-performance');
    if(tab?.classList.contains('active')&&!busy)setTimeout(()=>renderTotalReturn({force:false}),80);
  });
  const portfolioView=document.getElementById('portfolioView');
  if(portfolioView)observer.observe(portfolioView,{subtree:true,attributes:true,attributeFilter:['class']});
})();
