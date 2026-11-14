/* Summary presentation only. Uses existing accounting and optional YTD APIs. */
(()=>{
  'use strict';
  if(window.__summaryDesignV22522)return;
  window.__summaryDesignV22522=true;
  const style=document.createElement('style');
  style.id='summaryDesignStyles';
  style.textContent=`
    :root{--bg:#0b0e12;--panel:#141a21;--panel2:#10151b;--card:#11171e;--line:#28303a;--accent:#ffa04a;--accent2:#ed8226;--muted:#8e9aa9;--positive:#37c997;--negative:#f56c75;--chip:#19212b}
    body{font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
    .app-shell{max-width:920px}.app-header{background:rgba(11,14,18,.96);border-bottom:1px solid rgba(142,154,169,.08);gap:10px;padding:20px 20px 16px}
    .brand{font-size:10px;letter-spacing:.18em;font-weight:650}h1{font-size:26px;font-weight:650;letter-spacing:-.035em}h2{font-weight:650;font-size:17px}
    main{padding:0 18px}.chip-row{padding:18px 0;gap:8px}.chip{font-size:12px;border:1px solid var(--line);padding:10px 18px;border-radius:999px;font-weight:600}.chip.active{background:rgba(255,160,74,.1);border-color:#81572e;color:var(--accent)}
    .summary-card{background:linear-gradient(125deg,#18232f,#121b24 70%);border:1px solid #2b3845;border-radius:18px;padding:26px 26px 16px;margin:16px 0}
    #homeView>.summary-card{margin-top:0}.summary-card .label{font-size:12px;letter-spacing:.025em}.hero-number,#homeNetAssets{font-size:46px;font-weight:600;letter-spacing:-.035em;line-height:1.15;overflow-wrap:anywhere}
    .currency-select{background:#1b2632;border:1px solid #354352;border-radius:9px;font-size:12px;padding:8px 10px;color:#e6edf5}
    .summary-pulse{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px;padding-bottom:22px;border-bottom:1px solid #2b3845}
    .summary-pulse>div{min-width:0}.summary-pulse span{display:block;font-size:11px;color:#a3afbc;margin-bottom:7px}.summary-pulse strong{font-size:19px;font-weight:600;letter-spacing:-.02em;display:block;overflow-wrap:anywhere}.summary-pulse small{font-size:10px;color:var(--muted);display:block;margin-top:5px;line-height:1.5}
    .summary-pulse button{border:0;background:none;padding:0;color:inherit;text-align:left;font:inherit;cursor:pointer}.summary-pulse button:hover strong{text-decoration:underline;text-underline-offset:4px}
    .summary-balances{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:20px 0 14px}.summary-balances span{display:block;font-size:10px;color:var(--muted);margin-bottom:6px}.summary-balances strong{font-size:14px;font-weight:550;overflow-wrap:anywhere}
    .summary-disclosure{border-top:1px solid var(--line);padding-top:12px;margin-top:2px}.summary-disclosure>summary{color:var(--muted);font-size:11px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;padding:2px 0}.summary-disclosure>summary::-webkit-details-marker{display:none}.summary-disclosure>summary:after{content:'⌄';margin-left:auto;color:var(--accent);font-size:14px}.summary-disclosure[open]>summary:after{content:'⌃'}
    .summary-card .summary-grid{margin:18px 0;gap:18px}.summary-grid strong{font-size:14px;font-weight:550}.summary-grid span{font-size:11px}.invested-bar{display:none}
    .panel{border:1px solid #242d38;background:var(--panel);border-radius:16px;padding:20px;margin-bottom:16px}.section-head{margin-bottom:18px}
    #overallReturnPanel{margin-top:0;padding:0}.overall-return-head{display:flex;padding:0 20px;gap:24px}.overall-return-tab{font-size:13px;padding:18px 0 14px;font-weight:600}.overall-return-tab.active{color:var(--accent)}.overall-return-tab.active:after{left:0;right:0;background:var(--accent);height:3px}
    .overall-return-body{padding:20px}.overall-return-tools{margin-bottom:18px}.overall-return-updated{font-size:10px}.overall-return-refresh{font-size:11px;border:1px solid #354352;background:#202c38;color:#dae4ee;border-radius:8px;padding:7px 10px}
    .overall-return-label{font-size:11px;font-weight:500;letter-spacing:.02em}.overall-return-hero{font-size:36px;font-weight:600;letter-spacing:-.03em}.overall-return-panel[data-mode=value] .overall-return-hero{font-size:26px}.overall-return-sub{font-size:11px;color:var(--muted);line-height:1.6;margin-top:8px}
    .overall-return-chart{min-height:220px;margin:16px -4px 4px}.overall-return-periods{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px}.overall-return-period{font-size:11px;padding:8px 2px;font-weight:600}.overall-return-period.active,.history-period.active{background:rgba(255,160,74,.1);color:var(--accent);border-radius:7px}
    .overall-return-note,.history-note{font-size:11px;line-height:1.65;margin:12px 0 0}.overview-account{padding:16px 0}.overview-account button{font-size:14px;font-weight:600}.overview-account .overview-method{margin-top:6px;font-size:10px}.overview-account .overview-result{font-size:16px;font-weight:600}.overview-account small{font-size:10px;line-height:1.5}.overall-return-breakdown{margin-top:20px}
    .home-allocation-panel{padding:20px!important}.home-holding-hero{background:#0d141c;border:1px solid #293645}.home-holding-detail-value{font-size:13px}.home-holding-name{font-weight:600}.home-allocation-row .allocation-name{font-weight:550}.home-allocation-row:hover,.home-allocation-row.active{background:#202c38}.home-allocation-left .donut:after,.donut:after{background:var(--panel)}
    #portfolioTabs{display:flex;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;gap:24px;padding:0 0 4px;top:var(--summary-header-height,80px);margin-bottom:18px;border-bottom:1px solid var(--line)}#portfolioTabs::-webkit-scrollbar{display:none}#portfolioTabs .tab-btn{flex:0 0 auto;font-size:12px;font-weight:600;padding:17px 2px 13px;white-space:nowrap}
    .portfolio-header-actions{display:flex;align-items:center;gap:10px}.portfolio-header-actions .icon-text-btn{font-size:11px;padding:6px 2px;font-weight:550}#portfolioHeader .back-btn{font-size:24px;width:30px}.portfolio-summary{margin-top:0}
    .history-head h2{font-size:15px}.history-head .muted{font-size:10px;margin-top:5px}.history-latest strong{font-size:18px;font-weight:550}.history-latest span{font-size:11px;color:var(--muted);font-weight:400}.history-latest small{display:block;font-size:9px;color:var(--muted);margin-top:4px}.history-chart{background:transparent;border-radius:0;min-height:220px}.history-chart svg{min-height:200px}.history-grid-line{stroke:#28323e;stroke-dasharray:3 5}.history-range{font-size:10px;line-height:1.5}.history-coverage{font-size:10px;line-height:1.5;color:var(--accent);margin:-6px 0 12px}
    .history-periods{gap:4px;margin:15px 0}.history-period{background:transparent;font-size:11px;font-weight:550;padding:8px 3px}.ytd-result-head{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:18px 0}.ytd-result-head>div{min-width:0}.ytd-result-head>div:last-child{text-align:right}.ytd-result-head span{display:block;color:var(--muted);font-size:11px;margin-bottom:8px}.ytd-result-head strong{font-size:22px;font-weight:550;letter-spacing:-.025em;overflow-wrap:anywhere}.ytd-result-head>div:last-child strong{font-size:14px;color:#cfdae5}.ytd-period-note{font-size:10px;color:var(--muted);line-height:1.6;margin-bottom:18px}.ytd-calculation{padding-top:14px}.ytd-snapshot dl{margin:20px 0;gap:14px}.ytd-snapshot dt,.ytd-snapshot dd{font-size:12px}.benchmark-chart{background:transparent!important}.benchmark-legend-item{background:#10171f!important;border-color:#28323e!important}.performance-metric{background:#121a23;border-color:#293440;border-radius:12px}.performance-metric strong{font-size:16px;font-weight:550}
    .overall-return-chart:has(.ytd-snapshot),.benchmark-chart:has(.ytd-snapshot){min-height:0;display:block;margin-top:16px}
    .benchmark-periods{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px}.benchmark-period{font-size:11px;padding:9px 2px;border-radius:7px;font-weight:550;background:transparent}.benchmark-period.active{background:rgba(255,160,74,.12);color:var(--accent);border-color:#81572e}
    #portfolioView .sticky-section-head{top:calc(var(--summary-header-height,80px) + 50px)}
    :is(button,summary,select):focus-visible{outline:2px solid var(--accent);outline-offset:4px}
    @media(max-width:560px){
      main{padding:0 12px}.app-header{padding:16px 14px 12px}#homeHeader{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:3px 10px}#homeHeader>div:first-child{grid-column:1/-1}#homeHeader>.icon-text-btn{font-size:11px;padding:7px 2px}
      .summary-card{padding:22px 18px 14px;border-radius:15px}.hero-number,#homeNetAssets{font-size:35px}.summary-pulse{gap:12px;margin-top:22px}.summary-pulse strong{font-size:16px}.summary-pulse small{font-size:9px}.summary-balances{gap:8px}.summary-balances strong{font-size:12px}.summary-balances span{font-size:9px}
      .panel{padding:16px;border-radius:14px}.overall-return-head{padding:0 16px}.overall-return-body{padding:18px 14px}.overall-return-chart{min-height:180px}.overall-return-hero{font-size:32px}.overall-return-panel[data-mode=value] .overall-return-hero{font-size:23px}.overall-return-tools{gap:8px}.overall-return-updated{max-width:58%;font-size:9px}.overall-return-period{font-size:10px}
      #portfolioHeader{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px}#portfolioHeader .portfolio-header-actions{grid-column:1/-1;justify-content:flex-end;gap:14px}#portfolioHeader .brand{font-size:9px}#portfolioHeader h1{font-size:24px}#portfolioTabs{gap:22px}#portfolioTabs .tab-btn{font-size:11px}
      .benchmark-legend{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.benchmark-legend-item{padding:9px 7px}.benchmark-legend-item span{font-size:9px}.benchmark-legend-item strong{font-size:13px}.history-head{gap:10px}.history-head h2{font-size:14px}.history-latest strong{font-size:15px}.history-latest span{font-size:10px}.history-chart{min-height:170px}.history-chart svg{min-height:170px}.history-range{grid-template-columns:1fr 1fr;font-size:9px}.history-range span:nth-child(2){grid-row:2;grid-column:1/-1;color:var(--muted)}.history-range span:last-child{grid-column:2;grid-row:1}.history-coverage{font-size:9px}
      .ytd-result-head strong{font-size:19px}.ytd-result-head>div:last-child strong{font-size:12px}.ytd-result-head span{font-size:10px}.ytd-snapshot dt,.ytd-snapshot dd{font-size:11px}.ytd-snapshot dl{gap:14px 10px}.home-allocation-panel{padding:16px 12px!important}.home-allocation-master{gap:12px}.home-holding-detail-value{font-size:12px}
    }
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
  `;
  document.head.appendChild(style);

  function disclosure(node,title){
    if(!node||node.parentElement?.classList.contains('summary-disclosure'))return;
    const d=document.createElement('details');d.className='summary-disclosure';
    const s=document.createElement('summary');s.textContent=title;d.appendChild(s);node.before(d);d.appendChild(node);
  }
  function prepare(card,prefix){
    if(!card)return;
    if(!card.querySelector('.summary-pulse')){
      const pulse=document.createElement('div');pulse.className='summary-pulse';pulse.id=prefix+'SummaryPulse';
      const grid=card.querySelector('.summary-grid');card.insertBefore(pulse,grid);
      const balances=document.createElement('div');balances.className='summary-balances';balances.id=prefix+'SummaryBalances';card.insertBefore(balances,grid);
      disclosure(grid,'Account details');
    }
  }
  function dayFor(s){
    const stocks=s.hs.filter(h=>h.type==='stock'),eligible=stocks.filter(h=>Number(h.previousClose)>0&&Number.isFinite(Number(h.price)));
    const value=eligible.reduce((sum,h)=>sum+convert(h.qty*(h.price-h.previousClose)*multiplier(h),h.currency),0);
    const prior=eligible.reduce((sum,h)=>sum+convert(h.qty*h.previousClose*multiplier(h),h.currency),0);
    return {value,percent:prior?value/Math.abs(prior)*100:null,complete:eligible.length===stocks.length&&stocks.length>0};
  }
  function renderSummary(card,prefix,id=null){
    prepare(card,prefix);if(!card)return;
    const s=summaryFor(id),day=dayFor(s),r=id?window.PortfolioYtdAnchor?.resultFor(id):window.PortfolioYtdAnchor?.overallResult();
    const ytd=r?.ok&&r.returnPct!=null?pct(r.returnPct):'—';
    const dayValue=day.complete?signedMoney(day.value):'—';
    const scope=r?.selectedCount&&r.selectedCount!==r.activeCount?`${r.selectedCount}/${r.activeCount} portfolios · `:'';
    const ytdNote=r?.ok?`${scope}${signedMoney(convert(r.profit,r.currency))} · ${r.asOf}`:r?'Check YTD settings':'Optional YTD not enabled';
    document.getElementById(prefix+'SummaryPulse').innerHTML=`<div><span>Today · stock price movement</span><strong class="${day.complete?day.value<0?'negative':'positive':''}">${esc(dayValue)}</strong><small>${day.complete&&day.percent!=null?pct(day.percent)+' · current holdings':'Complete previous-close quotes unavailable'}</small></div><div><button type="button" class="summary-ytd-link"><span>YTD return <span aria-hidden="true" style="display:inline;color:var(--accent)">↗</span></span><strong class="${r?.ok&&r.returnPct!=null?r.returnPct<0?'negative':'positive':''}">${esc(ytd)}</strong></button><small>${esc(ytdNote)}</small></div>`;
    document.getElementById(prefix+'SummaryPulse').querySelector('button').addEventListener('click',()=>{
      if(id){window.showPortfolioTab('performance');document.querySelector('#benchmarkPeriods [data-period=YTD]')?.click();}
      else{document.querySelector('.overall-return-tab[data-mode=performance]')?.click();document.querySelector('#overallReturnPeriods [data-period=YTD]')?.click();}
    });
    document.getElementById(prefix+'SummaryBalances').innerHTML=[['Market value',money(s.invested)],['Cash / margin',money(s.cash)],['Exposure',s.exposure.toFixed(2)+'×']].map(([label,value])=>`<div><span>${label}</span><strong>${esc(value)}</strong></div>`).join('');
  }
  function layout(){
    const home=document.getElementById('homeView'),card=home?.querySelector('.summary-card'),chart=document.getElementById('overallReturnPanel');
    if(card&&chart&&card.nextElementSibling!==chart)card.after(chart);
    const metrics=document.getElementById('performanceMetrics'),benchmark=document.getElementById('benchmarkChart')?.closest('.panel');
    if(metrics&&benchmark&&metrics.previousElementSibling!==benchmark)metrics.before(benchmark);
    disclosure(document.getElementById('overallReturnNote'),'About this calculation');
    disclosure(document.getElementById('historyNote'),'Chart details');
    disclosure(document.getElementById('benchmarkNote'),'About this calculation');
  }
  const homeRender=window.renderHome;
  window.renderHome=renderHome=function(){homeRender();layout();renderSummary(document.querySelector('#homeView>.summary-card'),'home');};
  const portfolioRender=window.renderPortfolio;
  window.renderPortfolio=renderPortfolio=function(){portfolioRender();layout();renderSummary(document.querySelector('.portfolio-summary'),'portfolio',currentPortfolioId);};
  const resize=new ResizeObserver(()=>{
    const header=document.getElementById(currentPortfolioId?'portfolioHeader':'homeHeader');
    document.documentElement.style.setProperty('--summary-header-height',(header?.getBoundingClientRect().height||80)+'px');
  });
  ['homeHeader','portfolioHeader'].forEach(id=>{const el=document.getElementById(id);if(el)resize.observe(el);});
  layout();renderHome();if(currentPortfolioId)renderPortfolio();
})();
