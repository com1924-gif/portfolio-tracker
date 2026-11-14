const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');
const c=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../chart-inspector-v2.js'),'utf8'),c);
const m=c.PortfolioChartInspectorModel;
test('cursor snaps to recorded dates with calendar spacing and clamps at either edge',()=>{
 const p=[{date:'2026-11-01'},{date:'2026-11-02'},{date:'2026-11-11'}];
 assert.equal(m.nearestIndex(p,'2026-11-03'),1);assert.equal(m.nearestIndex(p,'2026-11-10'),2);
 assert.equal(m.nearestIndex(p,'2026-10-01'),0);assert.equal(m.nearestIndex(p,'2026-12-01'),2);assert.equal(m.nearestIndex([],'2026-11-01'),-1);
});
const pair=()=>[{id:'out',accountId:'a',counterpartyId:'b',transferId:'x',date:'2026-11-01',currency:'USD',amount:-20,displayAmount:-156},
 {id:'in',accountId:'b',counterpartyId:'a',transferId:'x',date:'2026-11-01',currency:'USD',amount:20,displayAmount:156}];
test('matched internal transfers are retained as rows but excluded from combined funding totals',()=>{
 const rows=pair(),before=JSON.stringify(rows),r=m.classifyTransfers(rows,['a','b']);
 assert.ok(r.every(x=>x.internal));assert.equal(m.totals(r).net,0);assert.equal(m.totals(r).deposits,0);assert.equal(m.totals(r).withdrawals,0);assert.equal(JSON.stringify(rows),before);
 const single=m.classifyTransfers([rows[0]],['a']);assert.equal(single[0].internal,false);assert.equal(m.totals(single).withdrawals,156);
});
test('opposite cash flows on the same day remain visible and are never cancelled without a matching transfer',()=>{
 const rows=pair().map(x=>({...x,counterpartyId:null,transferId:null}));const r=m.classifyTransfers(rows,['a','b']);
 assert.equal(m.totals(r).deposits,156);assert.equal(m.totals(r).withdrawals,156);assert.equal(r.length,2);
});
test('unequal, cross-date or cross-currency transfer entries remain flagged instead of silently disappearing',()=>{
 for(const change of [{amount:19},{date:'2026-11-02'},{currency:'HKD'}]){
  const rows=pair();Object.assign(rows[1],change);const r=m.classifyTransfers(rows,['a','b']);assert.ok(r.every(x=>x.unmatched&&!x.internal));assert.ok(m.totals(r).deposits>0);
 }
 assert.equal(m.totals([{displayAmount:NaN,internal:false}]).net,null);
});
