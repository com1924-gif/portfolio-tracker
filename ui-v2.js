function renderAll(){
  renderHome();
  if(currentPortfolioId)renderPortfolio();
  populatePortfolioSelects();
}

function renderHome(){
  const s=summaryFor();
  $('homeNetAssets').textContent=money(s.net);
  $('homeTotalPL').textContent=signedMoney(s.totalPL);
  $('homeTotalPL').className=s.totalPL<0?'negative':'positive';
  $('homeInvested').textContent=money(s.invested);
  $('homeCash').textContent=money(s.cash);
  $('homeCash').className=s.cash<0?'negative':'';
  $('homeExposure').textContent=s.exposure.toFixed(2)+'×';
  $('homeInvestedBar').style.width=`${Math.max(0,Math.min(100,s.net?Math.abs(s.invested/s.net*100):0))}%`;

  $('portfolioChips').innerHTML=[`<button class="chip active" type="button" onclick="goHome()">All</button>`,...state.accounts.map(a=>`<button class="chip" type="button" onclick="openPortfolio('${a.id}')">${esc(a.name)}</button>`)].join('');

  $('portfolioCards').innerHTML=state.accounts.length?state.accounts.map(a=>{
    const p=summaryFor(a.id);
    return `<article class="portfolio-card" onclick="openPortfolio('${a.id}')">
      <div class="portfolio-card-top"><div class="portfolio-card-name">${esc(a.name)}</div><span>›</span></div>
      <div class="portfolio-card-value">${money(p.net)}</div>
      <div class="portfolio-card-meta"><span>Market ${money(p.invested)}</span><span class="${p.totalPL<0?'negative':'positive'}">P/L ${signedMoney(p.totalPL)}</span></div>
      <div class="portfolio-card-meta"><span>Cash ${money(p.cash)}</span><span>${p.hs.length} holdings</span></div>
    </article>`;
  }).join(''):`<div class="empty">No portfolio yet. Add your first portfolio.</div>`;

  renderAllocation('homeDonut','homeDonutText','homeAllocationList',s.hs,s.net);
  renderHoldingRows('homeHoldings',s.hs.slice().sort((a,b)=>convert(b.marketValue,b.currency)-convert(a.marketValue,a.currency)).slice(0,8),s.net,false);
}

function renderPortfolio(){
  const p=summaryFor(currentPortfolioId);
  $('portfolioTitle').textContent=portfolioName(currentPortfolioId);
  $('portfolioNetAssets').textContent=money(p.net);
  $('portfolioInvested').textContent=money(p.invested);
  $('portfolioCash').textContent=money(p.cash);
  $('portfolioCash').className=p.cash<0?'negative':'';
  $('portfolioPL').textContent=signedMoney(p.totalPL);
  $('portfolioPL').className=p.totalPL<0?'negative':'positive';
  $('portfolioExposure').textContent=p.exposure.toFixed(2)+'×';
  renderAllocation('portfolioDonut','portfolioDonutText','portfolioAllocationList',p.hs,p.net);
  renderHoldingRows('portfolioHoldingsPreview',p.hs.slice(0,6),p.net,true);
  renderHoldingRows('portfolioHoldingsFull',p.hs,p.net,true);
  renderTransactionRows();
  renderCashTab();
}

const palette=['#ffbe0b','#fb7b45','#ff5964','#d34f8b','#9b5aa3','#6556a5','#376996','#23a5a5','#b9a0d9','#e38fd3'];
function renderAllocation(donutId,textId,listId,hs,net){
  const rows=hs.slice().sort((a,b)=>convert(b.marketValue,b.currency)-convert(a.marketValue,a.currency));
  const total=rows.reduce((s,h)=>s+Math.max(0,convert(h.marketValue,h.currency)),0);
  let cursor=0;const stops=[];
  rows.forEach((h,i)=>{const w=total?Math.max(0,convert(h.marketValue,h.currency))/total*100:0;stops.push(`${palette[i%palette.length]} ${cursor}% ${cursor+w}%`);cursor+=w;});
  $(donutId).style.background=stops.length?`conic-gradient(${stops.join(',')})`:'#333';
  $(textId).textContent=net?`${Math.round(total/net*100)}%`:'0%';
  $(listId).innerHTML=rows.length?rows.slice(0,10).map((h,i)=>{
    const w=total?convert(h.marketValue,h.currency)/total*100:0;
    return `<div class="allocation-row"><span class="allocation-dot" style="background:${palette[i%palette.length]}"></span><span class="allocation-name">${esc(h.symbol)}</span><span class="allocation-pct">${w.toFixed(1)}%</span></div>`;
  }).join(''):`<div class="empty">No holdings yet.</div>`;
}

