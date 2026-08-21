(()=>{
  if(window.__portfolioAllAllocationInstalledV2222)return;
  window.__portfolioAllAllocationInstalledV2222=true;

  const originalRenderAllocation=window.renderAllocation;
  if(typeof originalRenderAllocation!=='function')return;

  window.renderAllocation=renderAllocation=function(donutId,textId,listId,hs,net){
    if(listId!=='homeAllocationList')return originalRenderAllocation(donutId,textId,listId,hs,net);

    const rows=(hs||[]).slice().sort((a,b)=>convert(b.marketValue,b.currency)-convert(a.marketValue,a.currency));
    const total=rows.reduce((sum,h)=>sum+Math.max(0,convert(h.marketValue,h.currency)),0);
    let cursor=0;
    const stops=[];
    rows.forEach((h,i)=>{
      const weight=total?Math.max(0,convert(h.marketValue,h.currency))/total*100:0;
      stops.push(`${palette[i%palette.length]} ${cursor}% ${cursor+weight}%`);
      cursor+=weight;
    });

    const donut=$(donutId),text=$(textId),list=$(listId);
    if(donut)donut.style.background=stops.length?`conic-gradient(${stops.join(',')})`:'#333';
    if(text)text.textContent=net?`${Math.round(total/net*100)}%`:'0%';
    if(list){
      list.innerHTML=rows.length?rows.map((h,i)=>{
        const weight=total?convert(h.marketValue,h.currency)/total*100:0;
        return `<div class="allocation-row"><span class="allocation-dot" style="background:${palette[i%palette.length]}"></span><span class="allocation-name">${esc(h.symbol)}</span><span class="allocation-pct">${weight.toFixed(1)}%</span></div>`;
      }).join(''):'<div class="empty">No holdings yet.</div>';
    }
  };

  if(typeof renderHome==='function')renderHome();
})();
