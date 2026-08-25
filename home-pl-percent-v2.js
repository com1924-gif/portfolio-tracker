(()=>{
  if(window.__portfolioHomePLPercentInstalledV2223)return;
  window.__portfolioHomePLPercentInstalledV2223=true;

  function signedPct(value){
    const n=Number(value);
    if(!Number.isFinite(n))return '—';
    const sign=n>0?'+':'';
    return `${sign}${n.toFixed(2)}%`;
  }

  function decorateHomePLPercent(){
    if(typeof capitalSummary!=='function')return;
    const s=capitalSummary();

    const lifetime=document.getElementById('homeTotalPL');
    if(lifetime&&s.capitalComplete&&Number.isFinite(Number(s.lifetimePL))&&Math.abs(Number(s.netContributions))>1e-9){
      const lifetimePct=Number(s.lifetimePL)/Math.abs(Number(s.netContributions))*100;
      lifetime.textContent=`${signedMoney(s.lifetimePL)} (${signedPct(lifetimePct)})`;
      lifetime.className=Number(s.lifetimePL)<0?'negative':'positive';
    }

    const holdings=(s.hs||[]).filter(h=>h.type==='stock');
    const eligible=holdings.filter(h=>
      Number.isFinite(Number(h.price))&&
      Number.isFinite(Number(h.previousClose))&&
      Number(h.previousClose)>0
    );
    if(!eligible.length)return;

    const today=eligible.reduce((sum,h)=>{
      const local=(Number(h.qty)||0)*(Number(h.price)-Number(h.previousClose))*multiplier(h);
      return sum+convert(local,h.currency);
    },0);
    const previousValue=eligible.reduce((sum,h)=>{
      const local=(Number(h.qty)||0)*Number(h.previousClose)*multiplier(h);
      return sum+convert(local,h.currency);
    },0);

    const todayEl=document.getElementById('homeTodayPL');
    if(todayEl&&Math.abs(previousValue)>1e-9){
      const todayPct=today/Math.abs(previousValue)*100;
      todayEl.textContent=`${signedMoney(today)} (${signedPct(todayPct)})`;
      todayEl.className=today<0?'negative':'positive';
    }
  }

  const originalRenderHome=window.renderHome;
  if(typeof originalRenderHome==='function'){
    window.renderHome=renderHome=function(){
      originalRenderHome();
      decorateHomePLPercent();
    };
  }

  decorateHomePLPercent();
})();
