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
async function makePage(variant,{syncKey=null,mobile=false}={}){
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1200,height:1000},acceptDownloads:true});contexts.push(ctx);
 await ctx.addInitScript(({fixture,syncKey,fixed})=>{
  const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return new RealDate(fixed).getTime();}};
  localStorage.setItem('portfolioTrackerV2',JSON.stringify(fixture));if(syncKey)localStorage.setItem('portfolioTrackerSyncKeyV1',syncKey);
 },{fixture,syncKey,fixed});
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
  await route.fulfill({json:{quotes:{AAA:{price:12,previousClose:11,name:'Example A',currency:'USD'},BBB:{price:6,previousClose:5,name:'Example B',currency:'USD'},VOO:{price:110,previousClose:109},QQQ:{price:220,previousClose:218}},history,fx:{HKD:1,USD:7.8,KRW:0.0056,EUR:8.5},updatedAt:fixed}});
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(origin+'/'+variant+'/index.html');await page.waitForSelector('body.app-ready');await page.waitForTimeout(1200);return page;
}
const accounting=page=>page.evaluate(()=>JSON.stringify({transactions:state.transactions,fx:state.fx,holdings:holdingsFor(),positions:positionsFor(),cash:cashBalancesFor(),summary:summaryFor()}));
const allState=page=>page.evaluate(()=>JSON.stringify(state));
async function performance(page){await page.evaluate(()=>openPortfolio('one'));await page.locator('[data-tab="performance"]').click();await page.waitForTimeout(400);}
async function setProfile(page,on=true){
 await page.locator('#ytdSettingsBtn').click();await page.locator('#ytdEnabled').setChecked(on);
 if(on){await page.locator('#ytdCurrency').selectOption('USD');await page.locator('#ytdNavSource').selectOption('app');await page.locator('#ytdOpening').fill('100');await page.locator('#ytdSource').fill('Synthetic verification');
  if(await page.locator('#ytdFlows .ytd-flow').count()===0){await page.locator('#ytdAddFlow').click();await page.locator('.ytd-date').fill('2026-05-01');await page.locator('.ytd-amount').fill('50');}
 }
 await page.locator('#ytdSave').click();await page.waitForTimeout(250);
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
 await performance(modern);await setProfile(modern,false);await modern.waitForTimeout(400);
 assert.equal(await modern.locator('#benchmarkLegend').innerText(),legacyLegend,'disabling did not restore legacy performance');
 assert.equal(await accounting(modern),await accounting(base),'accounting differs after disabling');
 console.log('PASS: legacy startup/state/output equality; opt-in; accounting unchanged; flow source exclusivity; currency invariance; coverage; disable.');

 const mobile=await makePage('new',{mobile:true});await performance(mobile);await mobile.locator('#ytdSettingsBtn').click();await mobile.locator('#ytdEnabled').check();await mobile.locator('#ytdOpening').fill('0');await mobile.locator('#ytdAddFlow').click();
 await mobile.locator('.ytd-date').fill('2026-05-01');await mobile.locator('.ytd-amount').fill('100');
 await mobile.screenshot({path:path.join(output,'ytd-mobile-editor.png'),fullPage:true});
 const widths=await mobile.evaluate(()=>({screen:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(widths.scroll<=widths.screen+1,JSON.stringify(widths));
 await mobile.locator('#ytdSave').click();assert.equal(await mobile.evaluate(()=>PortfolioYtdAnchor.resultFor('one').ok),true);
 console.log('PASS: mobile editor layout, save and zero opening NAV.');

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
 assert.deepEqual(errors,[],'browser runtime errors');
 console.log('PASS: no browser runtime errors.');
}catch(error){
 for(let i=0;i<contexts.length;i++){const p=contexts[i].pages()[0];if(p){await p.screenshot({path:path.join(output,'failure-'+i+'.png'),fullPage:true}).catch(()=>{});await fs.writeFile(path.join(output,'failure-'+i+'.txt'),await p.locator('body').innerText().catch(()=>''));}}
 throw error;
}finally{for(const c of contexts)await c.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
