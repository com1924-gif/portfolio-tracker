(()=>{
if(window.__bullCallTxGroup22512)return;window.__bullCallTxGroup22512=true;
function strategyRows(pid){
 const m=new Map();
 state.transactions.forEach(t=>{
  if(t.accountId!==pid||t.strategyType!=='bull_call_spread'||!t.strategyId)return;
  if(!m.has(t.strategyId))m.set(t.strategyId,[]);
  m.get(t.strategyId).push(t);
 });
 return m;
}
window.renderTransactionRows=renderTransactionRows=function(){
 const all=state.transactions
  .filter(t=>t.accountId===currentPortfolioId&&!['Deposit','Withdrawal'].includes(t.type))
  .slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 const groups=strategyRows(currentPortfolioId),seen=new Set(),html=[];
 for(const t of all){
  if(t.strategyType==='bull_call_spread'&&t.strategyId){
   if(seen.has(t.strategyId))continue;
   seen.add(t.strategyId);
   const g=groups.get(t.strategyId)||[];
   const lt=g.find(x=>x.strategyLeg==='long'&&x.type==='Buy');
   const st=g.find(x=>x.strategyLeg==='short'&&x.type==='Sell');
   if(lt&&st){
    const la=state.assets.find(a=>a.id===lt.assetId);
    const sa=state.assets.find(a=>a.id===st.assetId);
    const q=Math.min(Number(lt.qty)||0,Number(st.qty)||0);
    const ccy=lt.currency||st.currency||'USD';
    const debit=(Number(lt.qty)||0)*(Number(lt.price)||0)*100+(Number(lt.fee)||0)-((Number(st.qty)||0)*(Number(st.price)||0)*100-(Number(st.fee)||0));
    const under=normalizeTicker(la?.underlying||sa?.underlying||'');
    html.push(`<div class="tx-row"><div><div class="tx-title">Bull Call Spread · ${esc(under)} ${Number(la?.strike)}C / -${Number(sa?.strike)}C</div><div class="tx-sub">${esc(lt.date||st.date)} · ${q} spread${q===1?'':'s'} · expiry ${esc(la?.expiry||sa?.expiry||'—')}</div></div><div class="tx-actions"><div class="right"><div>${money(debit,ccy)}</div><div class="tx-sub">Net debit</div></div></div></div>`);
    continue;
   }
  }
  const a=state.assets.find(x=>x.id===t.assetId);
  const amt=t.amount!=null?Number(t.amount):((Number(t.qty)||0)*(Number(t.price)||0)*multiplier(a));
  const short=a?.type==='option'&&a?.positionSide==='short';
  const label=short?(t.type==='Sell'?'Sell to Open':t.type==='Buy'?'Buy to Close':t.type):t.type;
  const edit=short?'':`<button class="edit-btn" type="button" onclick="openEditTransaction('${t.id}')">Edit</button>`;
  html.push(`<div class="tx-row"><div><div class="tx-title">${esc(label)}${a?' · '+esc(a.symbol):''}</div><div class="tx-sub">${esc(t.date)}${t.qty?` · ${formatTransactionQuantity(t,a)} @ ${money(t.price,t.currency)}`:''}</div></div><div class="tx-actions"><div class="right">${money(amt,t.currency)}</div>${edit}<button class="delete-btn" type="button" onclick="deleteTransaction('${t.id}')">Delete</button></div></div>`);
 }
 document.getElementById('portfolioTransactions').innerHTML=html.length?html.join(''):'<div class="empty">No transactions yet.</div>';
};
const prior=window.renderPortfolio;
if(typeof prior==='function')window.renderPortfolio=renderPortfolio=function(){prior();window.renderTransactionRows();};
if(currentPortfolioId)window.renderTransactionRows();
})();