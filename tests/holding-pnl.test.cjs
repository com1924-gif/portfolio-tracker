const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');

// Run the production accounting and aggregation functions without the UI hooks.
const lifecycle=fs.readFileSync(require.resolve('../lifecycle-v2.js'),'utf8');
const home=fs.readFileSync(require.resolve('../home-v225.js'),'utf8');
function setup({partial=false,reopen=false,closeAll=false}={}){
 const state={accounts:[{id:'one',name:'Example A'},{id:'two',name:'Example B'}],fx:[],settings:{},
  assets:[{id:'a',accountId:'one',type:'stock',symbol:'AAA',currency:'USD',price:12,previousClose:11},
   {id:'b',accountId:'two',type:'stock',symbol:'AAA',currency:'USD',price:99},
   {id:'c',accountId:'two',type:'stock',symbol:'ZZZ',currency:'USD',price:99}],transactions:[]};
 const trade=(assetId,accountId,type,qty,price,fee,date)=>({id:String(state.transactions.length),assetId,accountId,type,qty,price,fee,date,currency:'USD'});
 const add=(...args)=>state.transactions.push(trade(...args));
 add('a','one','Buy',10,10,2,'2026-01-02');
 add('a','one','Sell',closeAll?10:4,12,1,'2026-02-02');
 add('b','two','Buy',partial?2:1,15,partial?2:1,'2026-01-02');
 add('b','two','Sell',1,12,1,'2026-02-02');
 if(reopen)add('b','two','Buy',2,8,0,'2026-03-02');
 add('c','two','Buy',1,10,0,'2026-01-02');
 add('c','two','Sell',1,20,0,'2026-02-02');
 const context=vm.createContext({state,EPS:1e-9,window:{},normalizeTicker:s=>s.toUpperCase(),
  multiplier:()=>1,convert:v=>v*7.8,cashBalancesFor:()=>({USD:100})});
 vm.runInContext(lifecycle.slice(lifecycle.indexOf('  function tradeRowsForAsset'),lifecycle.indexOf('  window.positionsFor=')),context);
 vm.runInContext(home.slice(home.indexOf('  function keyFor('),home.indexOf('  function ensureHomeLayout(')),context);
 return {state,context,positions:()=>context.positionsFor(),groups:()=>context.aggregateHoldings(context.lifecycleHoldingsFor())};
}
const near=(value,expected)=>assert.ok(Math.abs(value-expected)<1e-8,`${value} != ${expected}`);

test('closed-account loss joins tracked P/L while open shares, cost, quotes and allocation stay unchanged',()=>{
 const s=setup(),before=JSON.stringify(s.state),positions=JSON.stringify(s.positions());
 const [g]=s.groups();assert.equal(s.groups().length,1);assert.equal(g.symbol,'AAA');
 assert.equal(g.qty,6);near(g.costDisplay,61.2*7.8);near(g.marketValueDisplay,72*7.8);
 near(g.realizedDisplay,1.2*7.8);near(g.unrealizedDisplay,10.8*7.8);near(g.totalPLDisplay,12*7.8);
 near(g.totalBuyCostDisplay,118*7.8);near(g.totalReturnPct,12/118*100);
 near(g.todayPLDisplay,6*7.8);near(g.todayPct,1/11*100);assert.equal(g.price,12);assert.equal(g.weight,100);
 assert.deepEqual([...g.accountNames],['Example A']);assert.deepEqual([...g.closedAccountNames],['Example B']);
 assert.equal(JSON.stringify(s.state),before);assert.equal(JSON.stringify(s.positions()),positions);
 const closed=s.positions().find(p=>p.id==='b');assert.equal(closed.qty,0);assert.equal(closed.cost,0);assert.equal(closed.avgCost,0);near(closed.realized,-5);
});
test('partial sale reduces cost by the pre-sale average and counts its realized result once',()=>{
 const s=setup({partial:true}),[g]=s.groups(),p=s.positions().find(p=>p.id==='b');
 assert.equal(p.qty,1);near(p.avgCost,16);near(p.cost,16);near(p.realized,-5);
 assert.equal(g.qty,7);near(g.costDisplay,77.2*7.8);near(g.realizedDisplay,1.2*7.8);assert.equal(g.closedAccountIds.size,0);
});
test('reopening a closed asset retains earlier realized P/L without adding it twice',()=>{
 const s=setup({reopen:true}),[g]=s.groups();assert.equal(g.qty,8);near(g.costDisplay,77.2*7.8);
 near(g.realizedDisplay,1.2*7.8);assert.equal(g.closedAccountIds.size,0);near(g.totalBuyCostDisplay,134*7.8);
});
test('fully exited instruments stay in Closed and never create an allocation slice',()=>{
 const s=setup({closeAll:true});assert.equal(s.groups().length,0);assert.equal(s.context.closedPositionsFor().length,3);
});
test('a closed gain is included and an unrelated closed ticker cannot contaminate it',()=>{
 const s=setup();s.state.transactions.find(t=>t.assetId==='b'&&t.type==='Sell').price=20;
 const [g]=s.groups();near(g.realizedDisplay,9.2*7.8);near(g.totalPLDisplay,20*7.8);
 assert.equal(g.assetIds.has('c'),false);
});
