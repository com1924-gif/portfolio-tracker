(()=>{
  if(window.__portfolioDeleteGuardInstalledV28)return;
  window.__portfolioDeleteGuardInstalledV28=true;

  const EPS=1e-9;
  const originalDeleteTransaction=window.deleteTransaction;
  if(!originalDeleteTransaction)return;

  function validateAfterDelete(assetId,deleteId){
    const rows=[];
    state.transactions.forEach((t,index)=>{
      if(t.id===deleteId||t.assetId!==assetId||!['Buy','Sell'].includes(t.type))return;
      rows.push({t,index});
    });
    rows.sort((a,b)=>(a.t.date||'').localeCompare(b.t.date||'')||a.index-b.index);
    let qty=0;
    for(const {t} of rows){
      const q=Number(t.qty)||0;
      if(t.type==='Buy')qty+=q;
      else if(t.type==='Sell'){
        if(q>qty+EPS)return {ok:false,available:Math.max(0,qty),date:t.date||''};
        qty-=q;
        if(Math.abs(qty)<EPS)qty=0;
      }
    }
    return {ok:true};
  }

  function availableText(asset,qty){
    if(asset?.type==='option')return `${qty} contract${qty===1?'':'s'}`;
    const lot=Number(asset?.lotSize)||0;
    if(asset?.currency==='HKD'&&lot>0){
      const lots=qty/lot;
      return `${qty} shares (${Number.isInteger(lots)?lots:lots.toFixed(2)} lots)`;
    }
    return `${qty} shares`;
  }

  window.deleteTransaction=id=>{
    const t=state.transactions.find(x=>x.id===id);
    if(t?.assetId&&['Buy','Sell'].includes(t.type)){
      const asset=state.assets.find(a=>a.id===t.assetId);
      const check=validateAfterDelete(t.assetId,id);
      if(!check.ok){
        toast(`Cannot delete this ${t.type}. It would oversell ${asset?.symbol||'the holding'} on ${check.date}. Available: ${availableText(asset,check.available)}.`,true);
        return;
      }
    }
    return originalDeleteTransaction(id);
  };
})();
