const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require.resolve('../prices-v2.js'),'utf8');

function setup(quote){
 const asset={id:'a',symbol:'AAA',type:'stock',currency:'USD',price:100,previousClose:88,
  previousCloseDate:'2026-11-11',previousCloseUpdatedAt:'old'};
 const transactions=[{id:'buy',type:'Buy',qty:10,price:90}],accounts=[{id:'one'}];
 const calls={save:0,render:0};
 const context=vm.createContext({state:{assets:[asset],transactions,accounts},window:{},
  normalizeTicker:s=>s,document:{getElementById:()=>null},setTimeout:()=>{},
  localStorage:{getItem:()=>null,setItem:()=>{}},console,toast:()=>{},
  save:()=>calls.save++,renderAll:()=>calls.render++,
  fetch:async()=>({ok:true,json:async()=>({quotes:{AAA:quote}})})});
 vm.runInContext(code,context);
 return {asset,context,calls,transactions,accounts};
}

test('a refresh replaces the mismatched baseline and preserves the transaction ledger',async()=>{
 const s=setup({price:94,previousClose:100,priceDate:'2026-11-13',previousCloseDate:'2026-11-12',session:'regular'});
 const before=JSON.stringify({transactions:s.transactions,accounts:s.accounts});
 await s.context.window.refreshStockPrices({force:true});
 assert.equal(s.asset.price,94);assert.equal(s.asset.previousClose,100);
 assert.ok(Math.abs((s.asset.price/s.asset.previousClose-1)*100+6)<1e-9);
 assert.equal(s.asset.quoteDate,'2026-11-13');assert.equal(s.asset.previousCloseDate,'2026-11-12');
 assert.equal(JSON.stringify({transactions:s.transactions,accounts:s.accounts}),before);
 assert.equal(s.calls.save,1);assert.equal(s.calls.render,1);
});

test('missing or invalid previous close clears an old comparison instead of showing a false gain',async()=>{
 for(const previousClose of [undefined,null,0,-1,'invalid']){
  const s=setup({price:94,previousClose,priceDate:'2026-11-13'});
  await s.context.window.refreshStockPrices({force:true});
  assert.equal(s.asset.price,94);assert.equal(s.asset.previousClose,null);
  assert.equal(s.asset.previousCloseUpdatedAt,null);assert.equal(s.asset.previousCloseDate,undefined);
 }
});

test('failed quotes keep the last complete quote instead of partially updating it',async()=>{
 const s=setup({price:null,error:'unavailable'});
 await s.context.window.refreshStockPrices({force:true});
 assert.equal(s.asset.price,100);assert.equal(s.asset.previousClose,88);assert.equal(s.calls.save,0);
});
