/* Read-only chart cursor and dated cash-flow presentation. */
(function(root){
  'use strict';
  function nearestIndex(points,date){
    if(!points.length)return -1;
    const target=typeof date==='number'?date:Date.parse(date);if(!Number.isFinite(target))return -1;
    let lo=0,hi=points.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(Date.parse(points[mid].date)<target)lo=mid+1;else hi=mid;}
    return lo>0&&target-Date.parse(points[lo-1].date)<=Date.parse(points[lo].date)-target?lo-1:lo;
  }
  function classifyTransfers(records,selected){
    const ids=new Set(selected),rows=records.map(r=>({...r,internal:false,unmatched:false})),pairs=new Map();
    for(const r of rows)if(r.counterpartyId&&ids.has(r.counterpartyId)){
      const key=String(r.transferId||'');if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push(r);
    }
    for(const pair of pairs.values()){
      const [a,b]=pair,matched=pair.length===2&&a.accountId!==b.accountId&&a.counterpartyId===b.accountId&&b.counterpartyId===a.accountId&&a.date===b.date&&a.currency===b.currency&&Math.abs(Number(a.amount)+Number(b.amount))<=0.005&&String(a.transferId||'').trim();
      for(const r of pair){r.internal=!!matched;r.unmatched=!matched;}
    }
    return rows;
  }
  function totals(rows){
    const external=rows.filter(r=>!r.internal),finite=external.every(r=>Number.isFinite(r.displayAmount));
    return {deposits:finite?external.reduce((s,r)=>s+Math.max(0,r.displayAmount),0):null,withdrawals:finite?external.reduce((s,r)=>s+Math.max(0,-r.displayAmount),0):null,
      net:finite?external.reduce((s,r)=>s+r.displayAmount,0):null,internal:rows.filter(r=>r.internal).length};
  }
  root.PortfolioChartInspectorModel={nearestIndex,classifyTransfers,totals};
  if(typeof document==='undefined')return;
  const bindings=new WeakMap(),ns='http://www.w3.org/2000/svg';
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const style=document.createElement('style');style.id='chartInspectorStyles';style.textContent=`
    .inspectable-chart{display:block!important;overflow:visible!important;position:relative;min-width:0}.chart-inspector-readout{padding:12px 0 16px;min-width:0}.chart-inspector-top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px}.chart-inspector-date{font-size:12px;color:var(--text);font-weight:600}.chart-inspector-latest{border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:7px;font-size:10px;padding:6px 9px;cursor:pointer}.chart-inspector-values{display:grid;grid-template-columns:1fr 1fr;gap:14px}.chart-inspector-values>div{min-width:0}.chart-inspector-values>div:last-child{text-align:right}.chart-inspector-values span{display:block;color:var(--muted);font-size:10px;margin-bottom:6px}.chart-inspector-values strong{display:block;font-weight:550;font-size:22px;letter-spacing:-.02em;overflow-wrap:anywhere}.chart-inspector-values small{display:block;color:var(--muted);font-size:10px;line-height:1.5;margin-top:5px}.chart-inspector-note{font-size:10px;line-height:1.6;color:var(--muted);margin-top:12px}.chart-inspector-day-flows{display:grid;gap:7px;margin-top:12px;font-size:11px}.chart-inspector-day-flow{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.chart-inspector-day-flow span{color:var(--muted)}
    .inspectable-chart>svg{touch-action:pan-y;cursor:crosshair;outline-offset:4px}.inspectable-chart>svg:focus-visible{outline:2px solid var(--accent);border-radius:8px}.chart-cursor-line{stroke:#aebaca;stroke-width:1;stroke-dasharray:4 5}.chart-cursor-dot{fill:var(--accent);stroke:var(--bg);stroke-width:2}.chart-flow-marker{cursor:pointer}.chart-flow-marker circle{stroke:#11171e;stroke-width:2}.chart-flow-marker text{fill:#fff;font-size:8px;font-weight:700;text-anchor:middle;pointer-events:none}.chart-inspector-hint{font-size:10px;color:var(--muted);margin:5px 0 16px;line-height:1.5}.chart-inspector-hint i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#5ea9f6;margin-right:5px}.chart-cash-flows{margin-top:14px;width:100%;max-width:100%;min-width:0}.chart-cash-totals{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;margin:16px 0;color:var(--muted)}.chart-cash-totals strong{color:var(--text);font-weight:550;margin-left:5px}.chart-flow-list{max-height:300px;overflow-y:auto;overscroll-behavior:contain}.chart-flow-row{width:100%;border:0;border-top:1px solid var(--line);border-radius:0;background:transparent;color:var(--text);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;text-align:left;padding:13px 0;cursor:pointer;font:inherit;font-size:11px}.chart-flow-row:hover,.chart-flow-row:focus-visible{background:rgba(94,169,246,.06)}.chart-flow-row small{font-size:9px;color:var(--muted);display:block;margin-top:5px;line-height:1.5}.chart-flow-row>span:last-child{text-align:right}.chart-flow-row strong{font-weight:550}.chart-flow-source{font-size:10px;color:var(--muted);line-height:1.6;margin:12px 0}.chart-flow-empty{font-size:11px;color:var(--muted);padding:12px 0}.chart-cash-errors{font-size:10px;color:var(--accent);line-height:1.5}
    .chart-inspector-tooltip rect{fill:#111923;fill-opacity:.96;stroke:#3a4757;stroke-width:1}.chart-inspector-tooltip text{fill:#e5edf6;font-size:20px;font-weight:500}.chart-inspector-tooltip text:first-of-type{fill:#a8b7c9;font-size:18px}
    #portfolioHistoryPanel:has(.inspectable-chart) #historyLatest{display:none}
    #overallReturnPanel[data-mode=value]:has(.inspectable-chart) :is(#overallReturnLabel,#overallReturnHero,#overallReturnSub){display:none}
    @media(max-width:560px){.chart-inspector-values strong{font-size:18px}.chart-inspector-values small,.chart-inspector-note{font-size:9px}.chart-inspector-date{font-size:11px}.chart-inspector-hint{font-size:9px}.chart-inspector-values{gap:10px}.chart-flow-row{font-size:10px}.chart-cash-totals{font-size:10px;gap:10px}}
  `;document.head.appendChild(style);
  function clear(element){
    if(!element)return;
    bindings.get(element)?.abort();bindings.delete(element);element.classList.remove('inspectable-chart');
    element.querySelectorAll('.chart-inspector-readout,.chart-inspector-hint,.chart-cash-flows,.chart-cursor,.chart-flow-markers').forEach(n=>n.remove());
  }
  function attach(options){
    const {element,series,kind='nav',portfolioId=null,accountIds=[],currency,start,end,x,y,left,right,top,bottom}=options;
    clear(element);const svg=element?.querySelector('svg');if(!svg||!series?.length)return;
    const controller=new AbortController(),signal=controller.signal;bindings.set(element,controller);element.classList.add('inspectable-chart');
    const navSeries=options.navSeries||series,navByDate=new Map(navSeries.map(p=>[p.date,p])),seriesByDate=new Map(series.map((p,i)=>[p.date,{p,i}]));
    const first=series[0].date,last=series.at(-1).date,errors=[];
    let rows=[];
    for(const id of accountIds){const r=root.PortfolioYtdAnchor?.flowRecords(id,start,end);if(r){rows.push(...r.rows);errors.push(...r.errors);}}
    const rates=state.settings.fx||{};
    rows=classifyTransfers(rows,accountIds).map(r=>({...r,displayAmount:Object.hasOwn(rates,r.currency)&&Object.hasOwn(rates,currency)&&Number(fxToHKD(r.currency))>0&&Number(fxToHKD(currency))>0?convert(r.amount,r.currency,currency):NaN})).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
    if(rows.some(r=>!Number.isFinite(r.displayAmount)))errors.push('Some flows have no available display-currency FX rate; their original amounts are retained.');
    const byDate=new Map();for(const r of rows){if(!byDate.has(r.date))byDate.set(r.date,[]);byDate.get(r.date).push(r);}
    const readout=document.createElement('div');readout.className='chart-inspector-readout';readout.setAttribute('aria-live','off');element.prepend(readout);
    const hint=document.createElement('div');hint.className='chart-inspector-hint';hint.innerHTML='<i></i> Drag / hover to inspect · arrow keys move by recorded date · blue dots mark cash-flow dates';svg.after(hint);
    const cursor=document.createElementNS(ns,'g');cursor.classList.add('chart-cursor');cursor.setAttribute('pointer-events','none');
    const line=document.createElementNS(ns,'line');line.classList.add('chart-cursor-line');line.setAttribute('y1',top);line.setAttribute('y2',bottom);
    const dot=document.createElementNS(ns,'circle');dot.classList.add('chart-cursor-dot');dot.setAttribute('r','4.5');cursor.append(line,dot);svg.appendChild(cursor);
    const tooltip=document.createElementNS(ns,'g');tooltip.classList.add('chart-inspector-tooltip');tooltip.setAttribute('aria-hidden','true');tooltip.setAttribute('pointer-events','none');cursor.appendChild(tooltip);
    const tooltipBox=document.createElementNS(ns,'rect');tooltipBox.setAttribute('width','320');tooltipBox.setAttribute('height','116');tooltipBox.setAttribute('rx','10');tooltip.appendChild(tooltipBox);
    const tooltipLines=Array.from({length:4},(_,i)=>{const text=document.createElementNS(ns,'text');text.setAttribute('x','14');text.setAttribute('y',String(25+i*26));tooltip.appendChild(text);return text;});
    if(!portfolioId)tooltipLines[1].setAttribute('data-inspector-nav-label','');
    const markers=document.createElementNS(ns,'g');markers.classList.add('chart-flow-markers');svg.appendChild(markers);
    for(const [date,flows] of byDate)if(date>=first&&date<=last){
      const marker=document.createElementNS(ns,'g');marker.classList.add('chart-flow-marker');marker.dataset.flowDate=date;
      const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',x(date));circle.setAttribute('cy',bottom-2);circle.setAttribute('r','6');circle.setAttribute('fill','#5ea9f6');
      const title=document.createElementNS(ns,'title');title.textContent=date+' · '+flows.map(f=>(f.internal?'Internal transfer ':f.amount>=0?'Deposit ':'Withdrawal ')+money(Math.abs(f.amount),f.currency)).join(' · ');
      marker.append(circle,title);markers.appendChild(marker);
    }
    const details=document.createElement('details');details.className='chart-cash-flows summary-disclosure';
    const t=totals(rows),ins=rows.filter(r=>r.amount>0&&!r.internal).length,outs=rows.filter(r=>r.amount<0&&!r.internal).length;
    details.innerHTML=`<summary>Cash flows · ${ins} deposits · ${outs} withdrawals${t.internal?' · internal transfers':''}</summary><div class="chart-cash-totals"><span>In<strong>${t.deposits==null?'—':escape(money(t.deposits,currency))}</strong></span><span>Out<strong>${t.withdrawals==null?'—':escape(money(t.withdrawals,currency))}</strong></span></div><div class="chart-flow-source">${escape(start)} → ${escape(end)}. Enabled portfolios use their reviewed performance flow list plus later automatic flows. Earlier initialization deposits are excluded. Matched transfers within this chart’s portfolios are excluded from the In / Out totals.</div><div class="chart-flow-list"></div>${errors.length?'<div class="chart-cash-errors">Some flow settings need attention. '+escape([...new Set(errors)].join(' '))+'</div>':''}`;
    const list=details.querySelector('.chart-flow-list');
    if(!rows.length)list.innerHTML='<div class="chart-flow-empty">No dated deposits or withdrawals in this range.</div>';
    for(const r of rows){
      const row=document.createElement('button');row.type='button';row.className='chart-flow-row';row.dataset.flowDate=r.date;
      row.innerHTML=`<span>${escape(r.date)} · ${r.internal?'Internal transfer':r.amount>=0?'Deposit':'Withdrawal'}<small>${escape(r.accountName)} · ${escape(r.source)}${r.unmatched?' · transfer not matched':''}${r.date<first||r.date>last?' · outside available NAV history':''}</small></span><span><strong>${escape(signedMoney(r.amount,r.currency))}</strong>${r.currency!==currency?`<small>${Number.isFinite(r.displayAmount)?escape(signedMoney(r.displayAmount,currency)):'FX unavailable'}</small>`:''}</span>`;list.appendChild(row);
    }
    element.appendChild(details);
    let selected=last,index=series.length-1,dragging=false;const cache=new Map();
    function choose(date,show=true){
      selected=date;const exact=seriesByDate.get(date),nav=navByDate.get(date),dayFlows=byDate.get(date)||[];index=nearestIndex(series,date);
      let r=null;
      if(nav){
        if(cache.has(date))r=cache.get(date);
        else{r=portfolioId?root.PortfolioYtdAnchor?.resultAt(portfolioId,date,nav.value,currency):root.PortfolioYtdAnchor?.overallAt(date,nav.accountValues,currency);cache.set(date,r);}
      }
      const rate=r?.ok&&r.returnPct!=null?pct(r.returnPct):'—',scope=r?.selectedCount&&r.selectedCount!==r.activeCount?`${r.selectedCount}/${r.activeCount} portfolios · `:'';
      const historical=portfolioId?root.PortfolioPerformanceHistory?.point(portfolioId,date):null;
      const historyNote=historical?(historical.quality==='statement'?'Statement NAV':'Reconstructed NAV estimate')+' · '+historical.source:'';
      const rateNote=r?.ok?scope+(r.historicalEstimate?'Modified Dietz estimate · ':'')+signedMoney(r.profit,r.currency):!nav?'No recorded NAV on this date':r?'YTD unavailable on this date':'Optional YTD not enabled';
      readout.innerHTML=`<div class="chart-inspector-top"><span class="chart-inspector-date">${escape(date)}${date===last?' · latest point':''}</span><button type="button" class="chart-inspector-latest">Latest</button></div><div class="chart-inspector-values"><div><span>Selected NAV · ${escape(currency)}</span><strong ${!portfolioId?'data-inspector-nav':''}>${nav?escape(money(nav.value,currency)):'—'}</strong><small>${kind==='return'&&exact?'Selected period return '+pct(exact.p.value):'Estimated historical net assets'}</small></div><div><span>YTD · ${escape(date.slice(0,4))}</span><strong class="${r?.ok&&r.returnPct!=null?r.returnPct<0?'negative':'positive':''}">${escape(rate)}</strong><small>${escape(rateNote)}</small></div></div><div class="chart-inspector-day-flows">${dayFlows.length?dayFlows.map(f=>`<div class="chart-inspector-day-flow"><span>${escape(f.accountName)} · ${f.internal?'Internal transfer':f.amount>=0?'Deposit':'Withdrawal'}</span><strong>${escape(signedMoney(f.amount,f.currency))}</strong></div>`).join(''):'<span style="color:var(--muted);font-size:10px">No external cash flow recorded on this date.</span>'}</div><div class="chart-inspector-note">${historyNote?escape(historyNote)+'. ':''}${!nav?'This date has no reconstructed NAV; cash-flow amounts remain available. ':''}${r&&!r.ok?escape(r.errors?.join(' ')||'')+' ':''}History uses saved/current FX; historical option values may be approximate. Values are estimates, not brokerage daily statements.</div>`;
      cursor.style.display=show&&date>=first&&date<=last?'':'none';line.setAttribute('x1',x(date));line.setAttribute('x2',x(date));
      dot.style.display=exact?'':'none';if(exact){dot.setAttribute('cx',x(date));dot.setAttribute('cy',y(exact.p.value));}
      const navText=nav?money(nav.value,currency):'—';
      tooltip.setAttribute('transform',`translate(${x(date)<(left+right)/2?right-328:left+8},${top+6})`);
      const tip=[date,'NAV '+navText,'YTD '+rate,dayFlows.length===1?(dayFlows[0].internal?'Transfer ':dayFlows[0].amount>=0?'In ':'Out ')+money(Math.abs(dayFlows[0].amount),dayFlows[0].currency):dayFlows.length?dayFlows.length+' cash flows · see list':'No cash flow'];
      tip.forEach((value,i)=>{tooltipLines[i].textContent=value;});
      svg.setAttribute('aria-valuenow',String(index));svg.setAttribute('aria-valuetext',date);
      if(!portfolioId)root.PortfolioNetAssetPrivacy?.apply();
    }
    function fromPointer(event){
      const flow=event.target.closest?.('[data-flow-date]');if(flow){choose(flow.dataset.flowDate);return;}
      const matrix=svg.getScreenCTM();if(!matrix)return;
      const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(matrix.inverse());
      const ratio=Math.max(0,Math.min(1,(local.x-left)/(right-left))),time=Date.parse(first)+(Date.parse(last)-Date.parse(first))*ratio;
      const i=nearestIndex(series,time);if(i>=0&&(series[i].date!==selected||cursor.style.display==='none'))choose(series[i].date);
    }
    svg.setAttribute('tabindex','0');svg.setAttribute('role','slider');svg.setAttribute('aria-label','Explore historical NAV and YTD by date');svg.setAttribute('aria-orientation','horizontal');svg.setAttribute('aria-valuemin','0');svg.setAttribute('aria-valuemax',String(series.length-1));
    svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;svg.setPointerCapture(e.pointerId);fromPointer(e);},{signal});
    svg.addEventListener('pointermove',e=>{if(dragging||e.pointerType==='mouse')fromPointer(e);},{signal});
    const stop=e=>{dragging=false;if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);};svg.addEventListener('pointerup',stop,{signal});svg.addEventListener('pointercancel',stop,{signal});
    svg.addEventListener('keydown',e=>{let next=index;if(e.key==='ArrowLeft')next--;else if(e.key==='ArrowRight')next++;else if(e.key==='Home')next=0;else if(e.key==='End')next=series.length-1;else if(e.key==='Escape'){choose(last,false);return;}else return;e.preventDefault();choose(series[Math.max(0,Math.min(series.length-1,next))].date);},{signal});
    list.addEventListener('click',e=>{const row=e.target.closest('[data-flow-date]');if(row){choose(row.dataset.flowDate);readout.scrollIntoView({block:'nearest',behavior:'instant'});}},{signal});
    readout.addEventListener('click',e=>{if(e.target.closest('.chart-inspector-latest'))choose(last,false);},{signal});
    choose(last,false);
  }
  root.PortfolioChartInspector={attach,clear};
})(typeof window==='undefined'?globalThis:window);
