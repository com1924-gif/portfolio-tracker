(()=>{
  if(window.__overallReturnSummaryV22517)return;
  window.__overallReturnSummaryV22517=true;

  const PERIODS=['1W','MTD','1M','3M','YTD','1Y','ALL'];
  let mode='value';
  let period='1Y';
  let renderSeq=0;

  const style=document.createElement('style');
  style.textContent=`
    .overall-return-panel{margin-top:14px;padding:0;overflow:hidden}
    .overall-return-head{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--line)}
    .overall-return-tab{border:0;background:transparent;color:var(--muted);padding:15px 12px 13px;font-weight:800;position:relative;cursor:pointer}
    .overall-return-tab.active{color:var(--text)}
    .overall-return-tab.active:after{content:"";position:absolute;left:18%;right:18%;bottom:-1px;height:2px;background:var(--accent);border-radius:2px}
    .overall-return-body{padding:17px 16px 15px}
    .overall-return-label{font-size:12px;color:var(--muted);font-weight:700;margin-bottom:5px}
    .overall-return-hero{font-size:30px;font-weight:650;letter-spacing:.01em;line-height:1.1}
    .overall-return-sub{font-size:13px;margin-top:7px;min-height:18px}
    .overall-return-chart{min-height:245px;margin:10px -4px 2px;display:flex;align-items:center;justify-content:center}
    .overall-return-chart svg{display:block;width:100%;height:auto}
    .overall-return-periods{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;padding:7px 0 2px}
    .overall-return-periods::-webkit-scrollbar{display:none}
    .overall-return-period{border:0;background:transparent;color:var(--muted);padding:8px 9px;border-radius:8px;font-size:12px;font-weight:800;white-space:nowrap;cursor:pointer}
    .overall-return-period.active{background:#24242b;color:var(--accent)}
    .overall-return-note{font-size:11px;line-height:1.45;color:var(--muted);margin-top:10px}
    .overall-return-loading{color:var(--muted);font-size:12px}
    @media(max-width:520px){
      .overall-return-body{padding:15px 12px 13px}
      .overall-return-hero{font-size:28px}
      .overall-return-period{padding:8px 8px}
    }
  `;
  document.head.appendChild(style);

  function ensurePanel(){
    const home=document.getElementById('homeView');
    if(!home)return null;
    let panel=document.getElementById('overallReturnPanel');
    if(!panel){
      panel=document.createElement('section');
      panel.id='overallReturnPanel';
      panel.className='panel overall-return-panel';
      panel.innerHTML=`
        <div class="overall-return-head">
          <button type="button" class="overall-return-tab active" data-mode="value">Value</button>
          <button type="button" class="overall-return-tab" data-mode="performance">Performance</button>
        </div>
        <div class="overall-return-body">
          <div id="overallReturnLabel" class="overall-return-label">All portfolios · Net Assets</div>
          <div id="overallReturnHero" class="overall-return-hero">—</div>
          <div id="overallReturnSub" class="overall-return-sub"></div>
          <div id="overallReturnChart" class="overall-return-chart"><div class="overall-return-loading">Loading overall history…</div></div>
          <div id="overallReturnPeriods" class="overall-return-periods"></div>
          <div id="overallReturnNote" class="overall-return-note"></div>
        </div>`;
      home.appendChild(panel);
    }
    if(panel.dataset.overallReturnBound!=='1'){
      panel.dataset.overallReturnBound='1';
      panel.querySelectorAll('.overall-return-tab').forEach(btn=>btn.addEventListener('click',()=>{
        mode=btn.dataset.mode;
        panel.querySelectorAll('.overall-return-tab').forEach(b=>b.classList.toggle('active',b===btn));
        renderOverallReturn();
      }));
    }
    renderPeriods();
    return panel;
  }

  function renderPeriods(){
    const el=document.getElementById('overallReturnPeriods');
    if(!el)return;
    el.innerHTML=PERIODS.map(p=>`<button type="button" class="overall-return-period ${p===period?'active':''}" data-period="${p}">${p}</button>`).join('');
    el.querySelectorAll('.overall-return-period').forEach(btn=>btn.addEventListener('click',()=>{
      period=btn.dataset.period;
      renderPeriods();
      renderOverallReturn();
    }));
  }

  function dateString(d){
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function startForPeriod(p){
    const now=new Date();
    const d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if(p==='1W')d.setDate(d.getDate()-7);
    else if(p==='MTD')return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    else if(p==='1M')d.setMonth(d.getMonth()-1);
    else if(p==='3M')d.setMonth(d.getMonth()-3);
    else if(p==='YTD')return `${now.getFullYear()}-01-01`;
    else if(p==='1Y')d.setFullYear(d.getFullYear()-1);
    else if(p==='ALL'){
      const dates=[
        ...state.transactions.map(t=>t.date),
        ...state.fx.map(f=>f.date)
      ].filter(Boolean).sort();
      if(dates.length)return dates[0];
      d.setFullYear(d.getFullYear()-1);
    }
    return dateString(d);
  }

  function fetchStart(start){
    const d=new Date(`${start}T00:00:00`);
    if(Number.isNaN(d.getTime()))return start;
    d.setDate(d.getDate()-10);
    return dateString(d);
  }

  function activeAccounts(){
    return state.accounts.filter(a=>
      state.assets.some(x=>x.accountId===a.id)||
      state.transactions.some(t=>t.accountId===a.id)||
      state.fx.some(f=>f.accountId===a.id)
    );
  }

  async function buildOverallValueSeries(start,{force=false}={}){
    const accounts=activeAccounts();
    if(!accounts.length)return [];
    const from=fetchStart(start);
    const fetched=await Promise.all(accounts.map(async a=>{
      const data=await fetchHistoryForPortfolio(a.id,from,{force});
      const lookups=new Map();
      data.pairs.forEach(({asset,symbol})=>lookups.set(asset.id,buildCloseLookup(data.history[symbol])));
      return {account:a,lookups};
    }));

    const dates=new Set([start,dateString(new Date())]);
    fetched.forEach(({account,lookups})=>{
      for(const points of lookups.values())for(const p of points)if(p.date>=start)dates.add(p.date);
      state.transactions.filter(t=>t.accountId===account.id&&t.date>=start).forEach(t=>dates.add(t.date));
      state.fx.filter(f=>f.accountId===account.id&&f.date>=start).forEach(f=>dates.add(f.date));
    });

    const today=dateString(new Date());
    const out=[];
    for(const date of [...dates].filter(Boolean).sort()){
      let total=0;
      for(const {account,lookups} of fetched){
        const assets=state.assets.filter(a=>a.accountId===account.id);
        let invested=0;
        for(const asset of assets){
          const qty=qtyAt(asset.id,date);
          if(!qty)continue;
          let price=0;
          if(asset.type==='stock'){
            price=closeAt(lookups.get(asset.id)||[],date);
            if(price==null)price=lastTradePriceAt(asset.id,date)||0;
            if(date===today&&Number(asset.price)>0)price=Number(asset.price);
          }else{
            price=optionPriceAt(asset,date);
          }
          invested+=convert(qty*price*multiplier(asset),asset.currency);
        }
        const cashBal=cashBalancesAt(account.id,date);
        const cash=Object.entries(cashBal).reduce((s,[c,v])=>s+convert(v,c),0);
        total+=invested+cash;
      }
      out.push({date,value:total});
    }
    return out;
  }

  function flowsByDate(start){
    const map=new Map();
    state.transactions.filter(t=>['Deposit','Withdrawal'].includes(t.type)&&(t.date||'')>=start).forEach(t=>{
      const amount=convert(Number(t.amount)||0,t.currency);
      const signed=t.type==='Deposit'?amount:-amount;
      map.set(t.date,(map.get(t.date)||0)+signed);
    });
    return map;
  }

  function performanceSeries(values,start){
    if(!Array.isArray(values)||values.length<2)return [];
    const flows=flowsByDate(start);
    let first=values.findIndex(p=>Number(p.value)>0);
    if(first<0||first>=values.length)return [];
    let index=1;
    let prev=Number(values[first].value);
    const out=[{date:values[first].date,value:0}];
    for(let i=first+1;i<values.length;i++){
      const cur=Number(values[i].value);
      if(!(prev>0)||!Number.isFinite(cur)){prev=cur;continue;}
      const flow=flows.get(values[i].date)||0;
      const r=(cur-flow-prev)/prev;
      if(Number.isFinite(r)&&r>-1){
        index*=1+r;
        out.push({date:values[i].date,value:(index-1)*100});
      }
      prev=cur;
    }
    return out;
  }

  function compactValue(n){
    return new Intl.NumberFormat('en-HK',{notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
  }

  function periodCaption(){
    return ({'1W':'past week','MTD':'month to date','1M':'past month','3M':'past 3 months','YTD':'year to date','1Y':'past year','ALL':'tracked period'})[period]||period;
  }

  function shortDate(s){
    const d=new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime())?s:new Intl.DateTimeFormat('en-HK',{day:'numeric',month:'short',year:period==='ALL'?'2-digit':undefined}).format(d);
  }

  function drawChart(series,isPerformance){
    const el=document.getElementById('overallReturnChart');
    if(!el)return;
    if(!series||series.length<2){
      el.innerHTML='<div class="empty">Not enough history for this period.</div>';
      return;
    }
    const vals=series.map(p=>Number(p.value)).filter(Number.isFinite);
    if(vals.length<2){
      el.innerHTML='<div class="empty">Not enough history for this period.</div>';
      return;
    }
    let min=Math.min(...vals),max=Math.max(...vals);
    if(isPerformance){min=Math.min(min,0);max=Math.max(max,0);}
    if(min===max){min-=1;max+=1;}
    const pad=(max-min)*0.08||1;min-=pad;max+=pad;

    const w=720,h=250,left=10,right=58,top=18,bottom=26;
    const times=series.map(p=>new Date(`${p.date}T00:00:00`).getTime());
    const minT=Math.min(...times),maxT=Math.max(...times);
    const x=d=>left+(w-left-right)*((new Date(`${d}T00:00:00`).getTime()-minT)/Math.max(1,maxT-minT));
    const y=v=>top+(h-top-bottom)*(1-(v-min)/(max-min));
    const pts=series.map(p=>`${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const end=Number(series[series.length-1].value)||0;
    const start=Number(series[0].value)||0;
    const stroke=isPerformance?(end<0?'#ff5d57':'#d9b5e8'):(end-start<0?'#ff5d57':'#70a8ff');
    const mid=(max+min)/2;
    const fmt=v=>isPerformance?`${v.toFixed(1)}%`:compactValue(v);
    const area=isPerformance?'':`<defs><linearGradient id="overallValueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${stroke}" stop-opacity=".20"/><stop offset="100%" stop-color="${stroke}" stop-opacity="0"/></linearGradient></defs><polygon points="${left},${h-bottom} ${pts} ${w-right},${h-bottom}" fill="url(#overallValueFill)"/>`;
    const zero=isPerformance&&min<0&&max>0?`<line x1="${left}" y1="${y(0)}" x2="${w-right}" y2="${y(0)}" stroke="rgba(255,255,255,.16)" stroke-dasharray="4 4"/>`:'';
    el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Overall portfolio ${isPerformance?'performance':'value'} history">
      ${area}
      <line x1="${left}" y1="${y(max)}" x2="${w-right}" y2="${y(max)}" stroke="rgba(255,255,255,.07)"/>
      <line x1="${left}" y1="${y(mid)}" x2="${w-right}" y2="${y(mid)}" stroke="rgba(255,255,255,.05)"/>
      <line x1="${left}" y1="${y(min)}" x2="${w-right}" y2="${y(min)}" stroke="rgba(255,255,255,.07)"/>
      ${zero}
      <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${x(series[series.length-1].date)}" cy="${y(end)}" r="4.5" fill="${stroke}"/>
      <text x="${w-right+7}" y="${y(max)+4}" fill="#8e8e99" font-size="11">${fmt(max)}</text>
      <text x="${w-right+7}" y="${y(mid)+4}" fill="#8e8e99" font-size="11">${fmt(mid)}</text>
      <text x="${w-right+7}" y="${y(min)+4}" fill="#8e8e99" font-size="11">${fmt(min)}</text>
      <text x="${left}" y="${h-5}" fill="#8e8e99" font-size="11">${shortDate(series[0].date)}</text>
      <text x="${w-right}" y="${h-5}" fill="#8e8e99" text-anchor="end" font-size="11">${shortDate(series[series.length-1].date)}</text>
    </svg>`;
  }

  async function renderOverallReturn({force=false}={}){
    ensurePanel();
    if(currentPortfolioId!==null)return;
    const seq=++renderSeq;
    const chart=document.getElementById('overallReturnChart');
    const hero=document.getElementById('overallReturnHero');
    const sub=document.getElementById('overallReturnSub');
    const label=document.getElementById('overallReturnLabel');
    const note=document.getElementById('overallReturnNote');
    if(window.PortfolioYtdAnchor?.renderOverall(mode,period))return;
    if(chart)chart.innerHTML='<div class="overall-return-loading">Loading overall history…</div>';
    if(label)label.textContent=mode==='value'?'All portfolios · Net Assets':'All portfolios · Total Return';

    try{
      const start=startForPeriod(period);
      const values=await buildOverallValueSeries(start,{force});
      if(seq!==renderSeq||currentPortfolioId!==null)return;

      if(mode==='performance'){
        const perf=performanceSeries(values,start);
        const end=perf.length?Number(perf[perf.length-1].value):null;
        if(hero){
          hero.textContent=end==null?'—':pct(end);
          hero.className=`overall-return-hero ${end==null?'':end<0?'negative':'positive'}`;
        }
        if(sub){
          sub.textContent=end==null?'Insufficient tracked history':`Total return · ${periodCaption()}`;
          sub.className='overall-return-sub';
        }
        drawChart(perf,true);
      }else{
        const first=values.length?Number(values[0].value):null;
        const end=values.length?Number(values[values.length-1].value):null;
        const change=first!=null&&end!=null?end-first:null;
        const changePct=first?change/Math.abs(first)*100:null;
        if(hero){
          hero.textContent=end==null?'—':money(end);
          hero.className='overall-return-hero';
        }
        if(sub){
          sub.innerHTML=change==null?'':`<span class="${change<0?'negative':'positive'}">${signedMoney(change)}${changePct==null?'':` (${pct(changePct)})`}</span> · ${periodCaption()}`;
          sub.className='overall-return-sub';
        }
        drawChart(values,false);
      }

      const hasOptions=state.assets.some(a=>a.type==='option');
      const hasFlows=state.transactions.some(t=>['Deposit','Withdrawal'].includes(t.type)&&(t.date||'')>=start);
      if(note){
        const parts=mode==='value'
          ?['Value is combined Net Assets across all portfolios and includes recorded deposits / withdrawals.']
          :['Performance removes recorded deposits / withdrawals from the selected period and compounds the remaining portfolio return.'];
        parts.push('Historical FX uses the current saved/reference FX rates.');
        if(hasOptions)parts.push('Historical option values are approximate before the latest recorded/manual option price.');
        if(mode==='performance'&&period==='ALL')parts.push('All is a tracked-period proxy, not formal Lifetime TWR/XIRR, because older contribution dates may be incomplete.');
        if(mode==='performance'&&!hasFlows)parts.push('No dated external cash flows were recorded in this period.');
        note.textContent=parts.join(' ');
      }
    }catch(err){
      console.error('Overall return summary failed',err);
      if(chart)chart.innerHTML='<div class="empty">Could not load overall history. Current portfolio data is unaffected.</div>';
      if(hero)hero.textContent='—';
      if(sub)sub.textContent='';
      if(note)note.textContent='Historical chart is temporarily unavailable.';
    }
  }
  window.renderOverallReturn=renderOverallReturn;

  ensurePanel();
  const originalRenderHome=window.renderHome;
  if(typeof originalRenderHome==='function'){
    window.renderHome=renderHome=function(){
      originalRenderHome();
      ensurePanel();
      if(currentPortfolioId===null)setTimeout(()=>renderOverallReturn({force:false}),0);
    };
  }

  document.getElementById('homeCurrency')?.addEventListener('change',()=>{
    if(currentPortfolioId===null)renderOverallReturn({force:false});
  });

  if(currentPortfolioId===null)setTimeout(()=>renderOverallReturn({force:false}),0);
})();
