(()=>{
  if(window.__portfolioSyncHealthInstalledV220)return;
  window.__portfolioSyncHealthInstalledV220=true;

  const SYNC_KEY_STORE='portfolioTrackerSyncKeyV1';
  const SYNC_META_STORE='portfolioTrackerSyncMetaV1';
  const HEALTH_STORE='portfolioTrackerSyncHealthV220';
  const LOCAL_SAFETY_BACKUP='portfolioTrackerPreCloudConnectBackupV1';
  const CHECK_MS=1800;
  let localDirty=false;
  let checking=false;

  const style=document.createElement('style');
  style.textContent=`
    .sync-health-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 12px}
    .sync-health-cell{border:1px solid var(--line);background:#111115;border-radius:12px;padding:10px}
    .sync-health-cell span{display:block;color:var(--muted);font-size:11px;margin-bottom:4px}
    .sync-health-cell strong{display:block;font-size:13px;line-height:1.3}
    .sync-health-tools{display:grid;gap:8px;margin:10px 0}
    .sync-health-divider{height:1px;background:var(--line);margin:12px 0}
    .sync-health-warning{font-size:11px;color:var(--muted);line-height:1.45;margin-top:6px}
    .sync-health-good{color:var(--positive)}
    .sync-health-bad{color:var(--negative)}
    .sync-health-local{color:#f4c95d}
    @media(max-width:460px){.sync-health-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function readJson(key,fallback={}){
    try{return JSON.parse(localStorage.getItem(key)||'')||fallback;}catch{return fallback;}
  }
  function readMeta(){return readJson(SYNC_META_STORE,{});}
  function readHealth(){return readJson(HEALTH_STORE,{});}
  function writeHealth(patch){
    const next={...readHealth(),...patch};
    localStorage.setItem(HEALTH_STORE,JSON.stringify(next));
    return next;
  }
  function getSyncKey(){return (localStorage.getItem(SYNC_KEY_STORE)||'').trim();}

  async function hashState(value){
    const bytes=new TextEncoder().encode(JSON.stringify(value));
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    return [...hash].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function when(iso){
    if(!iso)return '—';
    const d=new Date(iso);if(Number.isNaN(d.getTime()))return '—';
    const sec=Math.max(0,Math.round((Date.now()-d.getTime())/1000));
    if(sec<15)return 'Just now';
    if(sec<60)return `${sec}s ago`;
    const min=Math.floor(sec/60);if(min<60)return `${min}m ago`;
    const hr=Math.floor(min/60);if(hr<24)return `${hr}h ago`;
    const day=Math.floor(hr/24);if(day<7)return `${day}d ago`;
    return d.toLocaleString();
  }

  function isConflict(){
    const btn=document.getElementById('cloudSyncBtn');
    const status=document.getElementById('syncStatus');
    return (btn?.textContent||'').includes('⚠') || /conflict/i.test(status?.textContent||'');
  }
  function hasSyncError(){
    const status=document.getElementById('syncStatus');
    return !!status?.classList.contains('error')&&!isConflict();
  }

  function currentMode(){
    const connected=!!getSyncKey();
    if(!connected)return {key:'disconnected',label:'Not connected',className:''};
    if(!navigator.onLine)return {key:'offline',label:'Offline',className:'sync-health-bad'};
    if(isConflict())return {key:'conflict',label:'Conflict',className:'sync-health-bad'};
    if(checking)return {key:'syncing',label:'Checking…',className:''};
    if(localDirty)return {key:'local',label:'Local changes',className:'sync-health-local'};
    if(hasSyncError())return {key:'error',label:'Sync error',className:'sync-health-bad'};
    return {key:'synced',label:'Synced',className:'sync-health-good'};
  }

  function decorateHeader(){
    const btn=document.getElementById('cloudSyncBtn');
    if(!btn)return;
    const mode=currentMode();
    const symbols={disconnected:'☁ Sync',offline:'☁ ×',conflict:'☁ ⚠',syncing:'☁ …',local:'☁ ↑',error:'☁ !',synced:'☁ ✓'};
    const nextText=symbols[mode.key]||'☁ Sync';
    if(btn.textContent!==nextText)btn.textContent=nextText;
    const health=readHealth();
    const nextTitle=`Cloud Sync — ${mode.label}${health.lastSyncedAt?` — Last synced ${when(health.lastSyncedAt)}`:''}`;
    if(btn.title!==nextTitle)btn.title=nextTitle;
  }

  function injectHealthUI(){
    const modal=document.getElementById('syncModal');
    if(!modal)return false;
    const status=document.getElementById('syncStatus');
    if(status&&!document.getElementById('syncHealthGrid')){
      const grid=document.createElement('div');
      grid.id='syncHealthGrid';grid.className='sync-health-grid';
      grid.innerHTML=`
        <div class="sync-health-cell"><span>Status</span><strong id="syncHealthStatus">—</strong></div>
        <div class="sync-health-cell"><span>Last synced</span><strong id="syncHealthLastSynced">—</strong></div>
        <div class="sync-health-cell"><span>Cloud updated</span><strong id="syncHealthCloudUpdated">—</strong></div>
        <div class="sync-health-cell"><span>Device changes</span><strong id="syncHealthDeviceChanges">—</strong></div>`;
      status.after(grid);
    }

    const actions=modal.querySelector('.sync-actions');
    const showBackups=document.getElementById('showBackupsBtn');
    if(actions&&!document.getElementById('syncBackupTools')){
      const tools=document.createElement('div');
      tools.id='syncBackupTools';tools.className='sync-health-tools';
      tools.innerHTML=`
        <div class="sync-health-divider"></div>
        <button id="exportJsonBackupBtn" type="button" class="ghost-btn full">Export JSON Backup</button>
        <button id="restoreJsonBackupBtn" type="button" class="ghost-btn full">Restore JSON Backup</button>
        <input id="restoreJsonBackupInput" type="file" accept="application/json,.json" class="hidden" />
        <button id="restoreLocalSafetyBtn" type="button" class="ghost-btn full hidden">Restore Local Safety Backup</button>
        <div class="sync-health-warning">JSON exports are plaintext and contain your portfolio data. Keep backup files private. Restoring a local backup will become a local change and will sync normally if Cloud Sync is connected.</div>`;
      if(showBackups)actions.insertBefore(tools,showBackups);else actions.appendChild(tools);
      document.getElementById('exportJsonBackupBtn').addEventListener('click',exportJsonBackup);
      document.getElementById('restoreJsonBackupBtn').addEventListener('click',()=>document.getElementById('restoreJsonBackupInput')?.click());
      document.getElementById('restoreJsonBackupInput').addEventListener('change',restoreJsonBackupFile);
      document.getElementById('restoreLocalSafetyBtn').addEventListener('click',restoreLocalSafetyBackup);
    }
    return true;
  }

  function refreshHealthUI(){
    injectHealthUI();
    const mode=currentMode();
    const meta=readMeta();
    const health=readHealth();
    const status=document.getElementById('syncHealthStatus');
    const last=document.getElementById('syncHealthLastSynced');
    const cloud=document.getElementById('syncHealthCloudUpdated');
    const changes=document.getElementById('syncHealthDeviceChanges');
    if(status){status.textContent=mode.label;status.className=mode.className;}
    if(last)last.textContent=health.lastSyncedAt?when(health.lastSyncedAt):'—';
    if(cloud)cloud.textContent=meta.remoteUpdatedAt?when(meta.remoteUpdatedAt):'—';
    if(changes){
      changes.textContent=localDirty?'Pending upload':'None';
      changes.className=localDirty?'sync-health-local':'sync-health-good';
    }
    const localRestore=document.getElementById('restoreLocalSafetyBtn');
    if(localRestore)localRestore.classList.toggle('hidden',!localStorage.getItem(LOCAL_SAFETY_BACKUP));
    const show=document.getElementById('showBackupsBtn');
    if(show&&show.textContent!=='View Cloud Backups')show.textContent='View Cloud Backups';
    decorateHeader();
  }

  async function assessHealth(){
    if(checking)return;
    try{
      const key=getSyncKey();
      if(!key){localDirty=false;refreshHealthUI();return;}
      const meta=readMeta();
      const h=await hashState(state);
      const synced=!!meta.lastSyncedHash&&h===meta.lastSyncedHash;
      localDirty=!synced;
      const health=readHealth();
      const syncFingerprint=`${meta.remoteUpdatedAt||''}|${meta.lastSyncedHash||''}`;
      if(synced&&syncFingerprint!==(health.syncFingerprint||'')){
        writeHealth({lastSyncedAt:new Date().toISOString(),syncFingerprint});
      }else if(!health.lastSyncedAt&&meta.remoteUpdatedAt){
        writeHealth({lastSyncedAt:meta.remoteUpdatedAt,syncFingerprint});
      }
    }catch(err){console.warn('Sync health check failed',err);}
    refreshHealthUI();
  }

  function saveSafetyBackup(reason='manual restore'){
    try{
      localStorage.setItem(LOCAL_SAFETY_BACKUP,JSON.stringify({savedAt:new Date().toISOString(),reason,state}));
      return true;
    }catch{return false;}
  }

  function validateBackupState(candidate){
    const s=candidate?.state&&typeof candidate.state==='object'?candidate.state:candidate;
    if(!s||typeof s!=='object')throw new Error('Backup does not contain a valid portfolio state.');
    const out=typeof structuredClone==='function'?structuredClone(s):JSON.parse(JSON.stringify(s));
    out.settings=out.settings||{baseCurrency:'HKD',fx:{HKD:1,USD:7.80,KRW:0.0056}};
    out.settings.fx={HKD:1,USD:7.80,KRW:0.0056,...(out.settings.fx||{})};
    out.accounts=Array.isArray(out.accounts)?out.accounts:[];
    out.assets=Array.isArray(out.assets)?out.assets:[];
    out.transactions=Array.isArray(out.transactions)?out.transactions:[];
    out.fx=Array.isArray(out.fx)?out.fx:[];
    return out;
  }

  function applyLocalBackup(nextState,label){
    saveSafetyBackup(`before ${label}`);
    state=validateBackupState(nextState);
    currentPortfolioId=null;
    save();
    renderAll();
    if(typeof goHome==='function')goHome();
    localDirty=true;
    writeHealth({lastRestoreAt:new Date().toISOString()});
    refreshHealthUI();
  }

  function exportJsonBackup(){
    try{
      const payload={
        format:'portfolio-tracker-backup',
        version:1,
        appVersion:'2.20',
        exportedAt:new Date().toISOString(),
        state
      };
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      const stamp=new Date().toISOString().replace(/[:.]/g,'-');
      a.href=url;a.download=`portfolio-tracker-backup-${stamp}.json`;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      toast('JSON backup exported. Keep it private.');
    }catch(err){console.error(err);toast('Could not export backup.',true);}
  }
  window.exportPortfolioBackup=exportJsonBackup;

  async function restoreJsonBackupFile(ev){
    const input=ev.currentTarget;
    const file=input.files?.[0];
    input.value='';
    if(!file)return;
    try{
      const parsed=JSON.parse(await file.text());
      const next=validateBackupState(parsed);
      if(!confirm(`Restore this JSON backup?\n\nPortfolios: ${next.accounts.length}\nTransactions: ${next.transactions.length}\n\nYour current local state will first be saved as a safety backup.`))return;
      applyLocalBackup(next,'JSON restore');
      toast('JSON backup restored.');
      setTimeout(assessHealth,100);
    }catch(err){console.error(err);toast('Invalid or unreadable JSON backup.',true);}
  }

  function restoreLocalSafetyBackup(){
    const raw=localStorage.getItem(LOCAL_SAFETY_BACKUP);
    if(!raw)return toast('No local safety backup found.',true);
    try{
      const backup=JSON.parse(raw);
      const next=validateBackupState(backup);
      const saved=backup.savedAt?new Date(backup.savedAt).toLocaleString():'unknown time';
      if(!confirm(`Restore the local safety backup from ${saved}?\n\nThe current local state will be replaced.`))return;
      const current={savedAt:new Date().toISOString(),reason:'before local safety restore',state};
      state=next;currentPortfolioId=null;save();renderAll();if(typeof goHome==='function')goHome();
      localStorage.setItem(LOCAL_SAFETY_BACKUP,JSON.stringify(current));
      localDirty=true;
      refreshHealthUI();
      toast('Local safety backup restored.');
      setTimeout(assessHealth,100);
    }catch(err){console.error(err);toast('Local safety backup is unreadable.',true);}
  }

  const originalSave=window.save;
  if(typeof originalSave==='function'&&!window.__portfolioSyncHealthSaveWrappedV220){
    window.__portfolioSyncHealthSaveWrappedV220=true;
    const wrappedSave=function(...args){
      const result=originalSave.apply(this,args);
      if(getSyncKey()){
        localDirty=true;
        writeHealth({lastLocalChangeAt:new Date().toISOString()});
        refreshHealthUI();
      }
      return result;
    };
    window.save=wrappedSave;
    try{save=wrappedSave;}catch{}
  }

  function setCheckingFor(ms=2500){
    checking=true;refreshHealthUI();
    setTimeout(()=>{checking=false;assessHealth();},ms);
  }

  document.addEventListener('click',ev=>{
    if(ev.target?.id==='syncNowBtn')setCheckingFor();
    if(ev.target?.id==='createSyncBtn'||ev.target?.id==='connectSyncBtn'||ev.target?.id==='useThisDeviceBtn'||ev.target?.id==='useCloudBtn')setCheckingFor(3500);
  },true);

  window.addEventListener('online',()=>{refreshHealthUI();setTimeout(assessHealth,300);});
  window.addEventListener('offline',refreshHealthUI);

  const observer=new MutationObserver(()=>refreshHealthUI());
  const observeSyncUi=()=>{
    injectHealthUI();
    const status=document.getElementById('syncStatus');
    const btn=document.getElementById('cloudSyncBtn');
    if(status)observer.observe(status,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    if(btn)observer.observe(btn,{childList:true,subtree:true});
  };

  observeSyncUi();
  assessHealth();
  setInterval(assessHealth,CHECK_MS);
})();