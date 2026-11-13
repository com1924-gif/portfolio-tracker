const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(require.resolve('../ytd-anchor-v2.js'),'utf8'),context);
const api=context.PortfolioYtdAnchor;
const profile=(overrides={})=>({version:1,enabled:true,method:'modified-dietz',openingAsOf:'2023-12-31',currency:'USD',openingNav:100,
  flowsCompleteThrough:'2024-04-09',externalFlows:[],...overrides});
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('no flows measures NAV change and returns 10 percent',()=>{
  const r=api.calculate(profile(),2024,'2024-04-09',110);assert.equal(r.ok,true);approx(r.profit,10);approx(r.returnPct,10);
});
test('midperiod contribution is weighted by actual calendar days',()=>{
  const p=profile({externalFlows:[{id:'one',date:'2024-02-19',amount:50}]});
  const r=api.calculate(p,2024,'2024-04-09',165);approx(r.denominator,125);approx(r.profit,15);approx(r.returnPct,12);
});
test('withdrawal without investment gain gives zero return',()=>{
  const p=profile({externalFlows:[{id:'out',date:'2024-02-19',amount:-20}]});
  const r=api.calculate(p,2024,'2024-04-09',80);approx(r.profit,0);approx(r.returnPct,0);
});
test('zero opening NAV is valid for a portfolio funded during the year',()=>{
  const p=profile({openingNav:0,externalFlows:[{id:'new',date:'2024-02-19',amount:100}]});
  const r=api.calculate(p,2024,'2024-04-09',110);assert.equal(r.ok,true);approx(r.denominator,50);approx(r.returnPct,20);
});
test('zero/negative denominator produces unavailable rate without inventing zero profit',()=>{
  const r=api.calculate(profile({openingNav:0}),2024,'2024-04-09',5);assert.equal(r.returnPct,null);approx(r.profit,5);
});
test('blank values, impossible dates and duplicate IDs remain explicit errors',()=>{
  assert.equal(api.calculate(profile({openingNav:''}),2024,'2024-04-09',110).ok,false);
  assert.equal(api.calculate(profile({externalFlows:[{id:'bad',date:'2024-02-30',amount:1}]}),2024,'2024-04-09',110).ok,false);
  assert.equal(api.calculate(profile({externalFlows:[{id:'same',date:'2024-01-01',amount:1},{id:'same',date:'2024-01-02',amount:2}]}),2024,'2024-04-09',110).ok,false);
  assert.equal(api.calculate(profile({externalFlows:{}}),2024,'2024-04-09',110).ok,false);
  assert.equal(api.calculate(profile({externalFlows:[null]}),2024,'2024-04-09',110).ok,false);
  assert.equal(api.aggregate([{id:'bad',profile:null,endNav:110}],2024,'2024-04-09').ok,false);
});
test('later dated actual flows do not affect an earlier valuation',()=>{
  const p=profile({externalFlows:[{id:'later',date:'2024-05-01',amount:100}]});approx(api.calculate(p,2024,'2024-04-09',110).profit,10);
});
test('aggregate cancels paired internal transfers and calculates from combined NAV',()=>{
  const a=profile({externalFlows:[{id:'a',date:'2024-02-19',amount:-50,counterpartyId:'b',transferId:'move'}]});
  const b=profile({externalFlows:[{id:'b',date:'2024-02-19',amount:50,counterpartyId:'a',transferId:'move'}]});
  const r=api.aggregate([{id:'a',profile:a,endNav:110},{id:'b',profile:b,endNav:150}],2024,'2024-04-09');
  assert.equal(r.ok,true);approx(r.profit,60);approx(r.returnPct,30);assert.equal(r.internalTransferPairs,1);
});
test('unmatched and cross-date transfers do not silently distort group return',()=>{
  const a=profile({externalFlows:[{id:'a',date:'2024-02-19',amount:-50,counterpartyId:'b',transferId:'move'}]});
  const b=profile({externalFlows:[{id:'b',date:'2024-02-20',amount:50,counterpartyId:'a',transferId:'move'}]});
  assert.equal(api.aggregate([{id:'a',profile:a,endNav:110},{id:'b',profile:b,endNav:150}],2024,'2024-04-09').ok,false);
});
test('a transfer crossing the selected group boundary remains an external flow',()=>{
  const a=profile({externalFlows:[{id:'a',date:'2024-02-19',amount:-50,counterpartyId:'outside',transferId:'move'}]});
  const r=api.aggregate([{id:'a',profile:a,endNav:50}],2024,'2024-04-09');assert.equal(r.ok,true);approx(r.profit,0);approx(r.netFlows,-50);
});
test('mixed currencies and duplicate accounts cannot be aggregated',()=>{
  assert.equal(api.aggregate([{id:'a',profile:profile(),endNav:110},{id:'b',profile:profile({currency:'EUR'}),endNav:110}],2024,'2024-04-09').ok,false);
  assert.equal(api.aggregate([{id:'a',profile:profile(),endNav:110},{id:'a',profile:profile(),endNav:110}],2024,'2024-04-09').ok,false);
});
test('calculating and aggregating never mutate supplied state',()=>{
  const records=[{id:'a',profile:profile(),endNav:110}];const before=JSON.stringify(records);
  api.aggregate(records,2024,'2024-04-09');api.calculate(records[0].profile,2024,'2024-04-09',110);assert.equal(JSON.stringify(records),before);
});

test('existing cloud encryption and load/backup normalizers preserve optional profiles',async()=>{
  const {webcrypto}=require('node:crypto');
  const source=fs.readFileSync(require.resolve('../sync-v225.js'),'utf8');
  const cryptoSource=source.slice(source.indexOf('  function bytesToB64(bytes)'),source.indexOf('  async function api('));
  const normalize=source.match(/  function normalizeLoadedState\(s\)\{[\s\S]*?\n  \}/)[0];
  const backup=source.match(/  function validateBackupState\(candidate\)\{[\s\S]*?\n  \}/)[0];
  const ctx=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')});
  vm.runInContext(cryptoSource+normalize+backup,ctx);
  const state={settings:{fx:{USD:7.8}},accounts:[{id:'one',performanceProfiles:{2024:profile()}}],assets:[],transactions:[],fx:[]};
  const key='synthetic-key-a-'.padEnd(43,'a'),other='synthetic-key-b-'.padEnd(43,'b');
  const encrypted=await ctx.encryptState(key,state);
  assert.ok(!JSON.stringify(encrypted).includes('openingNav'));
  const roundtrip=ctx.normalizeLoadedState(await ctx.decryptState(key,encrypted));
  assert.equal(JSON.stringify(roundtrip.accounts),JSON.stringify(state.accounts));
  assert.equal(JSON.stringify(ctx.validateBackupState({state}).accounts),JSON.stringify(state.accounts));
  await assert.rejects(ctx.decryptState(other,encrypted));
  const legacy=ctx.normalizeLoadedState({accounts:[{id:'old'}]});
  assert.equal(legacy.accounts[0].performanceProfiles,undefined);
});
