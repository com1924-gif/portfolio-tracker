const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../performance-history-v2.js'),'utf8'),ctx);
const api=ctx.PortfolioPerformanceHistory;
const profile={version:1,enabled:true,method:'broker-linked-estimate',openingAsOf:'2025-12-31',openingNav:100,currency:'USD',flowsCompleteThrough:'2026-01-03',externalFlows:[],anchor:{date:'2026-01-03',nav:110,appNav:111,returnPct:10}};
const history=()=>({version:1,enabled:true,currency:'USD',from:'2026-01-01',through:'2026-01-03',historicalReturnMethod:'modified-dietz',basis:api.basis(profile),points:['2026-01-01','2026-01-02','2026-01-03'].map((date,i)=>({date,nav:100+i*5,quality:i===2?'statement':'estimated',source:'Synthetic source'}))});
const state=()=>({accounts:[{id:'a',name:'Example',performanceProfiles:{2026:structuredClone(profile)}}],transactions:[{accountId:'a',date:'2026-01-02'}],fx:[]});
const pack=()=>({format:'portfolio-performance-history',version:1,portfolios:[{accountId:'a',year:'2026',history:history()}]});
test('daily source-labelled history rejects missing days, duplicates, future data, invalid amounts and unsupported quality',()=>{
 assert.equal(api.validate(history(),'2026').length,0);
 for(const mutate of [h=>h.points.splice(1,1),h=>h.points[1].date=h.points[0].date,h=>h.points[0].nav='100',h=>h.points[0].quality='exact',h=>h.points[0].source='',h=>h.through='2026-02-30']){
  const h=history();mutate(h);assert.ok(api.validate(h,'2026').length);
 }
 assert.ok(api.importErrors(pack(),state(),'2026-01-02').length);
});
test('imports require the same portfolio, opening NAV and reviewed flow basis and reject partial cutover coverage',()=>{
 assert.equal(api.importErrors(pack(),state(),'2026-01-03').length,0);
 for(const mutate of [s=>s.accounts[0].id='other',s=>s.accounts[0].performanceProfiles[2026].enabled=false,s=>s.accounts[0].performanceProfiles[2026].openingNav=999,s=>s.accounts[0].performanceProfiles[2026].externalFlows.push({date:'2026-01-02',amount:20}),s=>s.transactions[0].date='2026-01-04']){
  const s=state();mutate(s);assert.ok(api.importErrors(pack(),s,'2026-01-03').length);
 }
 const p=pack();p.portfolios.push(p.portfolios[0]);assert.ok(api.importErrors(p,state(),'2026-01-03').length);
});
test('broker-linked history is estimated with Dietz before its anchor only with an explicitly enabled valid matching source history',()=>{
 const h=history(),before=JSON.stringify({h,profile});
 assert.equal(api.profileAt(profile,h,'2026-01-02').method,'modified-dietz');
 assert.equal(api.profileAt(profile,h,'2026-01-03'),profile);
 assert.equal(api.profileAt(profile,null,'2026-01-02'),profile);
 h.enabled=false;assert.equal(api.profileAt(profile,h,'2026-01-02'),profile);h.enabled=true;
 h.basis.openingNav=999;assert.equal(api.profileAt(profile,h,'2026-01-02'),profile);
 h.basis.openingNav=100;assert.equal(JSON.stringify({h,profile}),before);
});
test('validating and selecting history never mutates financial state or profiles',()=>{
 const s=state(),p=pack(),before=JSON.stringify({s,p,profile});
 api.importErrors(p,s,'2026-01-03');api.profileAt(profile,p.portfolios[0].history,'2026-01-02');
 assert.equal(JSON.stringify({s,p,profile}),before);
});
