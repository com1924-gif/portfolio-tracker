const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require.resolve('../prices-v2.js'),'utf8');

function setup(quote){
 const asset={id:'a',symbol:'AAA',type:'stock',currency:'USD',price:100,previousClose:88,
  previousCloseDate:'2026-11-11',previousCloseUpdatedAt:'old'};
 const transactions=[{id:'buy',type:'Buy',qty:10,price:90}],accounts=[{id:'one'}];
 const calls={save:0,render:0,fetch:[]},events={};
 const context=vm.createContext({state:{assets:[asset],transactions,accounts},window:{addEventListener:(name,fn)=>events[name]=fn},
  normalizeTicker:s=>s,document:{getElementById:()=>null,addEventListener:(name,fn)=>events[name]=fn,visibilityState:'visible'},setTimeout:()=>{},setInterval:()=>{},
  localStorage:{getItem:()=>null,setItem:()=>{}},console,toast:()=>{},
  save:()=>calls.save++,renderAll:()=>calls.render++,
  fetch:async(...args)=>{calls.fetch.push(args);return {ok:true,json:async()=>({quotes:{AAA:quote}})};}});
 vm.runInContext(code,context);
 return {asset,context,calls,transactions,accounts,events};
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

test('a quote arriving after Cloud Sync updates current assets and leaves detached objects alone',async()=>{
 const s=setup({}),before=JSON.stringify(s.transactions);
 let release;const gate=new Promise(resolve=>release=resolve);
 s.context.fetch=async()=>{await gate;return {ok:true,json:async()=>({quotes:{AAA:{price:94,previousClose:100}}})};};
 const pending=s.context.window.refreshStockPrices({force:true});
 const current={...s.asset,price:200};s.context.state={assets:[current],transactions:s.transactions,accounts:s.accounts};
 release();await pending;
 assert.equal(current.price,94);assert.equal(s.asset.price,100);
 assert.equal(JSON.stringify(s.transactions),before);
});

test('an older market date cannot overwrite a newer saved quote',async()=>{
 const s=setup({price:94,previousClose:100,priceDate:'2026-11-13'});
 s.asset.quoteDate='2026-11-16';
 await s.context.window.refreshStockPrices({force:true});
 assert.equal(s.asset.price,100);assert.equal(s.calls.save,0);
});

test('manual refresh bypasses browser and CDN URL caches',async()=>{
 const s=setup({price:94,previousClose:100});
 await s.context.window.refreshStockPrices({force:true});
 const [url,options]=s.calls.fetch[0];
 assert.equal(options.cache,'no-store');assert.match(url,/quoteSchema=2/);assert.match(url,/refresh=\d+/);
});

test('overlapping refreshes share one in-flight request',async()=>{
 const s=setup({});let release,fetches=0;
 const gate=new Promise(resolve=>release=resolve);
 s.context.fetch=async()=>{fetches++;await gate;return {ok:true,json:async()=>({quotes:{AAA:{price:94,previousClose:100}}})};};
 const first=s.context.window.refreshStockPrices({force:true});
 const second=s.context.window.refreshStockPrices({force:true});
 assert.equal(fetches,1);release();await Promise.all([first,second]);assert.equal(s.calls.save,1);
});
