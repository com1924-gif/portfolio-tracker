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

test('historical YTD uses the selected NAV and excludes later cash flows',()=>{
 const p=profile({externalFlows:[{id:'later',date:'2024-02-19',amount:50}]});
 const before=JSON.stringify(p),r=api.calculateHistorical(p,2024,'2024-01-31',110);
 assert.equal(r.ok,true);approx(r.endNav,110);approx(r.profit,10);approx(r.returnPct,10);assert.equal(JSON.stringify(p),before);
});
test('fixed NAV snapshots cannot be presented as YTD for another historical date',()=>{
 const p=profile({navSource:'snapshot',navSnapshot:{date:'2024-03-01',amount:150}});
 assert.equal(api.calculateHistorical(p,2024,'2024-02-01',999).ok,false);
 const r=api.calculateHistorical(p,2024,'2024-03-01',999);assert.equal(r.ok,true);approx(r.endNav,150);approx(r.profit,50);
});
test('broker-linked historical YTD cannot be backcast before its return anchor',()=>{
 const p=linkedProfile();assert.equal(api.calculateHistorical(p,2024,'2024-02-18',999,source()).ok,false);
 const r=api.calculateHistorical(p,2024,p.anchor.date,999,source());assert.equal(r.ok,true);approx(r.returnPct,p.anchor.returnPct);
});

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

