(()=>{
if(window.__bullCallGroup22515)return;window.__bullCallGroup22512=true;
const rawSummary=window.summaryFor,rawPositions=window.positionsFor,rawOpen=window.openHoldingDetail;
function txMap(pid){const m=new Map();state.transactions.forEach(t=>{if(t.strategyType!=='bull_call_spread'||!t.strategyId||(pid&&t.accountId!==pid))return;if(!m.has(t.strategyId))m.set(t.strategyId,[]);m.get(t.strategyId).push(t)});return m}
function snap(id,pid){
 const ts=txMap(pid).get(id)||[],lt=ts.find(t=>t.strategyLeg==='long'&&t.type==='Buy'),st=ts.find(t=>t.strategyLeg==='short'&&t.type==='Sell');if(!lt||!st)return null;
 const la=state.assets.find(a=>a.id===lt.assetId),sa=state.assets.find(a=>a.id===st.assetId);if(!la||!sa)return null;
 const ps=rawPositions?rawPositions(lt.accountId):[],lp=ps.find(p=>p.id===la.id),sp=ps.find(p=>p.id===sa.id);if(!lp||!sp||!(lp.qty>0)||!(sp.qty>0))return null;
 const q=Math.min(Number(lp.qty)||0,Number(sp.qty)||0),ccy=la.currency||sa.currency||'USD';
 const mv=(Number(lp.marketValue)||0)+(Number(sp.marketValue)||0),u=(Number(lp.unrealized)||0)+(Number(sp.unrealized)||0),r=(Number(lp.realized)||0)+(Number(sp.realized)||0);
 const debit=(Number(lt.qty)||0)*(Number(lt.price)||0)*100+(Number(lt.fee)||0)-((Number(st.qty)||0)*(Number(st.price)||0)*100-(Number(st.fee)||0));
 const width=(Number(sa.strike)||0)-(Number(la.strike)||0),be=(Number(la.strike)||0)+(q?debit/(q*100):0),under=normalizeTicker(la.underlying||sa.underlying||'');
 return {id:'strategy:'+id,strategyId:id,isStrategy:true,type:'option',accountId:lt.accountId,symbol:`${under} ${Number(la.strike)}C/-${Number(sa.strike)}C`,name:`Bull Call Spread · ${la.expiry||sa.expiry||''}`,currency:ccy,qty:q,multiplier:100,price:q?mv/(q*100):0,marketValue:mv,cost:debit,avgCost:q?debit/(q*100):0,unrealized:u,realized:r,totalPL:u+r,returnPct:debit?u/Math.abs(debit)*100:0,totalBuyCost:debit,longTx:lt,shortTx:st,longAsset:la,shortAsset:sa,longPos:lp,shortPos:sp,expiry:la.expiry||sa.expiry||'',underlying:under,width,maxLoss:Math.max(0,debit),maxProfit:Math.max(0,width*q*100-debit),breakeven:be}
}
function grouped(hs,pid){const ids=new Set(),gs=[];for(const id of txMap(pid).keys()){const g=snap(id,pid);if(g){gs.push(g);ids.add(g.longAsset.id);ids.add(g.shortAsset.id)}}return (hs||[]).filter(h=>!ids.has(h.id)).concat(gs)}
window.groupBullCallHoldings=grouped;
if(rawSummary)window.summaryFor=summaryFor=function(pid=null){const s=rawSummary(pid);return {...s,hs:grouped(s.hs,pid)}};
window.openBullCallStrategyDetail=id=>{
 const g=snap(id,currentPortfolioId);if(!g)return toast('Bull Call Spread not found.',true);
 activeHoldingId=null;document.getElementById('updatePriceBtn')?.classList.add('hidden');document.getElementById('closeOptionPositionBtn')?.classList.add('hidden');
 document.getElementById('holdingDetailTitle').textContent=`${g.underlying} Bull Call Spread`;
 document.getElementById('holdingDetailBody').innerHTML=`
 <div class="detail-grid">
 <div class="detail-cell"><span>Long / Short</span><strong>${Number(g.longAsset.strike)}C / -${Number(g.shortAsset.strike)}C</strong></div>
 <div class="detail-cell"><span>Expiry</span><strong>${esc(g.expiry)}</strong></div>
 <div class="detail-cell"><span>Contracts</span><strong>${g.qty}</strong></div>
 <div class="detail-cell"><span>Net Debit</span><strong>${money(g.cost,g.currency)}</strong></div>
 <div class="detail-cell"><span>Current Value</span><strong>${money(g.marketValue,g.currency)}</strong></div>
 <div class="detail-cell"><span>Open P/L</span><strong class="${g.unrealized<0?'negative':'positive'}">${signedMoney(g.unrealized,g.currency)} (${pct(g.returnPct)})</strong></div>
 <div class="detail-cell"><span>Max Loss</span><strong>${money(g.maxLoss,g.currency)}</strong></div>
 <div class="detail-cell"><span>Max Profit</span><strong>${money(g.maxProfit,g.currency)}</strong></div>
 <div class="detail-cell"><span>Breakeven</span><strong>${money(g.breakeven,g.currency)}</strong></div>
 <div class="detail-cell"><span>Width</span><strong>${money(g.width,g.currency)}</strong></div>
 </div>
 <div class="detail-title">Strategy legs</div>
 <div class="detail-transactions">
 <div class="tx-row"><div><div class="tx-title positive">Long ${Number(g.longAsset.strike)} Call</div><div class="tx-sub">Buy ${g.longTx.qty} @ ${money(g.longTx.price,g.currency)} · fee ${money(g.longTx.fee||0,g.currency)}</div></div><div class="right">${money(g.longPos.marketValue,g.currency)}</div></div>
 <div class="tx-row"><div><div class="tx-title negative">Short ${Number(g.shortAsset.strike)} Call</div><div class="tx-sub">Sell ${g.shortTx.qty} @ ${money(g.shortTx.price,g.currency)} · fee ${money(g.shortTx.fee||0,g.currency)}</div></div><div class="right">${money(g.shortPos.marketValue,g.currency)}</div></div>
 </div>
 <button type="button" class="ghost-btn full" style="margin-top:12px" onclick="openBullCallStrategyEditor('${g.strategyId}')">Update Strategy Prices</button>`;
 openModal('holdingModal')
};
window.openHoldingDetail=id=>String(id).startsWith('strategy:')?window.openBullCallStrategyDetail(String(id).slice(9)):rawOpen?.(id);
if(typeof renderAll==='function')renderAll();
})();