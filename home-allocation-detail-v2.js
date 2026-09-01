(()=>{
  if(window.__portfolioHomeAllocationDetailInstalledV223)return;
  window.__portfolioHomeAllocationDetailInstalledV223=true;

  let selectedKey=null;
  const originalRenderAllocation=window.renderAllocation;
  const originalRenderHome=window.renderHome;

  const style=document.createElement('style');
  style.textContent=`
    #homeView .home-overview-hidden-section{display:none!important}
    #homeView .home-allocation-panel{padding:18px 16px 20px}
    #homeView .home-allocation-panel>.section-head{margin-bottom:14px}
    .home-allocation-master{display:grid;grid-template-columns:minmax(150px,42%) minmax(0,58%);gap:16px;align-items:start}
    .home-allocation-left{min-width:0;border-right:1px solid var(--line);padding-right:14px}
    .home-allocation-donut-wrap{display:flex;justify-content:center;padding:4px 0 12px}
    .home-allocation-left .donut{width:128px;height:128px}
    .home-allocation-left .donut:after{inset:28px}
    .home-allocation-left .donut-center{font-size:16px;font-weight:800}
    .home-allocation-list{display:grid;gap:2px;max-height:none}
    .home-allocation-row{width:100%;display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center;border:0;background:transparent;color:var(--text);padding:8px 7px;border-radius:8px;text-align:left;cursor:pointer}
    .home-allocation-row:hover,.home-allocation-row.active{background:rgba(255,255,255,.085)}
    .home-allocation-row .allocation-name{font-weight:700;font-size:13px}
    .home-allocation-row .allocation-pct{font-size:13px}
    .home-allocation-detail{min-width:0;padding-left:2px}
    .home-holding-hero{background:#0a0a0c;border:1px solid #050506;border-radius:14px;padding:14px;margin-bottom:14px}
    .home-holding-hero-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    .home-holding-name{font-size:15px;font-weight:800;line-height:1.3;overflow-wrap:anywhere}
    .home-holding-symbol{font-size:11px;color:var(--muted);margin-top:4px}
    .home-holding-price{font-size:15px;font-weight:800;margin-top:13px}
    .home-holding-change{flex:0 0 auto;min-width:64px;text-align:center;border-radius:10px;padding:9px 7px;font-size:13px;font-weight:900;background:#25252a;color:var(--muted)}
    .home-holding-change.positive{background:rgba(98,209,139,.92);color:#fff!important}
    .home-holding-change.negative{background:rgba(255,93,87,.95);color:#fff!important}
    .home-holding-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 12px}
    .home-holding-detail-cell{min-width:0}
    .home-holding-detail-cell.right{text-align:right}
    .home-holding-detail-label{display:block;color:var(--muted);font-size:11px;margin-bottom:4px}
    .home-holding-detail-value{display:block;font-size:14px;font-weight:750;overflow-wrap:anywhere}
    .home-holding-detail-sub{display:block;color:var(--muted);font-size:10px;margin-top:3px;line-height:1.3}
    .home-holding-accounts{border-top:1px solid var(--line);margin-top:14px;padding-top:11px;color:var(--muted);font-size:11px;line-height:1.45}
    @media(max-width:520px){
      #homeView .home-allocation-panel{padding:15px 10px 18px}
      .home-allocation-master{grid-template-columns:minmax(120px,40%) minmax(0,60%);gap:10px}
      .home-allocation-left{padding-right:8px}
      .home-allocation-left .donut{width:106px;height:106px}
      .home-allocation-left .donut:after{inset:23px}
      .home-allocation-row{padding:7px 5px;gap:6px}
      .home-allocation-row .allocation-name,.home-allocation-row .allocation-pct{font-size:12px}
      .home-holding-hero{padding:11px}
      .home-holding-name{font-size:13px}
      .home-holding-price{font-size:13px}
      .home-holding-change{min-width:56px;padding:8px 5px;font-size:12px}
      .home-holding-detail-grid{gap:12px 8px}
      .home-holding-detail-value{font-size:12px}
      .home-holding-detail-label{font-size:10px}
    }
  `;
  document.head.appendChild(style);

  function keyFor(h){
    return h.type==='option'?`option:${h.symbol}`:`stock:${normalizeTicker(h.symbol)}`;
  }

  function aggregateHoldings(hs){
    const map=new Map();
    (hs||[]).forEach(h=>{
      const key=keyFor(h);
      let row=map.get(key);
      if(!row){
        row={
          key,type:h.type,symbol:h.symbol,name:h.name||h.symbol,currency:h.currency,
          qty:0,costDisplay:0,marketValueDisplay:0,unrealizedDisplay:0,realizedDisplay:0,totalPLDisplay:0,totalBuyCostDisplay:0,
          priceNumerator:0,previousCloseNumerator:0,previousCloseUnits:0,units:0,todayPLDisplay:0,previousValueDisplay:0,
          assetIds:new Set(),accountIds:new Set(),multiplier:multiplier(h)
        };
        map.set(key,row);
      }
      const mult=multiplier(h);
      const qty=Number(h.qty)||0;
      const units=qty*mult;
      row.qty+=qty;
      row.units+=units;
      row.priceNumerator+=units*(Number(h.price)||0);
      row.costDisplay+=convert(Number(h.cost)||0,h.currency);
      row.marketValueDisplay+=convert(Number(h.marketValue)||0,h.currency);
      row.unrealizedDisplay+=convert(Number(h.unrealized)||0,h.currency);
      row.realizedDisplay+=convert(Number(h.realized)||0,h.currency);
      row.totalPLDisplay+=convert(Number(h.totalPL)||0,h.currency);
      row.totalBuyCostDisplay+=convert(Number.isFinite(Number(h.totalBuyCost))?Number(h.totalBuyCost):(Number(h.cost)||0),h.currency);
      row.assetIds.add(h.id);
      row.accountIds.add(h.accountId);
      const prev=Number(h.previousClose);
      if(h.type==='stock'&&Number.isFinite(prev)&&prev>0){
        row.previousCloseNumerator+=units*prev;
        row.previousCloseUnits+=units;
        const localToday=units*((Number(h.price)||0)-prev);
        const localPrev=units*prev;
        row.todayPLDisplay+=convert(localToday,h.currency);
        row.previousValueDisplay+=convert(localPrev,h.currency);
      }
    });

    const totalMarket=[...map.values()].reduce((sum,r)=>sum+Math.max(0,r.marketValueDisplay),0);
    return [...map.values()].map(r=>{
      r.price=r.units?r.priceNumerator/r.units:0;
      r.previousClose=r.previousCloseUnits?r.previousCloseNumerator/r.previousCloseUnits:null;
      r.avgCostDisplay=r.units?r.costDisplay/r.units:0;
      r.weight=totalMarket?r.marketValueDisplay/totalMarket*100:0;
      r.todayPct=r.previousValueDisplay?r.todayPLDisplay/Math.abs(r.previousValueDisplay)*100:null;
      r.openReturnPct=r.costDisplay?r.unrealizedDisplay/Math.abs(r.costDisplay)*100:null;
      r.totalReturnPct=r.totalBuyCostDisplay?r.totalPLDisplay/Math.abs(r.totalBuyCostDisplay)*100:null;
      r.dividendDisplay=state.transactions.filter(t=>r.assetIds.has(t.assetId)&&t.type==='Dividend').reduce((sum,t)=>{
        const amount=t.amount!=null?Number(t.amount)||0:(Number(t.qty)||0)*(Number(t.price)||0);
        return sum+convert(amount,t.currency||r.currency);
      },0);
      r.accountNames=[...r.accountIds].map(id=>state.accounts.find(a=>a.id===id)?.name).filter(Boolean);
      return r;
    }).sort((a,b)=>b.marketValueDisplay-a.marketValueDisplay);
  }

  function ensureHomeLayout(){
    const home=document.getElementById('homeView');
    if(!home)return null;

    const portfolioPanel=document.getElementById('portfolioCards')?.closest('.panel');
    if(portfolioPanel)portfolioPanel.classList.add('home-overview-hidden-section');
    const topHoldingsPanel=document.getElementById('homeHoldings')?.closest('.panel');
    if(topHoldingsPanel)topHoldingsPanel.classList.add('home-overview-hidden-section');

    const list=document.getElementById('homeAllocationList');
    const panel=list?.closest('.panel');
    if(!panel)return null;
    panel.classList.add('home-allocation-panel');
    const title=panel.querySelector('.section-head h2');
    const hint=panel.querySelector('.section-head .muted');
    if(title)title.textContent='Allocation';
    if(hint)hint.textContent='Tap a holding to view details';

    let master=panel.querySelector('.home-allocation-master');
    if(!master){
      const oldLayout=panel.querySelector('.allocation-layout');
      if(!oldLayout)return null;
      oldLayout.className='home-allocation-master';
      oldLayout.innerHTML=`
        <div class="home-allocation-left">
          <div class="home-allocation-donut-wrap"><div id="homeDonut" class="donut"><div id="homeDonutText" class="donut-center">0%</div></div></div>
          <div id="homeAllocationList" class="home-allocation-list"></div>
        </div>
        <div id="homeAllocationDetail" class="home-allocation-detail"></div>`;
      master=oldLayout;
    }
    return master;
  }

  function detailMoney(value){return money(value);}
  function signedPctOrDash(value){return value==null||!Number.isFinite(Number(value))?'—':pct(Number(value));}
  function detailClass(value){return Number(value)<0?'negative':'positive';}

  function renderDetail(group){
    const detail=document.getElementById('homeAllocationDetail');
    if(!detail)return;
    if(!group){detail.innerHTML='<div class="empty">No holdings yet.</div>';return;}

    const dayClass=group.todayPct==null?'':detailClass(group.todayPct);
    const quantityLabel=group.type==='option'?'Contracts':'Shares';
    const avgCostNative=group.units?group.costDisplay/group.units:0;
    const accounts=group.accountNames.length?group.accountNames.join(' · '):'—';

    detail.innerHTML=`
      <div class="home-holding-hero">
        <div class="home-holding-hero-top">
          <div>
            <div class="home-holding-name">${esc(group.name||group.symbol)}</div>
            <div class="home-holding-symbol">${esc(group.symbol)}</div>
          </div>
          <div class="home-holding-change ${dayClass}">${signedPctOrDash(group.todayPct)}</div>
        </div>
        <div class="home-holding-price">${money(group.price,group.currency)}</div>
      </div>
      <div class="home-holding-detail-grid">
        <div class="home-holding-detail-cell">
          <span class="home-holding-detail-label">Market Value</span>
          <strong class="home-holding-detail-value">${detailMoney(group.marketValueDisplay)}</strong>
        </div>
        <div class="home-holding-detail-cell right">
          <span class="home-holding-detail-label">${quantityLabel}</span>
          <strong class="home-holding-detail-value">${Number(group.qty).toLocaleString('en-HK',{maximumFractionDigits:4})}</strong>
        </div>
        <div class="home-holding-detail-cell">
          <span class="home-holding-detail-label">Today P/L</span>
          <strong class="home-holding-detail-value ${group.todayPct==null?'':detailClass(group.todayPLDisplay)}">${group.todayPct==null?'—':signedMoney(group.todayPLDisplay)}</strong>
          <span class="home-holding-detail-sub">${signedPctOrDash(group.todayPct)}</span>
        </div>
        <div class="home-holding-detail-cell right">
          <span class="home-holding-detail-label">Weight</span>
          <strong class="home-holding-detail-value">${group.weight.toFixed(1)}%</strong>
          <span class="home-holding-detail-sub">of invested assets</span>
        </div>
        <div class="home-holding-detail-cell">
          <span class="home-holding-detail-label">Total Tracked P/L</span>
          <strong class="home-holding-detail-value ${detailClass(group.totalPLDisplay)}">${signedMoney(group.totalPLDisplay)}</strong>
          <span class="home-holding-detail-sub">${signedPctOrDash(group.totalReturnPct)}</span>
        </div>
        <div class="home-holding-detail-cell right">
          <span class="home-holding-detail-label">Open P/L</span>
          <strong class="home-holding-detail-value ${detailClass(group.unrealizedDisplay)}">${signedMoney(group.unrealizedDisplay)}</strong>
          <span class="home-holding-detail-sub">${signedPctOrDash(group.openReturnPct)}</span>
        </div>
        <div class="home-holding-detail-cell">
          <span class="home-holding-detail-label">Realized P/L</span>
          <strong class="home-holding-detail-value ${detailClass(group.realizedDisplay)}">${signedMoney(group.realizedDisplay)}</strong>
        </div>
        <div class="home-holding-detail-cell right">
          <span class="home-holding-detail-label">Average Cost</span>
          <strong class="home-holding-detail-value">${detailMoney(avgCostNative)}</strong>
          <span class="home-holding-detail-sub">display currency</span>
        </div>
        <div class="home-holding-detail-cell">
          <span class="home-holding-detail-label">Dividends</span>
          <strong class="home-holding-detail-value">${detailMoney(group.dividendDisplay)}</strong>
        </div>
        <div class="home-holding-detail-cell right">
          <span class="home-holding-detail-label">Current Price</span>
          <strong class="home-holding-detail-value">${money(group.price,group.currency)}</strong>
        </div>
      </div>
      <div class="home-holding-accounts"><strong>Portfolios:</strong> ${esc(accounts)}</div>`;
  }

  function paintHomeAllocation(hs,net){
    ensureHomeLayout();
    const groups=aggregateHoldings(hs);
    if(!groups.length){
      const donut=document.getElementById('homeDonut');
      const text=document.getElementById('homeDonutText');
      const list=document.getElementById('homeAllocationList');
      if(donut)donut.style.background='#333';
      if(text)text.textContent='0%';
      if(list)list.innerHTML='<div class="empty">No holdings yet.</div>';
      renderDetail(null);
      return;
    }

    if(!selectedKey||!groups.some(g=>g.key===selectedKey))selectedKey=groups[0].key;
    const selected=groups.find(g=>g.key===selectedKey)||groups[0];
    const total=groups.reduce((sum,g)=>sum+Math.max(0,g.marketValueDisplay),0);
    let cursor=0;
    const stops=[];
    groups.forEach((g,i)=>{
      const weight=total?Math.max(0,g.marketValueDisplay)/total*100:0;
      stops.push(`${palette[i%palette.length]} ${cursor}% ${cursor+weight}%`);
      cursor+=weight;
    });

    const donut=document.getElementById('homeDonut');
    const text=document.getElementById('homeDonutText');
    const list=document.getElementById('homeAllocationList');
    if(donut)donut.style.background=`conic-gradient(${stops.join(',')})`;
    if(text)text.textContent=`${selected.weight.toFixed(selected.weight>=10?0:1)}%`;
    if(list){
      list.innerHTML=groups.map((g,i)=>`<button type="button" class="home-allocation-row ${g.key===selected.key?'active':''}" data-allocation-index="${i}">
        <span class="allocation-dot" style="background:${palette[i%palette.length]}"></span>
        <span class="allocation-name">${esc(g.symbol)}</span>
        <span class="allocation-pct">${g.weight.toFixed(1)}%</span>
      </button>`).join('');
      list.querySelectorAll('[data-allocation-index]').forEach(btn=>btn.addEventListener('click',()=>{
        const g=groups[Number(btn.dataset.allocationIndex)];
        if(!g)return;
        selectedKey=g.key;
        list.querySelectorAll('.home-allocation-row').forEach(row=>row.classList.toggle('active',row===btn));
        if(text)text.textContent=`${g.weight.toFixed(g.weight>=10?0:1)}%`;
        renderDetail(g);
      }));
    }
    renderDetail(selected);
  }

  if(typeof originalRenderAllocation==='function'){
    window.renderAllocation=renderAllocation=function(donutId,textId,listId,hs,net){
      if(listId==='homeAllocationList')return paintHomeAllocation(hs,net);
      return originalRenderAllocation(donutId,textId,listId,hs,net);
    };
  }

  function applyHomeOverview(){
    ensureHomeLayout();
    const s=typeof summaryFor==='function'?summaryFor():null;
    if(s)paintHomeAllocation(s.hs,s.net);
  }

  if(typeof originalRenderHome==='function'){
    window.renderHome=renderHome=function(){
      originalRenderHome();
      applyHomeOverview();
    };
  }

  applyHomeOverview();
})();
