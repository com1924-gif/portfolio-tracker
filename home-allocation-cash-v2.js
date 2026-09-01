(()=>{
  if(window.__portfolioHomeAllocationCashInstalledV233)return;
  window.__portfolioHomeAllocationCashInstalledV233=true;

  let cashSelected=false;

  function groupKey(h){
    return h.type==='option'?`option:${h.symbol}`:`stock:${normalizeTicker(h.symbol)}`;
  }

  function groupedHoldings(){
    const map=new Map();
    (holdingsFor()||[]).forEach(h=>{
      const key=groupKey(h);
      const row=map.get(key)||{key,symbol:h.symbol,marketValue:0};
      row.marketValue+=convert(Number(h.marketValue)||0,h.currency);
      map.set(key,row);
    });
    return [...map.values()].sort((a,b)=>b.marketValue-a.marketValue);
  }

  function cashPercent(summary){
    return summary.net?Number(summary.cash)/Number(summary.net)*100:0;
  }

  function holdingPercent(value,summary){
    return summary.net?Number(value)/Number(summary.net)*100:0;
  }

  function renderCashDetail(summary){
    const detail=document.getElementById('homeAllocationDetail');
    if(!detail)return;
    const balances=summary.cashBal||cashBalancesFor();
    const pctValue=cashPercent(summary);
    const label=summary.cash<0?'Margin':'Cash';
    const cls=summary.cash<0?'negative':'positive';
    const rows=['HKD','USD','KRW'].map(currency=>{
      const value=Number(balances[currency])||0;
      return `<div class="home-holding-detail-cell">
        <span class="home-holding-detail-label">${currency} Balance</span>
        <strong class="home-holding-detail-value ${value<0?'negative':''}">${money(value,currency)}</strong>
      </div>`;
    }).join('');

    detail.innerHTML=`
      <div class="home-holding-hero">
        <div class="home-holding-hero-top">
          <div>
            <div class="home-holding-name">${label}</div>
            <div class="home-holding-symbol">Cash balances across all portfolios</div>
          </div>
          <div class="home-holding-change ${cls}">${pctValue>=0?'+':''}${pctValue.toFixed(1)}%</div>
        </div>
        <div class="home-holding-price ${summary.cash<0?'negative':''}">${money(summary.cash)}</div>
      </div>
      <div class="home-holding-detail-grid">
        ${rows}
        <div class="home-holding-detail-cell right">
          <span class="home-holding-detail-label">Allocation</span>
          <strong class="home-holding-detail-value ${summary.cash<0?'negative':''}">${pctValue.toFixed(1)}%</strong>
          <span class="home-holding-detail-sub">of Total Net Assets</span>
        </div>
      </div>`;
  }

  function applyCashAllocation(){
    const list=document.getElementById('homeAllocationList');
    const donut=document.getElementById('homeDonut');
    const center=document.getElementById('homeDonutText');
    if(!list||!donut||!center||typeof summaryFor!=='function')return;

    const summary=summaryFor();
    const groups=groupedHoldings();
    const bySymbol=new Map(groups.map(g=>[g.symbol,g]));
    const holdingRows=[...list.querySelectorAll('.home-allocation-row')].filter(row=>!row.dataset.cashAllocation);

    holdingRows.forEach(row=>{
      const symbol=row.querySelector('.allocation-name')?.textContent?.trim();
      const group=bySymbol.get(symbol);
      const pctEl=row.querySelector('.allocation-pct');
      if(group&&pctEl)pctEl.textContent=`${holdingPercent(group.marketValue,summary).toFixed(1)}%`;
    });

    list.querySelector('[data-cash-allocation]')?.remove();
    const cashRow=document.createElement('button');
    cashRow.type='button';
    cashRow.className=`home-allocation-row${cashSelected?' active':''}`;
    cashRow.dataset.cashAllocation='1';
    const cashPct=cashPercent(summary);
    cashRow.innerHTML=`<span class="allocation-dot" style="background:var(--muted)"></span><span class="allocation-name">${summary.cash<0?'Margin':'Cash'}</span><span class="allocation-pct ${summary.cash<0?'negative':''}">${cashPct.toFixed(1)}%</span>`;
    list.appendChild(cashRow);

    if(summary.cash>=0&&summary.net>0){
      let cursor=0;
      const stops=[];
      groups.forEach((group,i)=>{
        const weight=Math.max(0,group.marketValue)/summary.net*100;
        stops.push(`${palette[i%palette.length]} ${cursor}% ${cursor+weight}%`);
        cursor+=weight;
      });
      const cashWeight=Math.max(0,summary.cash)/summary.net*100;
      if(cashWeight>0)stops.push(`var(--muted) ${cursor}% ${Math.min(100,cursor+cashWeight)}%`);
      if(stops.length)donut.style.background=`conic-gradient(${stops.join(',')})`;
    }

    cashRow.addEventListener('click',()=>{
      cashSelected=true;
      list.querySelectorAll('.home-allocation-row').forEach(row=>row.classList.toggle('active',row===cashRow));
      center.textContent=`${Math.abs(cashPct)>=10?cashPct.toFixed(0):cashPct.toFixed(1)}%`;
      renderCashDetail(summaryFor());
    });

    holdingRows.forEach(row=>row.addEventListener('click',()=>{
      cashSelected=false;
      setTimeout(()=>{
        const latest=summaryFor();
        const symbol=row.querySelector('.allocation-name')?.textContent?.trim();
        const group=groupedHoldings().find(g=>g.symbol===symbol);
        if(group)center.textContent=`${holdingPercent(group.marketValue,latest).toFixed(holdingPercent(group.marketValue,latest)>=10?0:1)}%`;
      },0);
    }));

    if(cashSelected){
      list.querySelectorAll('.home-allocation-row').forEach(row=>row.classList.toggle('active',row===cashRow));
      center.textContent=`${Math.abs(cashPct)>=10?cashPct.toFixed(0):cashPct.toFixed(1)}%`;
      renderCashDetail(summary);
    }else{
      const active=list.querySelector('.home-allocation-row.active:not([data-cash-allocation])');
      const symbol=active?.querySelector('.allocation-name')?.textContent?.trim();
      const group=groups.find(g=>g.symbol===symbol);
      if(group){
        const p=holdingPercent(group.marketValue,summary);
        center.textContent=`${p.toFixed(p>=10?0:1)}%`;
      }
    }
  }

  const originalRenderHome=window.renderHome;
  if(typeof originalRenderHome==='function'){
    window.renderHome=renderHome=function(){
      originalRenderHome();
      setTimeout(applyCashAllocation,0);
    };
  }

  document.getElementById('homeCurrency')?.addEventListener('change',()=>setTimeout(applyCashAllocation,0));
  setTimeout(applyCashAllocation,0);
})();
