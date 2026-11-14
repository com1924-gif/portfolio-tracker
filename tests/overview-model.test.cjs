const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const c=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../overview-model-v2.js'),'utf8'),c);
const api=c.PortfolioOverviewModel;
test('current Value endpoint matches accounting NAV and excludes future history',()=>{
 const input=[{date:'2026-11-15',value:9999},{date:'2026-11-13',value:123},{date:'2026-10-01',value:100}];
 const before=JSON.stringify(input),r=api.currentEndpoint(input,'2026-11-13',155);
 assert.equal(r.length,2);assert.equal(r.at(-1).value,155);assert.equal(r.at(-1).date,'2026-11-13');assert.equal(JSON.stringify(input),before);
});
test('positive opening NAV clips missing early transaction history while zero opening does not',()=>{
 const r=api.coverage('2026-01-01','2026-11-13',[{firstDate:'2026-08-13',anchored:true,openingNav:100},{firstDate:'2026-03-31',anchored:true,openingNav:0}]);
 assert.equal(r.from,'2026-08-13');assert.equal(r.missingOpeningHistory,true);
 const funded=api.coverage('2026-01-01','2026-11-13',[{firstDate:'2026-03-31',anchored:true,openingNav:0}]);
 assert.equal(funded.missingOpeningHistory,false);
 const month=api.coverage('2026-10-13','2026-11-13',[{firstDate:'2026-08-13',anchored:true,openingNav:100}]);
 assert.equal(month.from,'2026-10-13');assert.equal(month.limited,false);
});
test('complete history and portfolios without an anchor retain a recorded-period calculation',()=>{
 const r=api.coverage('2026-01-01','2026-11-13',[{firstDate:'2023-01-01',anchored:true,openingNav:100},{firstDate:'2026-03-01',anchored:false}]);
 assert.equal(r.from,'2026-01-01');assert.equal(r.missingOpeningHistory,false);
});
test('funding on missing quote days is removed once, and market gains compound',()=>{
 const values=[{date:'2026-10-01',value:100},{date:'2026-10-05',value:150},{date:'2026-10-06',value:165}];
 const r=api.performance(values,[{date:'2026-10-03',amount:50}]);
 assert.equal(r[1].value,0);assert.ok(Math.abs(r[2].value-10)<1e-8);
 const out=api.performance([{date:'2026-10-01',value:100},{date:'2026-10-05',value:70}],[{date:'2026-10-05',amount:-30}]);
 assert.equal(out[1].value,0);
});
test('initial funding is already in the first NAV and cannot become a gain',()=>{
 const r=api.performance([{date:'2026-10-01',value:100},{date:'2026-10-02',value:100}],[{date:'2026-10-01',amount:100}]);
 assert.equal(r[1].value,0);
});
