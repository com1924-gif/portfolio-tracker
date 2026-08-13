(()=>{
  if(document.getElementById('historyV2Styles')) return;
  const style=document.createElement('style');
  style.id='historyV2Styles';
  style.textContent=`
    .history-panel{overflow:hidden}
    .history-head{align-items:flex-start}
    .history-latest{text-align:right;display:grid;gap:4px}
    .history-latest strong{font-size:18px}
    .history-latest span{font-size:12px;font-weight:800}
    .history-chart{min-height:220px;display:flex;align-items:center;justify-content:center;background:#17171b;border-radius:16px;overflow:hidden}
    .history-chart svg{display:block;width:100%;height:auto;min-height:210px}
    .history-grid-line{stroke:#37373d;stroke-width:1}
    .history-loading{color:var(--muted);font-size:13px;padding:70px 12px}
    .history-range{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;color:var(--muted);font-size:11px;margin-top:8px;align-items:center}
    .history-range span:nth-child(2){text-align:center}
    .history-range span:last-child{text-align:right}
    .history-periods{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-top:14px}
    .history-period{border:0;border-radius:10px;padding:8px 3px;background:#17171b;color:var(--muted);font-size:11px;font-weight:800;cursor:pointer}
    .history-period.active{background:var(--accent);color:#202025}
    .history-note{margin-top:11px;color:var(--muted);font-size:10px;line-height:1.45}
    @media(max-width:520px){
      .history-chart{min-height:180px}
      .history-chart svg{min-height:170px}
      .history-latest strong{font-size:15px}
      .history-period{font-size:10px;padding:8px 1px}
    }
  `;
  document.head.appendChild(style);
})();
