/* Read-only overview helpers. No transaction, cash or cost-basis mutations. */
(function(root){
  'use strict';
  function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
  function coverage(start,asOf,records){
    const firstDates=records.map(r=>r.firstDate).filter(d=>validDate(d)&&d<=asOf).sort();
    const limits=records.filter(r=>r.anchored&&Number(r.openingNav)>0&&validDate(r.firstDate)&&r.firstDate>`${asOf.slice(0,4)}-01-01`).map(r=>r.firstDate);
    const first=firstDates[0]||asOf,from=[start,first,...limits].sort().at(-1);
    return {from,asOf,limited:from>start,missingOpeningHistory:limits.some(d=>d>start)};
  }
  function currentEndpoint(series,asOf,current){
    const points=new Map();
    for(const p of series||[])if(validDate(p?.date)&&p.date<=asOf&&Number.isFinite(Number(p.value)))points.set(p.date,{date:p.date,value:Number(p.value)});
    if(Number.isFinite(Number(current)))points.set(asOf,{date:asOf,value:Number(current)});
    return [...points.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  function performance(values,flows){
    const first=values.findIndex(p=>Number(p.value)>0);if(first<0)return [];
    let index=1,prev=Number(values[first].value),prevDate=values[first].date;
    const out=[{date:prevDate,value:0}];
    for(const p of values.slice(first+1)){
      const cur=Number(p.value),flow=(flows||[]).filter(f=>f.date>prevDate&&f.date<=p.date).reduce((s,f)=>s+Number(f.amount||0),0);
      if(!(prev>0)||!Number.isFinite(cur)){prev=cur;prevDate=p.date;continue;}
      const r=(cur-flow-prev)/prev;
      if(Number.isFinite(r)&&r>-1){index*=1+r;out.push({date:p.date,value:(index-1)*100});}
      prev=cur;prevDate=p.date;
    }
    return out;
  }
  root.PortfolioOverviewModel={coverage,currentEndpoint,performance};
})(typeof window==='undefined'?globalThis:window);
