import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {webcrypto,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const repo=process.cwd();
const baseline=process.env.YTD_BASE_SHA||'7fe210776a721f4003a8d25ba6e954ab20e6ff6d';
const output=path.join(repo,'test-results');
await fs.mkdir(output,{recursive:true});
const fixed='2026-11-13T10:00:00.000Z';
const fixture={settings:{baseCurrency:'HKD',fx:{HKD:1,USD:7.8,KRW:0.0056,EUR:8.5}},
 accounts:[{id:'one',name:'Example Portfolio A',capitalConfigured:true,capitalCurrency:'HKD',netContributions:780},{id:'two',name:'Example Portfolio B'}],
 assets:[{id:'asset_a',accountId:'one',type:'stock',symbol:'AAA',name:'Example A',currency:'USD',price:12,previousClose:11,multiplier:1},
 {id:'asset_b',accountId:'two',type:'stock',symbol:'BBB',name:'Example B',currency:'USD',price:6,previousClose:5,multiplier:1}],
 transactions:[{id:'d1',accountId:'one',type:'Deposit',currency:'HKD',amount:780,date:'2026-01-10'},
 {id:'b1',accountId:'one',assetId:'asset_a',type:'Buy',currency:'USD',qty:10,price:10,fee:1,date:'2026-01-11'},
 {id:'d2',accountId:'two',type:'Deposit',currency:'USD',amount:100,date:'2026-01-10'},
 {id:'b2',accountId:'two',assetId:'asset_b',type:'Buy',currency:'USD',qty:10,price:5,fee:1,date:'2026-01-11'}],fx:[]};
const keyA='synthetic-a-'.padEnd(43,'a'),keyB='synthetic-b-'.padEnd(43,'b');
async function aesKey(key){const hash=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('portfolio-sync-encryption:'+key));return webcrypto.subtle.importKey('raw',hash,{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function encrypt(key,state){const iv=webcrypto.getRandomValues(new Uint8Array(12)),data=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(key),new TextEncoder().encode(JSON.stringify(state)));return {v:1,iv:Buffer.from(iv).toString('base64'),data:Buffer.from(data).toString('base64')};}
async function decrypt(key,p){return JSON.parse(new TextDecoder().decode(await webcrypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(p.iv,'base64')},await aesKey(key),Buffer.from(p.data,'base64'))));}
const docs=new Map([[keyA,{found:true,payload:await encrypt(keyA,fixture),updated_at:'2026-11-13T09:00:00.000Z'}],[keyB,{found:true,payload:await encrypt(keyB,fixture),updated_at:'2026-11-13T09:00:00.000Z'}]]);
const untouchedB=JSON.stringify(docs.get(keyB));let revision=0;
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),parts=url.pathname.split('/').filter(Boolean),variant=parts.shift(),rel=parts.join('/')||'index.html';
 if(!['base','new'].includes(variant)||rel.includes('..')){res.writeHead(404).end();return;}
 let data;if(variant==='base')data=execFileSync('git',['show',baseline+':'+rel],{cwd:repo});else data=await fs.readFile(path.join(repo,rel));
 const ext=path.extname(rel);res.setHeader('Content-Type',ext==='.html'?'text/html':ext==='.js'?'text/javascript':ext==='.css'?'text/css':'application/json');res.end(data);
}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const contexts=[];const errors=[];
const history={};for(const [s,start,end] of [['AAA',10,12],['BBB',5,6],['VOO',100,110],['QQQ',200,220]])history[s]=[{date:'2025-12-31',close:start,adjClose:start},{date:'2026-01-02',close:start,adjClose:start},{date:'2026-01-12',close:start,adjClose:start},{date:'2026-11-13',close:end,adjClose:end}];
async function makePage(variant,{syncKey=null,mobile=false,initialState=fixture,historyDelay=0,failHistory=false}={}){
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1200,height:1000},acceptDownloads:true});contexts.push(ctx);
 await ctx.addInitScript(({fixture,syncKey,fixed})=>{
  const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return new RealDate(fixed).getTime();}};
  localStorage.setItem('portfolioTrackerV2',JSON.stringify(fixture));if(syncKey)localStorage.setItem('portfolioTrackerSyncKeyV1',syncKey);
 },{fixture:initialState,syncKey,fixed});
 await ctx.route('**/*',async route=>{
  const req=route.request(),url=req.url();if(url.startsWith(origin)){await route.continue();return;}
  if(url.includes('supabase.co/functions/v1/portfolio-sync')){
   const key=req.headers()['x-sync-key'];
   if(req.method()==='PUT'){
    const body=req.postDataJSON(),old=docs.get(key);
    if(body.expected_updated_at&&old&&body.expected_updated_at!==old.updated_at){await route.fulfill({status:409,json:{error:'conflict'}});return;}
    const updated_at=`2026-11-13T10:00:${String(++revision).padStart(2,'0')}.000Z`;
    docs.set(key,{found:true,payload:body.payload,updated_at});await route.fulfill({json:{ok:true,updated_at}});return;
   }
   await route.fulfill({json:docs.get(key)||{found:false}});return;
  }
  if(url.includes('mode=history')){
   if(historyDelay)await new Promise(resolve=>setTimeout(resolve,historyDelay));
   if(failHistory){await route.fulfill({status:503,json:{error:'synthetic history outage'}});return;}
  }
  await route.fulfill({json:{quotes:{AAA:{price:12,previousClose:11,name:'Example A',currency:'USD'},BBB:{price:6,previousClose:5,name:'Example B',currency:'USD'},VOO:{price:110,previousClose:109},QQQ:{price:220,previousClose:218}},history,fx:{HKD:1,USD:7.8,KRW:0.0056,EUR:8.5},updatedAt:fixed}});
 });
 const page=await ctx.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('Browser runtime error:',e.message);});page.on('dialog',d=>d.accept());
 await page.goto(origin+'/'+variant+'/index.html');await page.waitForSelector('body.app-ready');await page.waitForTimeout(1200);return page;
}
const accounting=page=>page.evaluate(()=>JSON.stringify({transactions:state.transactions,fx:state.fx,holdings:holdingsFor(),positions:positionsFor(),cash:cashBalancesFor(),summary:summaryFor()}));
const allState=page=>page.evaluate(()=>JSON.stringify(state));
async function performance(page,id='one'){await page.evaluate(id=>openPortfolio(id),id);await page.locator('[data-tab="performance"]').click();await page.waitForTimeout(400);}
async function setProfile(page,on=true){
 await page.locator('#ytdSettingsBtn').click();await page.locator('#ytdEnabled').setChecked(on);
 if(on){await page.locator('#ytdCurrency').selectOption('USD');await page.locator('#ytdNavSource').selectOption('app');await page.locator('#ytdOpening').fill('100');await page.locator('#ytdSource').fill('Synthetic verification');
  if(await page.locator('#ytdFlows .ytd-flow').count()===0){await page.locator('#ytdAddFlow').click();await page.locator('.ytd-date').fill('2026-05-01');await page.locator('.ytd-amount').fill('50');}
 }
 await page.locator('#ytdSave').click();await page.waitForTimeout(250);
}
async function setLinkedProfile(page){
 await page.locator('#ytdSettingsBtn').click();await page.locator('#ytdEnabled').check();
 await page.locator('#ytdCurrency').selectOption('USD');await page.locator('#ytdMethod').selectOption('broker-linked-estimate');
 await page.locator('#ytdOpening').fill('0');await page.locator('#ytdAnchorDate').fill('2026-11-12');await page.locator('#ytdAnchorDate').dispatchEvent('change');
 await page.locator('#ytdAnchorReturn').fill('25');await page.locator('#ytdAnchorNav').fill('100');await page.locator('#ytdAppAnchorNav').fill('119');
 await page.locator('#ytdReviewed').fill('2026-11-12');
 await page.locator('#ytdFlows .ytd-remove').evaluateAll(buttons=>buttons.forEach(b=>b.click()));
 await page.locator('#ytdAddFlow').click();await page.locator('#ytdFlows .ytd-date').fill('2026-01-10');await page.locator('#ytdFlows .ytd-amount').fill('100');
 assert.equal(await page.locator('#ytdCaptureNav').isDisabled(),true,'past anchor used today’s app NAV');
 await page.locator('#ytdSave').click();await page.waitForTimeout(250);
 assert.equal(await page.locator('#ytdModal').isVisible(),false,'linked editor did not save');
}
try{
 const base=await makePage('base'),modern=await makePage('new');
 assert.equal(await allState(modern),await allState(base),'startup state changed without opt-in');
 assert.equal(await accounting(modern),await accounting(base),'legacy accounting differs');
 await performance(base);await performance(modern);
 const legacyLegend=await base.locator('#benchmarkLegend').innerText();
 assert.equal(await modern.locator('#benchmarkLegend').innerText(),legacyLegend,'default performance differs');
 assert.equal(await modern.evaluate(()=>state.accounts.some(a=>a.performanceProfiles!==undefined)),false);
 const before=await accounting(modern),otherBefore=await modern.evaluate(()=>JSON.stringify(state.accounts[1]));
 await setProfile(modern);
 await modern.waitForFunction(()=>document.querySelector('#benchmarkChart')?.textContent.includes('YTD investment P/L'));
 assert.equal(await accounting(modern),before,'accounting changed after enabling profile');
 assert.equal(await modern.evaluate(()=>JSON.stringify(state.accounts[1])),otherBefore,'another portfolio was changed');
 const result=await modern.evaluate(()=>PortfolioYtdAnchor.resultFor('one'));
 assert.ok(Math.abs(result.profit-(-31))<1e-8,'manual flow was not exclusive of transaction deposits');
 const rate=result.returnPct;
 await modern.locator('#portfolioCurrency').selectOption('USD');await modern.waitForTimeout(250);
 assert.ok(Math.abs((await modern.evaluate(()=>PortfolioYtdAnchor.resultFor('one'))).returnPct-rate)<1e-8,'display currency changed anchored rate');
 await modern.locator('#portfolioCurrency').selectOption('HKD');await modern.waitForTimeout(250);
 await modern.locator('#ytdSettingsBtn').click();await modern.locator('#ytdNavSource').selectOption('snapshot');await modern.locator('#ytdNavDate').fill('2026-11-12');await modern.locator('#ytdNavAmount').fill('160');await modern.locator('#ytdSave').click();await modern.waitForTimeout(250);
 const snapshot=await modern.evaluate(()=>PortfolioYtdAnchor.resultFor('one'));assert.equal(snapshot.asOf,'2026-11-12');assert.equal(snapshot.profit,10);assert.equal(await accounting(modern),before,'snapshot modified accounting');
 await modern.evaluate(()=>goHome());await modern.locator('.overall-return-tab[data-mode="performance"]').click();await modern.locator('.overall-return-period[data-period="YTD"]').click();
 assert.match(await modern.locator('#overallReturnLabel').innerText(),/Enabled portfolios only/);
 assert.match(await modern.locator('#overallReturnSub').innerText(),/1\/2/);
 await performance(modern,'two');await setProfile(modern);await modern.evaluate(()=>goHome());await modern.waitForTimeout(300);
 assert.match(await modern.locator('#overallReturnChart').innerText(),/same NAV valuation date/,'aggregate mixed snapshot/current dates');
 await performance(modern,'two');await setProfile(modern,false);
 await performance(modern);await setProfile(modern,false);await modern.waitForTimeout(400);
 assert.equal(await modern.locator('#benchmarkLegend').innerText(),legacyLegend,'disabling did not restore legacy performance');
 assert.equal(await accounting(modern),await accounting(base),'accounting differs after disabling');
 console.log('PASS: legacy startup/state/output equality; opt-in; accounting unchanged; flow source exclusivity; currency invariance; coverage; disable.');

 const linked=await makePage('new');await performance(linked);const linkedBefore=await accounting(linked),otherLinkedBefore=await linked.evaluate(()=>JSON.stringify(state.accounts[1]));
 await setLinkedProfile(linked);
 assert.equal(await accounting(linked),linkedBefore,'linked profile changed accounting');
 let linkedResult=await linked.evaluate(()=>PortfolioYtdAnchor.resultFor('one'));
 assert.ok(Math.abs(linkedResult.returnPct-25)<1e-8);assert.ok(Math.abs(linkedResult.navAdjustment+19)<1e-8);
 assert.match(await linked.locator('#benchmarkLegend').innerText(),/Broker-linked estimate/);
 await linked.evaluate(()=>{state.transactions.push({id:'new-deposit',accountId:'one',type:'Deposit',currency:'USD',amount:50,date:'2026-11-13'});save();renderAll();});
 linkedResult=await linked.evaluate(()=>PortfolioYtdAnchor.resultFor('one'));assert.equal(linkedResult.autoFlowCount,1);assert.ok(Math.abs(linkedResult.returnPct-25)<1e-8,'new deposit became a gain');
 await linked.evaluate(()=>{state.transactions.push({id:'new-sale',accountId:'one',assetId:'asset_a',type:'Sell',currency:'USD',qty:5,price:12,fee:0,date:'2026-11-13'});save();renderAll();});
 assert.ok(Math.abs((await linked.evaluate(()=>PortfolioYtdAnchor.resultFor('one'))).returnPct-25)<1e-8,'sale became an external contribution');
 await linked.evaluate(()=>{state.assets[0].price=13;save();renderAll();});
 assert.ok(Math.abs((await linked.evaluate(()=>PortfolioYtdAnchor.resultFor('one'))).returnPct-31.25)<1e-8,'market gain did not update automatically');
 await linked.locator('#portfolioCurrency').selectOption('USD');await linked.waitForTimeout(150);
 assert.ok(Math.abs((await linked.evaluate(()=>PortfolioYtdAnchor.resultFor('one'))).returnPct-31.25)<1e-8,'linked return changed with display currency');
 const linkedTxBefore=await linked.evaluate(()=>JSON.stringify(state.transactions));
 await linked.locator('#ytdSettingsBtn').click();assert.equal(await linked.locator('#ytdAutoFlows .ytd-flow').count(),1);
 assert.equal(await linked.locator('#ytdAutoFlows .ytd-amount').isDisabled(),true);
 await linked.locator('#ytdAutoFlows .ytd-counterparty').selectOption('two');await linked.locator('#ytdAutoFlows .ytd-transfer').fill('synthetic-transfer');await linked.locator('#ytdSave').click();
 assert.equal(await linked.evaluate(()=>JSON.stringify(state.transactions)),linkedTxBefore,'transfer matching changed transactions');
 assert.equal(await linked.evaluate(()=>JSON.stringify(state.accounts[1])),otherLinkedBefore,'linked settings changed another portfolio');
 await linked.evaluate(()=>goHome());await linked.locator('.overall-return-tab[data-mode="performance"]').click();await linked.locator('.overall-return-period[data-period="YTD"]').click();
 await linked.locator('#overallReturnPanel .overall-return-body > details > summary').click();
 assert.match(await linked.locator('#overallReturnNote').innerText(),/percentages are not averaged/);
 console.log('PASS: automatic continuation, no NAV alignment gain, later deposit, sale neutrality, market gain, currency invariance and transfer notes without transaction edits.');

 const automatic=await makePage('new');await performance(automatic);await setProfile(automatic);
 const automaticBefore=await accounting(automatic),otherAutomaticBefore=await automatic.evaluate(()=>JSON.stringify(state.accounts[1]));
 await automatic.locator('#ytdSettingsBtn').click();await automatic.locator('#ytdAutomaticEnabled').check();
 await automatic.locator('#ytdAutomaticAfter').fill('2026-11-12');await automatic.locator('#ytdAutomaticAfter').dispatchEvent('change');
 await automatic.locator('#ytdReviewed').fill('2026-11-12');await automatic.locator('#ytdSave').click();
 assert.equal(await automatic.locator('#ytdModal').isVisible(),false,'automatic Dietz settings did not save');
 assert.equal(await accounting(automatic),automaticBefore,'automatic Dietz changed accounting');
 const automaticStart=await automatic.evaluate(()=>PortfolioYtdAnchor.resultFor('one'));
 assert.ok(Math.abs(automaticStart.profit+31)<1e-8);assert.equal(automaticStart.autoFlowCount,0);assert.equal(automaticStart.staleFlows,false);
 await automatic.evaluate(()=>{state.transactions.push({id:'auto-deposit',accountId:'one',type:'Deposit',currency:'USD',amount:40,date:'2026-11-13'});save();renderAll();});
 let automaticResult=await automatic.evaluate(()=>PortfolioYtdAnchor.resultFor('one'));
 assert.equal(automaticResult.autoFlowCount,1);assert.ok(Math.abs(automaticResult.returnPct-automaticStart.returnPct)<1e-8,'new deposit became a Dietz gain');
 await automatic.evaluate(()=>{state.transactions.push({id:'auto-withdrawal',accountId:'one',type:'Withdrawal',currency:'USD',amount:10,date:'2026-11-13'});state.assets[0].price=13;save();renderAll();});
 automaticResult=await automatic.evaluate(()=>PortfolioYtdAnchor.resultFor('one'));assert.equal(automaticResult.autoFlowCount,2);assert.ok(Math.abs(automaticResult.profit+21)<1e-8);
 await automatic.locator('#portfolioCurrency').selectOption('USD');
 assert.ok(Math.abs((await automatic.evaluate(()=>PortfolioYtdAnchor.resultFor('one'))).returnPct-automaticResult.returnPct)<1e-8);
 await automatic.locator('#ytdSettingsBtn').click();assert.equal(await automatic.locator('#ytdAutomaticEnabled').isChecked(),true);
 assert.equal(await automatic.locator('#ytdAutomaticAfter').inputValue(),'2026-11-12');assert.equal(await automatic.locator('#ytdAutoFlows .ytd-flow').count(),2);
 assert.equal(await automatic.locator('#ytdAutoFlows .ytd-amount').first().isDisabled(),true);
 const autoTx=await automatic.evaluate(()=>JSON.stringify(state.transactions));
 await automatic.locator('#ytdAutoFlows .ytd-counterparty').first().selectOption('two');await automatic.locator('#ytdAutoFlows .ytd-transfer').first().fill('automatic-transfer');await automatic.locator('#ytdSave').click();
 assert.equal(await automatic.evaluate(()=>JSON.stringify(state.transactions)),autoTx);assert.equal(await automatic.evaluate(()=>JSON.stringify(state.accounts[1])),otherAutomaticBefore);
 await automatic.locator('#ytdSettingsBtn').click();await automatic.locator('#ytdAutomaticEnabled').uncheck();await automatic.locator('#ytdSave').click();
 assert.equal(await automatic.evaluate(()=>PortfolioYtdAnchor.resultFor('one').autoFlowCount),undefined);
 console.log('PASS: optional Dietz cutoff, initialization exclusion, later deposit/withdrawal, live NAV, currency, editor round trip, read-only transfer annotations and disable.');

 const baselineMobile=await makePage('base',{mobile:true});await performance(baselineMobile);
 const baselineWidth=await baselineMobile.evaluate(()=>document.documentElement.scrollWidth);
 const mobile=await makePage('new',{mobile:true});await performance(mobile);await mobile.locator('#ytdSettingsBtn').click();await mobile.locator('#ytdEnabled').check();await mobile.locator('#ytdOpening').fill('0');await mobile.locator('#ytdAddFlow').click();
 await mobile.locator('.ytd-date').fill('2026-05-01');await mobile.locator('.ytd-amount').fill('100');
 await mobile.screenshot({path:path.join(output,'ytd-mobile-editor.png'),fullPage:true});
 const widths=await mobile.evaluate(()=>({screen:innerWidth,scroll:document.documentElement.scrollWidth,editor:document.querySelector('.ytd-editor').getBoundingClientRect().width}));
 assert.ok(widths.scroll<=baselineWidth+1,'new horizontal overflow: '+JSON.stringify({baselineWidth,...widths}));assert.ok(widths.editor<=widths.screen+1,'YTD editor wider than viewport');
 await mobile.locator('#ytdSave').click();assert.equal(await mobile.evaluate(()=>PortfolioYtdAnchor.resultFor('one').ok),true);
 await mobile.locator('#tab-performance').screenshot({path:path.join(output,'ytd-mobile-result.png')});
 console.log('PASS: mobile editor layout, save and zero opening NAV.');
 await mobile.locator('#ytdSettingsBtn').click();await mobile.locator('#ytdClose').click();await setLinkedProfile(mobile);
 await mobile.locator('#ytdSettingsBtn').click();
 const linkedWidths=await mobile.evaluate(()=>({screen:innerWidth,editor:document.querySelector('.ytd-editor').getBoundingClientRect().width,scroll:document.documentElement.scrollWidth}));
 assert.ok(linkedWidths.editor<=linkedWidths.screen+1);assert.ok(linkedWidths.scroll<=baselineWidth+1);
 await mobile.screenshot({path:path.join(output,'ytd-linked-mobile-editor.png'),fullPage:true});await mobile.locator('#ytdClose').click();
 await mobile.locator('#tab-performance').screenshot({path:path.join(output,'ytd-linked-mobile-result.png')});
 console.log('PASS: mobile automatic continuation editor and result.');

 const cloud=await makePage('new',{syncKey:keyA});await performance(cloud);await setProfile(cloud);await cloud.evaluate(()=>goHome());
 await cloud.locator('#cloudSyncBtn').click();await cloud.locator('#syncNowBtn').click();
 await cloud.waitForTimeout(500);
 const stored=await decrypt(keyA,docs.get(keyA).payload);
 assert.equal(stored.accounts[0].performanceProfiles['2026'].openingNav,100,'cloud upload lost profile');
 assert.equal(JSON.stringify(docs.get(keyB)),untouchedB,'another sync document changed');
 assert.match(await cloud.locator('#ytdSyncFingerprint').innerText(),new RegExp(createHash('sha256').update('portfolio-sync-id:'+keyA).digest('hex').slice(0,16)));
 await cloud.locator('#closeSyncModalBtn').click();
 const downloadPromise=cloud.waitForEvent('download');await cloud.evaluate(()=>exportPortfolioBackup());const download=await downloadPromise;
 const exportPath=path.join(output,'ytd-synthetic-backup.json');await download.saveAs(exportPath);
 const exported=JSON.parse(await fs.readFile(exportPath,'utf8'));assert.equal(exported.state.accounts[0].performanceProfiles['2026'].externalFlows[0].amount,50);
 const second=await makePage('new');await second.locator('#cloudSyncBtn').click();await second.locator('#syncKeyInput').fill(keyA);await second.locator('#connectSyncBtn').click();
 await second.waitForFunction(()=>state.accounts[0].performanceProfiles?.['2026']?.enabled===true);
 const independent=await makePage('new');await independent.locator('#cloudSyncBtn').click();await independent.locator('#syncKeyInput').fill(keyB);await independent.locator('#connectSyncBtn').click();await independent.waitForTimeout(300);
 assert.equal(await independent.evaluate(()=>state.accounts.some(a=>a.performanceProfiles!==undefined)),false,'profile leaked to separate sync key');
 console.log('PASS: actual sync encryption/upload/download, separate-key isolation, fingerprint and JSON backup round trip.');
 await cloud.locator('#closeSyncModalBtn').click().catch(()=>{});await performance(cloud);await setLinkedProfile(cloud);await cloud.evaluate(()=>goHome());
 await cloud.locator('#cloudSyncBtn').click();await cloud.locator('#syncNowBtn').click();await cloud.waitForTimeout(500);
 const linkedStored=await decrypt(keyA,docs.get(keyA).payload);
 assert.equal(linkedStored.accounts[0].performanceProfiles['2026'].anchor.returnPct,25);assert.equal(linkedStored.accounts[0].performanceProfiles['2026'].method,'broker-linked-estimate');
 assert.equal(JSON.stringify(docs.get(keyB)),untouchedB,'linked settings changed another encrypted document');
 const linkedDownload=await makePage('new');await linkedDownload.locator('#cloudSyncBtn').click();await linkedDownload.locator('#syncKeyInput').fill(keyA);await linkedDownload.locator('#connectSyncBtn').click();
 await linkedDownload.waitForFunction(()=>state.accounts[0].performanceProfiles?.['2026']?.method==='broker-linked-estimate');
 assert.ok(Math.abs((await linkedDownload.evaluate(()=>PortfolioYtdAnchor.resultFor('one'))).returnPct-25)<1e-8);
 console.log('PASS: broker-linked settings encrypted upload/download and separate-key isolation.');

 const overviewFixture=structuredClone(fixture);
 for(const t of overviewFixture.transactions)t.date='2026-08-13';
 overviewFixture.accounts[0].performanceProfiles={2026:{version:1,enabled:true,method:'modified-dietz',openingAsOf:'2025-12-31',openingNav:100,currency:'USD',navSource:'app',flowsCompleteThrough:'2026-11-13',externalFlows:[]}};
 overviewFixture.accounts[1].performanceProfiles={2026:{version:1,enabled:true,method:'broker-linked-estimate',openingAsOf:'2025-12-31',openingNav:0,currency:'USD',navSource:'app',flowsCompleteThrough:'2026-11-12',externalFlows:[{id:'actual',date:'2026-01-10',amount:100}],anchor:{date:'2026-11-12',returnPct:5,nav:99,appNav:109}}};
 const overview=await makePage('new',{initialState:overviewFixture,historyDelay:300});
 const overviewFinancial=page=>page.evaluate(()=>JSON.stringify({accounts:state.accounts,transactions:state.transactions,fx:state.fx,settings:state.settings}));
 const overviewState=await overviewFinancial(overview);
 assert.equal(await overview.locator('.overall-return-period.active').textContent(),'YTD','opted-in overview did not default to YTD');
 assert.equal(await overview.locator('#overallReturnHero').textContent(),await overview.locator('#homeNetAssets').textContent());
 assert.match(await overview.locator('#overallReturnNote').textContent(),/2026-08-13/,'missing history was drawn from zero');
 const immediate=await overview.evaluate(()=>{state.assets[0].price=13;renderHome();void renderOverallReturn({force:true});return {hero:document.getElementById('overallReturnHero').textContent,net:money(summaryFor().net)};});
 assert.equal(immediate.hero,immediate.net,'Value waited for historical service to update');
 await overview.locator('#homeCurrency').selectOption('USD');
 await overview.waitForTimeout(600);
 assert.equal(await overview.locator('#overallReturnHero').textContent(),await overview.locator('#homeNetAssets').textContent(),'Value currency differs from header');
 await overview.locator('.overall-return-tab[data-mode="performance"]').click();
 assert.match(await overview.locator('#overallReturnChart').textContent(),/NAV before performance alignment/,'aggregate hid accounting/performance NAV difference');
 const groupResult=await overview.evaluate(()=>PortfolioYtdAnchor.aggregate(state.accounts.map(a=>({id:a.id,profile:a.performanceProfiles[2026],endNav:summaryFor(a.id).net,source:{accountId:a.id,transactions:state.transactions,rates:{USD:1,HKD:1/7.8}}})),2026,'2026-11-13'));
 assert.equal(await overview.locator('#overallReturnHero').textContent(),`${groupResult.returnPct>=0?'+':''}${groupResult.returnPct.toFixed(2)}%`);
 assert.equal(await overview.locator('#overallReturnBreakdown .overview-account').count(),2);
 await overview.locator('.overall-return-period[data-period="1Y"]').click();
 assert.equal(await overview.locator('#overallReturnHero').textContent(),'—');assert.match(await overview.locator('#overallReturnChart').textContent(),/Opening trades are incomplete/);
 await overview.locator('.overall-return-tab[data-mode="value"]').click();
 await overview.locator('#homeNetAssetPrivacyBtn').click();
 assert.equal(await overview.locator('#homeNetAssets').textContent(),'******');assert.equal(await overview.locator('#overallReturnHero').textContent(),'******');
 await overview.evaluate(()=>{state.assets[0].price=14;renderAll();});await overview.waitForTimeout(400);
 await overview.locator('#homeNetAssetPrivacyBtn').click();
 assert.equal(await overview.locator('#overallReturnHero').textContent(),await overview.locator('#homeNetAssets').textContent(),'privacy restored a stale value');
 await overview.locator('.overall-return-period[data-period="1M"]').click();await overview.reload();await overview.waitForSelector('body.app-ready');await overview.waitForTimeout(400);
 assert.equal(await overview.locator('.overall-return-period.active').textContent(),'1M','overview period preference did not survive reload');
 assert.equal(await overview.locator('.overall-return-tab.active').textContent(),'Value');
 assert.equal(await overviewFinancial(overview),overviewState,'overview navigation changed financial state');
 await overview.locator('#overallReturnRefresh').click();await overview.waitForFunction(()=>!document.getElementById('overallReturnRefresh').disabled);
 assert.equal(await overview.locator('#overallReturnHero').textContent(),await overview.locator('#homeNetAssets').textContent());
 console.log('PASS: live Value equality, currency, YTD default, combined performance bridge, missing-history guard, privacy, preferences, refresh and unchanged financial state.');

 const outage=await makePage('new',{failHistory:true});
 assert.equal(await outage.locator('#overallReturnHero').textContent(),await outage.locator('#homeNetAssets').textContent(),'history outage hid current NAV');
 assert.match(await outage.locator('#overallReturnChart').textContent(),/Could not load/);
 const racing=await makePage('new',{historyDelay:700});
 await racing.evaluate(()=>openPortfolio('one'));await racing.waitForTimeout(50);await racing.evaluate(()=>openPortfolio('two'));await racing.waitForTimeout(1100);
 const raced=await racing.evaluate(()=>({latest:document.getElementById('historyLatest').textContent,expected:money(summaryFor('two').net)}));
 assert.ok(raced.latest.includes(raced.expected),'previous portfolio history overwrote current portfolio');
 const overviewMobile=await makePage('new',{mobile:true,initialState:overviewFixture});
 assert.ok(await overviewMobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overview overflow');
 await overviewMobile.locator('#overallReturnPanel').screenshot({path:path.join(output,'overview-mobile-value.png')});
 await overviewMobile.locator('.overall-return-tab[data-mode="performance"]').click();
 assert.ok(await overviewMobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile performance overflow');
 await overviewMobile.locator('#overallReturnPanel').screenshot({path:path.join(output,'overview-mobile-performance.png')});
 console.log('PASS: history outage retains NAV, portfolio navigation rejects stale results, mobile overview/performance layout.');
 await overviewMobile.locator('.overall-return-tab[data-mode="value"]').click();
 await overviewMobile.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 await overviewMobile.screenshot({path:path.join(output,'summary-mobile-home.png'),fullPage:true});
 const summaryBefore=await overviewFinancial(overviewMobile);
 await overviewMobile.evaluate(()=>openPortfolio('one'));await overviewMobile.waitForTimeout(600);
 assert.equal(await overviewMobile.locator('#portfolioNetAssets').textContent(),await overviewMobile.evaluate(()=>money(summaryFor('one').net)));
 assert.match(await overviewMobile.locator('#historyLatest').textContent(),/NAV change · includes funding/,'asset change presented as investment return');
 assert.match(await overviewMobile.locator('#historyCoverage').textContent(),/Available history from 2026-08-13/,'summary hid missing opening history');
 assert.equal(await overviewMobile.locator('#portfolioSummaryPulse .summary-ytd-link strong').textContent(),await overviewMobile.evaluate(()=>pct(PortfolioYtdAnchor.resultFor('one').returnPct)),'summary YTD differs from configured method');
 assert.ok(await overviewMobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile portfolio summary overflow');
 await overviewMobile.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 await overviewMobile.screenshot({path:path.join(output,'summary-mobile-portfolio.png'),fullPage:true});
 await overviewMobile.locator('#portfolioSummaryPulse .summary-ytd-link').click();await overviewMobile.waitForTimeout(300);
 assert.equal(await overviewMobile.locator('#benchmarkPeriods .active').textContent(),'YTD');
 await overviewMobile.locator('#benchmarkPeriods [data-period="1Y"]').click();await overviewMobile.waitForTimeout(1800);
 assert.match(await overviewMobile.locator('#benchmarkChart').textContent(),/Opening trades are incomplete/,'live refresh replaced missing-history guard');
 assert.equal(await overviewFinancial(overviewMobile),summaryBefore,'summary redesign changed financial state');
 await overviewMobile.locator('#benchmarkPeriods [data-period="YTD"]').click();await overviewMobile.waitForTimeout(300);
 await overviewMobile.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 await overviewMobile.screenshot({path:path.join(output,'summary-mobile-ytd.png'),fullPage:true});
 console.log('PASS: Futu-style summary, canonical portfolio NAV/YTD, explicit funding and history coverage, benchmark guard survives live refresh, no financial state changes.');
 assert.deepEqual(errors,[],'browser runtime errors');
 console.log('PASS: no browser runtime errors.');
}catch(error){
 console.error('Captured runtime errors:',JSON.stringify(errors));
 for(let i=0;i<contexts.length;i++){const p=contexts[i].pages()[0];if(p){await p.screenshot({path:path.join(output,'failure-'+i+'.png'),fullPage:true}).catch(()=>{});await fs.writeFile(path.join(output,'failure-'+i+'.txt'),await p.locator('body').innerText().catch(()=>''));}}
 throw error;
}finally{for(const c of contexts)await c.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