function renderHoldingRows(target,hs,net,clickable){
  const el=$(target);if(!el)return;
  if(!hs.length){el.innerHTML='<div class="empty">No holdings yet.</div>';return;}
  el.innerHTML=hs.map(h=>{
    const mv=convert(h.marketValue,h.currency),pl=convert(h.unrealized,h.currency),weight=net?mv/net*100:0;
    return `<div class="holding-row" ${clickable?`onclick="openHoldingDetail('${h.id}')"`:''}>
      <div><div class="holding-name">${esc(h.symbol)}</div><div class="holding-sub">${h.type==='option'?`${h.qty} contracts · ${esc(h.name)}`:`${h.qty} shares · ${esc(h.name)}`}</div></div>
      <div class="right"><div>${money(mv)}</div><div class="holding-sub">${money(h.marketValue,h.currency)}</div></div>
      <div class="right"><div class="${pl<0?'negative':'positive'}">${pct(h.returnPct)}</div><div class="weight">${weight.toFixed(1)}%</div></div>
    </div>`;
  }).join('');
}

function renderTransactionRows(){
  const txs=state.transactions.filter(t=>t.accountId===currentPortfolioId && !['Deposit','Withdrawal'].includes(t.type)).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  $('portfolioTransactions').innerHTML=txs.length?txs.map(t=>{
    const a=state.assets.find(x=>x.id===t.assetId);
    const amt=t.amount!=null?Number(t.amount):((Number(t.qty)||0)*(Number(t.price)||0)*multiplier(a));
    return `<div class="tx-row"><div><div class="tx-title">${esc(t.type)}${a?' · '+esc(a.symbol):''}</div><div class="tx-sub">${esc(t.date)}${t.qty?` · ${t.qty} @ ${money(t.price,t.currency)}`:''}</div></div><div class="tx-actions"><div class="right">${money(amt,t.currency)}</div><button class="delete-btn" type="button" onclick="deleteTransaction('${t.id}')">Delete</button></div></div>`;
  }).join(''):'<div class="empty">No transactions yet.</div>';
}

function renderCashTab(){
  const bal=cashBalancesFor(currentPortfolioId);
  $('portfolioCashBalances').innerHTML=Object.entries(bal).map(([c,v])=>`<div class="cash-row"><strong>${c}</strong><span class="cash-balance ${v<0?'negative':''}">${money(v,c)}</span></div>`).join('');
  const cashTx=state.transactions.filter(t=>t.accountId===currentPortfolioId&&['Deposit','Withdrawal'].includes(t.type)).map(t=>({...t,kind:'cash'}));
  const fxTx=state.fx.filter(f=>f.accountId===currentPortfolioId).map(f=>({...f,kind:'fx'}));
  const rows=[...cashTx,...fxTx].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  $('portfolioCashHistory').innerHTML=rows.length?rows.map(r=>{
    if(r.kind==='fx')return `<div class="tx-row"><div><div class="tx-title">Exchange · ${r.from} → ${r.to}</div><div class="tx-sub">${esc(r.date)}</div></div><div class="tx-actions"><div class="right">${money(r.fromAmount,r.from)}<div class="tx-sub">→ ${money(r.toAmount,r.to)}</div></div><button class="delete-btn" type="button" onclick="deleteFx('${r.id}')">Delete</button></div></div>`;
    return `<div class="tx-row"><div><div class="tx-title">${esc(r.type)}</div><div class="tx-sub">${esc(r.date)} · ${r.currency}</div></div><div class="tx-actions"><div class="right">${money(r.amount,r.currency)}</div><button class="delete-btn" type="button" onclick="deleteTransaction('${r.id}')">Delete</button></div></div>`;
  }).join(''):'<div class="empty">No cash activity yet.</div>';
}

function populatePortfolioSelects(){
  const html=state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  ['txPortfolio','cashPortfolio'].forEach(id=>{if($(id)){$(id).innerHTML=html;if(currentPortfolioId)$(id).value=currentPortfolioId;}});
}

window.goHome=()=>{
  currentPortfolioId=null;
  $('homeView').classList.add('active');$('portfolioView').classList.remove('active');
  $('homeHeader').classList.remove('hidden');$('portfolioHeader').classList.add('hidden');
  renderHome();
};
window.openPortfolio=id=>{
  currentPortfolioId=id;
  $('homeView').classList.remove('active');$('portfolioView').classList.add('active');
  $('homeHeader').classList.add('hidden');$('portfolioHeader').classList.remove('hidden');
  showPortfolioTab('overview');populatePortfolioSelects();renderPortfolio();window.scrollTo({top:0,behavior:'smooth'});
};
window.showPortfolioTab=tab=>{
  document.querySelectorAll('.portfolio-tab').forEach(el=>el.classList.toggle('active',el.id===`tab-${tab}`));
  document.querySelectorAll('.tab-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===tab));
};

document.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>showPortfolioTab(btn.dataset.tab)));

function openModal(id){$(id)?.classList.remove('hidden');}
function closeModal(id){$(id)?.classList.add('hidden');}
document.querySelectorAll('.modal-close').forEach(btn=>btn.addEventListener('click',()=>closeModal(btn.closest('.modal-overlay').id)));
document.querySelectorAll('.modal-overlay').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)closeModal(ov.id);}));

window.openPortfolioModal=()=>{ $('portfolioName').value=''; openModal('portfolioModal'); };
$('savePortfolioBtn').addEventListener('click',()=>{
  const name=$('portfolioName').value.trim();if(!name)return toast('Enter a portfolio name.',true);
  const a={id:uid('p_'),name};state.accounts.push(a);save();closeModal('portfolioModal');renderAll();openPortfolio(a.id);toast('Portfolio saved.');
});