test('dated brokerage NAV metadata must use a valid date and amount',()=>{
  assert.equal(api.validate(profile({navSource:'snapshot',navSnapshot:{date:'2024-02-30',amount:160}}),2024).length>0,true);
  assert.equal(api.validate(profile({navSource:'snapshot',navSnapshot:{date:'2024-04-01',amount:''}}),2024).length>0,true);
  assert.equal(api.validate(profile({navSource:'snapshot',navSnapshot:{date:'2024-04-01',amount:0}}),2024).length,0);
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
  const state={settings:{fx:{USD:7.8}},accounts:[{id:'one',performanceProfiles:{2024:profile({automaticFlowsAfter:'2024-02-19'}),2025:{...linkedProfile(),anchor:{date:'2025-02-19',nav:100,appNav:90,returnPct:25},openingAsOf:'2024-12-31',flowsCompleteThrough:'2025-02-19'}}}],assets:[],transactions:[],fx:[]};
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

function linkedProfile(overrides={}){return profile({method:'broker-linked-estimate',openingNav:80,navSource:'app',
  anchor:{date:'2024-02-19',nav:100,appNav:90,returnPct:25},flowsCompleteThrough:'2024-02-19',...overrides});}
const source=(transactions=[],overrides={})=>({accountId:'one',transactions,rates:{USD:1,EUR:2},...overrides});
const cash=(id,date,amount,type='Deposit',other={})=>({id,accountId:'one',type,date,amount,currency:'USD',...other});

test('broker-linked anchor compounds later gain and preserves one-time NAV alignment',()=>{
  const p=linkedProfile(),s=source(),before=JSON.stringify({p,s});
  const r=api.calculate(p,2024,'2024-04-09',100,s);
  assert.equal(r.ok,true);approx(r.navAdjustment,10);approx(r.endNav,110);approx(r.periodProfit,10);
  approx(r.periodReturnPct,10);approx(r.returnPct,37.5);approx(r.profit,30);
  assert.equal(JSON.stringify({p,s}),before,'calculation changed accounting or profile');
  const atAnchor=api.calculate(p,2024,'2024-02-19',999,s);approx(atAnchor.returnPct,25);approx(atAnchor.endNav,100);
});
test('later deposits and withdrawals are automatic and never create investment gains',()=>{
  for(const [type,amount,end] of [['Deposit',50,140],['Withdrawal',30,60]]){
    const r=api.calculate(linkedProfile(),2024,'2024-04-09',end,source([cash('new','2024-03-15',amount,type)]));
    assert.equal(r.ok,true);approx(r.returnPct,25);approx(r.periodProfit,0);assert.equal(r.autoFlowCount,1);
  }
  const s=source([cash('new','2024-03-15',50)]);
  const r=api.calculate(linkedProfile(),2024,'2024-04-09',150,s);
  approx(r.periodDenominator,125);approx(r.periodReturnPct,8);approx(r.returnPct,35);
});
test('anchor-day, older, future and other-account transactions cannot be counted twice',()=>{
  const p=linkedProfile({externalFlows:[{id:'historical',date:'2024-02-19',amount:20}]}),s=source([
    cash('before','2024-01-01',200),cash('anchor','2024-02-19',20),cash('later','2024-05-01',200),
    cash('other','2024-03-15',200,'Deposit',{accountId:'two'})]);
  const r=api.calculate(p,2024,'2024-04-09',90,s);approx(r.netFlows,20);assert.equal(r.autoFlowCount,0);approx(r.returnPct,25);
});
test('trades, retained dividends, fees, interest and FX are excluded from automatic external flows',()=>{
  const txs=['Buy','Sell','Dividend','Fee','Interest','Tax','Margin Interest','FX'].map(type=>cash(type,'2024-03-15',100,type));
  const r=api.calculate(linkedProfile(),2024,'2024-04-09',90,source(txs));
  assert.equal(r.autoFlowCount,0);approx(r.returnPct,25);
});
test('foreign-currency automatic flows use available FX and fail explicitly when unavailable',()=>{
  const txs=[cash('foreign','2024-03-15',10,'Deposit',{currency:'EUR'})];
  const r=api.calculate(linkedProfile(),2024,'2024-04-09',110,source(txs));
  approx(r.netFlows,20);approx(r.returnPct,25);assert.equal(r.foreignFlows,true);
  assert.equal(api.calculate(linkedProfile(),2024,'2024-04-09',110,source(txs,{rates:{USD:1}})).ok,false);
  assert.equal(api.calculate(linkedProfile(),2024,'2024-04-09',110,source(txs,{rates:{USD:-1,EUR:-2}})).ok,false);
});
test('linked settings reject overlapping manual flows, invalid anchors and missing transaction access',()=>{
  const bad=[{externalFlows:[{id:'overlap',date:'2024-03-15',amount:5}]},
    {anchor:{date:'2024-02-30',nav:100,appNav:90,returnPct:25}},
    {anchor:{date:'2024-02-19',nav:0,appNav:90,returnPct:25}},
    {anchor:{date:'2024-02-19',nav:100,appNav:'',returnPct:25}},
    {anchor:{date:'2024-02-19',nav:100,appNav:90,returnPct:-101}},
    {externalFlows:{}},{navSource:'snapshot',navSnapshot:{date:'2024-03-01',amount:100}}];
  for(const override of bad)assert.equal(api.calculate(linkedProfile(override),2024,'2024-04-09',100,source()).ok,false);
  assert.equal(api.calculate(linkedProfile(),2024,'2024-04-09',100).ok,false);
  assert.equal(api.calculate(linkedProfile(),2024,'2024-01-01',100,source()).ok,false);
  assert.equal(api.calculate(linkedProfile(),2024,'2024-04-09',100,source([cash('bad','2024-03-15',-5)])).ok,false);
  assert.equal(api.calculate(linkedProfile(),2024,'2024-04-09',100,source([cash('same','2024-03-15',1),cash('same','2024-03-16',1)])).ok,false);
});
test('nonpositive capital after the anchor suppresses only the return percentage',()=>{
  const r=api.calculate(linkedProfile(),2024,'2024-04-09',-110,source([cash('out','2024-02-20',200,'Withdrawal')]));
  assert.equal(r.ok,true);assert.equal(r.returnPct,null);approx(r.periodProfit,0);
});
test('mixed-method aggregate uses combined NAV and flows rather than brokerage percentages',()=>{
  const linked=linkedProfile(),records=[{id:'one',profile:linked,endNav:100,source:source()},
    {id:'two',profile:profile({openingNav:120}),endNav:120}];
  const r=api.aggregate(records,2024,'2024-04-09');assert.equal(r.ok,true);approx(r.profit,30);approx(r.returnPct,15);assert.equal(r.linkedCount,1);
  approx(r.rawAppNav,220);approx(r.navAdjustment,10);approx(r.endNav,r.rawAppNav+r.navAdjustment);
  const changed=api.aggregate([{...records[0],profile:{...linked,anchor:{...linked.anchor,returnPct:80}}},records[1]],2024,'2024-04-09');
  approx(changed.returnPct,r.returnPct,'group averaged individual returns');
});
test('automatic transfer notes cancel only matched flows inside the aggregate',()=>{
  const a=linkedProfile({autoFlowTransfers:{out:{counterpartyId:'two',transferId:'pair'}}}),
    b=linkedProfile({autoFlowTransfers:{in:{counterpartyId:'one',transferId:'pair'}}});
  const records=[{id:'one',profile:a,endNav:70,source:source([cash('out','2024-03-15',20,'Withdrawal')])},
    {id:'two',profile:b,endNav:110,source:source([cash('in','2024-03-15',20,'Deposit',{accountId:'two'})],{accountId:'two'})}];
  const before=JSON.stringify(records),r=api.aggregate(records,2024,'2024-04-09');
  assert.equal(r.ok,true);approx(r.netFlows,0);assert.equal(r.internalTransferPairs,1);assert.equal(JSON.stringify(records),before);
  records[1].source.transactions[0].date='2024-03-16';assert.equal(api.aggregate(records,2024,'2024-04-09').ok,false);
});

test('optional Dietz automatic flows exclude initialization and replace only later cash flows',()=>{
  const p=profile({automaticFlowsAfter:'2024-02-19',flowsCompleteThrough:'2024-02-19',externalFlows:[{id:'verified',date:'2024-01-10',amount:20}]}),
    s=source([cash('old','2024-01-10',900),cash('cutoff','2024-02-19',800),cash('new','2024-03-15',50),
      cash('withdraw','2024-03-20',10,'Withdrawal'),cash('future','2024-05-01',100),cash('other','2024-03-15',100,'Deposit',{accountId:'two'}),
      ...['Buy','Sell','Dividend','Interest','Margin Interest','Tax','Fee','FX'].map(type=>cash(type,'2024-03-15',999,type))]);
  const before=JSON.stringify({p,s}),r=api.calculate(p,2024,'2024-04-09',170,s);
  const expected=api.calculate(profile({externalFlows:[...p.externalFlows,{id:'new',date:'2024-03-15',amount:50},{id:'out',date:'2024-03-20',amount:-10}]}),2024,'2024-04-09',170);
  assert.equal(r.ok,true);approx(r.netFlows,60);approx(r.profit,10);approx(r.returnPct,expected.returnPct);assert.equal(r.autoFlowCount,2);assert.equal(r.staleFlows,false);
  assert.equal(JSON.stringify({p,s}),before);
  const manual=api.calculate(profile({externalFlows:p.externalFlows}),2024,'2024-04-09',170,s);approx(manual.netFlows,20);assert.equal(manual.autoFlowCount,undefined);
  approx(api.calculate(p,2024,'2024-02-19',120,s).profit,0);
});
test('Dietz automatic deposits and withdrawals change capital without creating investment profit',()=>{
  const p=profile({automaticFlowsAfter:'2024-02-19',flowsCompleteThrough:'2024-02-19'});
  for(const [type,amount,end] of [['Deposit',50,150],['Withdrawal',30,70]]){
    const r=api.calculate(p,2024,'2024-04-09',end,source([cash(type,'2024-03-15',amount,type)]));
    assert.equal(r.ok,true);approx(r.profit,0);approx(r.returnPct,0);
  }
  const foreign=api.calculate(p,2024,'2024-04-09',120,source([cash('foreign','2024-03-15',10,'Deposit',{currency:'EUR'})]));
  approx(foreign.netFlows,20);assert.equal(foreign.foreignFlows,true);
  assert.equal(api.calculate(p,2024,'2024-04-09',120,source([cash('foreign','2024-03-15',10,'Deposit',{currency:'EUR'})],{rates:{USD:1}})).ok,false);
});
test('Dietz automatic settings reject overlaps, invalid cutoffs and missing transaction context',()=>{
  const p=profile({automaticFlowsAfter:'2024-02-19',flowsCompleteThrough:'2024-02-19'});
  for(const override of [{automaticFlowsAfter:''},{automaticFlowsAfter:'2024-02-30'},{automaticFlowsAfter:'2023-12-30'},
    {flowsCompleteThrough:'2024-02-18'},{externalFlows:[{id:'overlap',date:'2024-02-20',amount:1}]}]){
    assert.equal(api.calculate({...p,...override},2024,'2024-04-09',100,source()).ok,false);
  }
  assert.equal(api.calculate(p,2024,'2024-04-09',100).ok,false);
  assert.equal(api.calculate(p,2024,'2024-04-09',100,source([cash('dup','2024-03-15',1),cash('dup','2024-03-16',1)])).ok,false);
  assert.equal(api.calculate(linkedProfile({automaticFlowsAfter:'2024-02-19'}),2024,'2024-04-09',100,source()).ok,false);
  const allYear=profile({automaticFlowsAfter:'2023-12-31',flowsCompleteThrough:'2024-01-01'});
  approx(api.calculate(allYear,2024,'2024-04-09',120,source([cash('jan','2024-01-01',20)])).profit,0);
});
test('Dietz aggregate includes automatic flows and cancels paired transfers without averaging',()=>{
  const a=profile({automaticFlowsAfter:'2024-02-19',flowsCompleteThrough:'2024-02-19',autoFlowTransfers:{out:{counterpartyId:'two',transferId:'pair'}}}),
    b=profile({automaticFlowsAfter:'2024-02-19',flowsCompleteThrough:'2024-02-19',autoFlowTransfers:{in:{counterpartyId:'one',transferId:'pair'}}});
  const records=[{id:'one',profile:a,endNav:90,source:source([cash('out','2024-03-15',20,'Withdrawal')])},
    {id:'two',profile:b,endNav:160,source:source([cash('in','2024-03-15',20,'Deposit',{accountId:'two'}),cash('deposit','2024-03-15',30,'Deposit',{accountId:'two'})],{accountId:'two'})}];
  const before=JSON.stringify(records),r=api.aggregate(records,2024,'2024-04-09');
  assert.equal(r.ok,true);approx(r.netFlows,30);approx(r.profit,20);approx(r.denominator,207.5);assert.equal(r.internalTransferPairs,1);assert.equal(JSON.stringify(records),before);
  records[1].source.transactions[0].date='2024-03-16';assert.equal(api.aggregate(records,2024,'2024-04-09').ok,false);
});
