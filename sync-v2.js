(()=>{
  if(window.__portfolioCloudSyncInstalledV214)return;
  window.__portfolioCloudSyncInstalledV214=true;

  const ENDPOINT='https://bwezuoggzvoyickxeddp.supabase.co/functions/v1/portfolio-sync';
  const SYNC_KEY_STORE='portfolioTrackerSyncKeyV1';
  const SYNC_META_STORE='portfolioTrackerSyncMetaV1';
  const PRECONNECT_BACKUP='portfolioTrackerPreCloudConnectBackupV1';
  const POLL_MS=6000;
  let busy=false;
  let conflict=false;
  let lastConflictToastAt=0;

  const style=document.createElement('style');
  style.textContent=`
    .sync-note{font-size:12px;color:var(--muted);line-height:1.45;margin:-4px 0 12px}
    .sync-status{font-size:12px;color:var(--muted);line-height:1.45;margin:8px 0 12px}
    .sync-status.ok{color:var(--positive)}
    .sync-status.error{color:var(--negative)}
    .sync-key-row{display:flex;gap:8px;align-items:center}
    .sync-key-row input{flex:1}
    .sync-backup-list{display:grid;gap:8px;margin-top:10px}
    .sync-backup-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-top:1px solid rgba(255,255,255,.08)}
    .sync-actions{display:grid;gap:8px;margin-top:10px}
  `;
  document.head.appendChild(style);

  function readMeta(){
    try{return JSON.parse(localStorage.getItem(SYNC_META_STORE)||'{}')||{};}catch{return {};}
  }
  function writeMeta(meta){localStorage.setItem(SYNC_META_STORE,JSON.stringify(meta||{}));}
  function getSyncKey(){return (localStorage.getItem(SYNC_KEY_STORE)||'').trim();}
  function setSyncKey(key){localStorage.setItem(SYNC_KEY_STORE,key.trim());}
  function clearSyncKey(){localStorage.removeItem(SYNC_KEY_STORE);localStorage.removeItem(SYNC_META_STORE);conflict=false;}

  function bytesToB64(bytes){
    let s='';
    for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return btoa(s);
  }
  function b64ToBytes(s){
    const bin=atob(s);const out=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
    return out;
  }
  function bytesToB64Url(bytes){return bytesToB64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}

  async function deriveAesKey(syncKey){
    const raw=new TextEncoder().encode('portfolio-sync-encryption:'+syncKey);
    const hash=await crypto.subtle.digest('SHA-256',raw);
    return crypto.subtle.importKey('raw',hash,{name:'AES-GCM'},false,['encrypt','decrypt']);
  }
  async function encryptState(syncKey,value){
    const key=await deriveAesKey(syncKey);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const plain=new TextEncoder().encode(JSON.stringify(value));
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);
    return {v:1,iv:bytesToB64(iv),data:bytesToB64(new Uint8Array(encrypted))};
  }
  async function decryptState(syncKey,payload){
    if(!payload||payload.v!==1)throw new Error('Unsupported cloud backup format.');
    const key=await deriveAesKey(syncKey);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(payload.iv)},key,b64ToBytes(payload.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }
  async function hashState(value){
    const bytes=new TextEncoder().encode(JSON.stringify(value));
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    return [...hash].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function api(syncKey,method='GET',action='doc',body=null){
    const res=await fetch(`${ENDPOINT}?action=${encodeURIComponent(action)}`,{
      method,
      headers:{'Content-Type':'application/json','x-sync-key':syncKey},
      body:body==null?undefined:JSON.stringify(body)
    });
    let data={};
    try{data=await res.json();}catch{}
    if(!res.ok){
      const err=new Error(data?.error||`Cloud sync returned ${res.status}`);
      err.status=res.status;err.data=data;throw err;
    }
    return data;
  }

  function normalizeLoadedState(s){
    if(!s||typeof s!=='object')throw new Error('Cloud data is invalid.');
    s.settings=s.settings||{baseCurrency:'HKD',fx:{HKD:1,USD:7.80,KRW:0.0056}};
    s.settings.fx={HKD:1,USD:7.80,KRW:0.0056,...(s.settings.fx||{})};
    s.accounts=Array.isArray(s.accounts)?s.accounts:[];
    s.assets=Array.isArray(s.assets)?s.assets:[];
    s.transactions=Array.isArray(s.transactions)?s.transactions:[];
    s.fx=Array.isArray(s.fx)?s.fx:[];
    return s;
  }

  function setStatus(text,type=''){
    const el=document.getElementById('syncStatus');
    if(el){el.textContent=text;el.className=`sync-status ${type}`.trim();}
    const btn=document.getElementById('cloudSyncBtn');
    if(btn){
      const key=getSyncKey();
      btn.textContent=conflict?'⚠ Sync':key?'☁ Sync':'☁ Sync';
      btn.title=conflict?'Cloud sync conflict':'Cloud Sync';
    }
  }

  function installUI(){
    const header=document.getElementById('homeHeader');
    if(header&&!document.getElementById('cloudSyncBtn')){
      const btn=document.createElement('button');
      btn.id='cloudSyncBtn';btn.type='button';btn.className='icon-text-btn';btn.textContent='☁ Sync';
      btn.addEventListener('click',openSyncModal);
      header.appendChild(btn);
    }
    if(document.getElementById('syncModal'))return;
    const modal=document.createElement('div');
    modal.id='syncModal';modal.className='modal-overlay hidden';
    modal.innerHTML=`<div class="modal-wrap"><form class="modal-card" onsubmit="return false;">
      <div class="section-head"><h3>Cloud Sync</h3><button id="closeSyncModalBtn" type="button" class="icon-btn">×</button></div>
      <div class="sync-note">Use one Sync Key on all your devices. Portfolio data is encrypted on this device before upload. Keep the key private — anyone with it can decrypt your cloud copy.</div>
      <label>Sync Key<div class="sync-key-row"><input id="syncKeyInput" autocomplete="off" spellcheck="false" placeholder="Paste Sync Key"/><button id="copySyncKeyBtn" type="button" class="ghost-btn">Copy</button></div></label>
      <div id="syncStatus" class="sync-status"></div>
      <div class="sync-actions">
        <button id="createSyncBtn" type="button" class="primary-btn full">Create Cloud Sync From This Device</button>
        <button id="connectSyncBtn" type="button" class="primary-btn full">Connect & Download Cloud Data</button>
        <button id="syncNowBtn" type="button" class="ghost-btn full">Sync Now</button>
        <button id="useThisDeviceBtn" type="button" class="ghost-btn full hidden">Resolve Conflict: Use This Device</button>
        <button id="useCloudBtn" type="button" class="ghost-btn full hidden">Resolve Conflict: Use Cloud</button>
        <button id="showBackupsBtn" type="button" class="ghost-btn full">Cloud Backups</button>
        <div id="syncBackups" class="sync-backup-list"></div>
        <button id="disconnectSyncBtn" type="button" class="delete-btn full">Disconnect This Device</button>
      </div>
    </form></div>`;
    document.body.appendChild(modal);
    document.getElementById('closeSyncModalBtn').addEventListener('click',()=>closeModal('syncModal'));
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal('syncModal');});
    document.getElementById('copySyncKeyBtn').addEventListener('click',copyKey);
    document.getElementById('createSyncBtn').addEventListener('click',createCloudSync);
    document.getElementById('connectSyncBtn').addEventListener('click',connectAndDownload);
    document.getElementById('syncNowBtn').addEventListener('click',()=>syncTick({manual:true}));
    document.getElementById('useThisDeviceBtn').addEventListener('click',resolveUseLocal);
    document.getElementById('useCloudBtn').addEventListener('click',resolveUseCloud);
    document.getElementById('showBackupsBtn').addEventListener('click',loadBackups);
    document.getElementById('disconnectSyncBtn').addEventListener('click',disconnectSync);
  }

  function refreshModal(){
    installUI();
    const key=getSyncKey();
    const input=document.getElementById('syncKeyInput');
    if(input)input.value=key;
    document.getElementById('createSyncBtn')?.classList.toggle('hidden',!!key);
    document.getElementById('connectSyncBtn')?.classList.toggle('hidden',!!key);
    document.getElementById('syncNowBtn')?.classList.toggle('hidden',!key);
    document.getElementById('showBackupsBtn')?.classList.toggle('hidden',!key);
    document.getElementById('disconnectSyncBtn')?.classList.toggle('hidden',!key);
    document.getElementById('useThisDeviceBtn')?.classList.toggle('hidden',!conflict);
    document.getElementById('useCloudBtn')?.classList.toggle('hidden',!conflict);
    const meta=readMeta();
    if(conflict)setStatus('Conflict detected: this device and cloud both changed. Choose which version to keep.','error');
    else if(key&&meta.remoteUpdatedAt)setStatus(`Connected. Last cloud update: ${new Date(meta.remoteUpdatedAt).toLocaleString()}.`,'ok');
    else if(key)setStatus('Connected. Waiting for first sync.');
    else setStatus('Not connected. Create a new cloud sync on your primary device, or paste an existing key.');
  }

  function openSyncModal(){refreshModal();openModal('syncModal');}
  window.openSyncModal=openSyncModal;

  async function copyKey(){
    const key=document.getElementById('syncKeyInput')?.value.trim();
    if(!key)return toast('No Sync Key to copy.',true);
    try{await navigator.clipboard.writeText(key);toast('Sync Key copied.');}
    catch{toast('Could not copy Sync Key.',true);}
  }

  function generateKey(){return bytesToB64Url(crypto.getRandomValues(new Uint8Array(32)));}

  async function pushState(syncKey,{force=false}={}){
    const meta=readMeta();
    const payload=await encryptState(syncKey,state);
    const data=await api(syncKey,'PUT','doc',{
      payload,
      expected_updated_at:force?null:(meta.remoteUpdatedAt||null),
      client_updated_at:new Date().toISOString()
    });
    const h=await hashState(state);
    writeMeta({remoteUpdatedAt:data.updated_at,lastSyncedHash:h});
    conflict=false;
    refreshModal();
    return data;
  }

  async function applyCloud(syncKey,remote,{backupLocal=true}={}){
    const cloud=normalizeLoadedState(await decryptState(syncKey,remote.payload));
    if(backupLocal){
      try{localStorage.setItem(PRECONNECT_BACKUP,JSON.stringify({savedAt:new Date().toISOString(),state}));}catch{}
    }
    state=cloud;
    currentPortfolioId=null;
    save();
    renderAll();
    if(typeof goHome==='function')goHome();
    const h=await hashState(state);
    writeMeta({remoteUpdatedAt:remote.updated_at,lastSyncedHash:h});
    conflict=false;
    refreshModal();
  }

  async function createCloudSync(){
    if(busy)return;busy=true;
    try{
      const key=generateKey();
      setSyncKey(key);
      writeMeta({});
      document.getElementById('syncKeyInput').value=key;
      setStatus('Creating encrypted cloud copy…');
      const existing=await api(key,'GET','doc');
      if(existing.found)throw new Error('Generated key collision. Please try again.');
      await pushState(key,{force:true});
      setStatus('Cloud Sync created. Copy this Sync Key to your other device.','ok');
      toast('Cloud Sync created. Save the Sync Key.');
    }catch(err){clearSyncKey();setStatus(err.message||'Could not create cloud sync.','error');toast('Could not create Cloud Sync.',true);}
    finally{busy=false;refreshModal();}
  }

  async function connectAndDownload(){
    if(busy)return;
    const key=document.getElementById('syncKeyInput')?.value.trim();
    if(!key||key.length<32)return toast('Enter a valid Sync Key.',true);
    busy=true;
    try{
      setStatus('Checking cloud data…');
      const remote=await api(key,'GET','doc');
      if(!remote.found){
        if(!confirm('No cloud data exists for this key. Upload this device as the first cloud copy?'))return;
        setSyncKey(key);writeMeta({});await pushState(key,{force:true});toast('This device uploaded as the cloud copy.');return;
      }
      // Verify the key can decrypt before changing local settings.
      await decryptState(key,remote.payload);
      if(!confirm('Cloud data found. Replace this device\'s local portfolio data with the cloud version? A local safety backup will be kept.'))return;
      setSyncKey(key);
      await applyCloud(key,remote,{backupLocal:true});
      toast('Cloud data downloaded.');
    }catch(err){setStatus(err.message||'Could not connect to cloud data.','error');toast('Cloud connection failed.',true);}
    finally{busy=false;refreshModal();}
  }

  async function syncTick({manual=false}={}){
    const key=getSyncKey();
    if(!key||busy||conflict)return;
    busy=true;
    try{
      const meta=readMeta();
      const localHash=await hashState(state);
      const remote=await api(key,'GET','doc');
      if(!remote.found){
        await pushState(key,{force:true});
        if(manual)toast('Cloud copy created.');
        return;
      }

      const cloudChanged=!!meta.remoteUpdatedAt&&remote.updated_at!==meta.remoteUpdatedAt;
      const localChanged=!!meta.lastSyncedHash&&localHash!==meta.lastSyncedHash;

      if(!meta.remoteUpdatedAt||!meta.lastSyncedHash){
        // Existing connected device without metadata: prefer cloud only if local still looks unchanged from a prior cloud pull is unknowable.
        // Do not overwrite automatically; establish baseline using cloud timestamp and current local hash.
        writeMeta({remoteUpdatedAt:remote.updated_at,lastSyncedHash:localHash});
        if(manual)toast('Sync baseline established. Press Sync Now again after any changes.');
        return;
      }

      if(cloudChanged&&localChanged){
        conflict=true;
        const now=Date.now();
        if(now-lastConflictToastAt>30000){toast('Cloud sync conflict detected. Open Sync to resolve.',true);lastConflictToastAt=now;}
        refreshModal();return;
      }
      if(cloudChanged&&!localChanged){
        await applyCloud(key,remote,{backupLocal:false});
        if(manual)toast('Downloaded latest cloud data.');
        return;
      }
      if(!cloudChanged&&localChanged){
        try{await pushState(key,{force:false});if(manual)toast('Uploaded latest changes.');}
        catch(err){
          if(err.status===409){conflict=true;refreshModal();if(manual)toast('Sync conflict detected.',true);}
          else throw err;
        }
        return;
      }
      if(manual)toast('Already up to date.');
      refreshModal();
    }catch(err){
      console.error('Cloud sync failed',err);
      if(manual){setStatus(err.message||'Cloud sync failed.','error');toast('Cloud sync failed.',true);}
    }finally{busy=false;}
  }

  async function resolveUseLocal(){
    const key=getSyncKey();if(!key||busy)return;busy=true;
    try{await pushState(key,{force:true});conflict=false;toast('This device version is now the cloud version.');}
    catch(err){toast('Could not resolve sync conflict.',true);}
    finally{busy=false;refreshModal();}
  }
  async function resolveUseCloud(){
    const key=getSyncKey();if(!key||busy)return;busy=true;
    try{
      const remote=await api(key,'GET','doc');if(!remote.found)throw new Error('Cloud copy not found.');
      if(!confirm('Replace this device with the current cloud version? A local safety backup will be kept.'))return;
      await applyCloud(key,remote,{backupLocal:true});conflict=false;toast('Cloud version restored to this device.');
    }catch(err){toast('Could not use cloud version.',true);}
    finally{busy=false;refreshModal();}
  }

  async function loadBackups(){
    const key=getSyncKey();if(!key||busy)return;busy=true;
    const box=document.getElementById('syncBackups');box.innerHTML='<div class="sync-status">Loading backups…</div>';
    try{
      const data=await api(key,'GET','backups');
      const rows=data.backups||[];
      box.innerHTML=rows.length?rows.map(b=>`<div class="sync-backup-row"><span>${new Date(b.created_at).toLocaleString()}</span><button type="button" class="ghost-btn" data-backup-id="${b.backup_id}">Restore</button></div>`).join(''):'<div class="sync-status">No previous cloud backups yet.</div>';
      box.querySelectorAll('[data-backup-id]').forEach(btn=>btn.addEventListener('click',()=>restoreBackup(Number(btn.dataset.backupId))));
    }catch(err){box.innerHTML='<div class="sync-status error">Could not load cloud backups.</div>';}
    finally{busy=false;}
  }

  async function restoreBackup(backupId){
    const key=getSyncKey();if(!key||busy)return;
    if(!confirm('Restore this cloud backup? The current cloud version will first be saved as another backup.'))return;
    busy=true;
    try{
      const data=await api(key,'POST','restore',{backup_id:backupId});
      await applyCloud(key,{payload:data.payload,updated_at:data.updated_at},{backupLocal:true});
      toast('Cloud backup restored.');
      await loadBackups();
    }catch(err){toast('Could not restore cloud backup.',true);}
    finally{busy=false;refreshModal();}
  }

  function disconnectSync(){
    const key=getSyncKey();if(!key)return;
    if(!confirm('Disconnect Cloud Sync on this device? Local portfolio data will stay on this device.'))return;
    clearSyncKey();
    document.getElementById('syncBackups').innerHTML='';
    refreshModal();
    toast('Cloud Sync disconnected on this device.');
  }

  installUI();
  refreshModal();
  if(getSyncKey())setTimeout(()=>syncTick(),1200);
  setInterval(()=>syncTick(),POLL_MS);
})();
