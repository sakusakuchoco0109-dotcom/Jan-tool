const { chromium } = require('playwright');
const fs = require('fs');
const APP='https://hilarious-haupia-6e0406.netlify.app/';
const NAME='ChatGPT同期検証0814';
const patchedJs=fs.readFileSync('app-core-543-candidate.js','utf8');
const log=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function dismiss(page){
  for(const sel of ['[data-profile-unlock-close]','#rareBurstCloseBtn','.mike-talk-close','#tutorialCloseBtn','#firstRunCloseBtn']){
    try{const el=page.locator(sel).first();if(await el.count()&&await el.isVisible())await el.click({timeout:700});}catch(e){}
  }
}
async function makeContext(browser,phone=false){
  const ctx=await browser.newContext(phone?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:1000}});
  await ctx.route(/\/assets\/app-core-542\.js(?:\?.*)?$/,async route=>{
    await route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:patchedJs+"\nwindow.__RC543_CANDIDATE__='loaded';"});
  });
  await ctx.addInitScript(({NAME,phone})=>{
    localStorage.setItem('fujiya_mitekore_early_access_v2',JSON.stringify({orderNumber:'99999999',verifiedAt:Date.now(),campaign:'test-order'}));
    localStorage.setItem('fujiya_collection_setup_done_v1','1');
    localStorage.setItem('fujiya_collection_tutorial_seen_v2_rc1474','1');
    localStorage.setItem('fujiya_collection_first_run_seen_v20_2_35cn','1');
    localStorage.setItem('fujiya_collection_user_name',NAME);
    localStorage.setItem('fujiya_collection_share_opt_in_v1','1');
    localStorage.setItem('fujiya_collection_share_purchase_price_opt_in_v1','1');
    if(!phone){
      localStorage.removeItem('fujiya_collection_user_id');
      localStorage.setItem('fujiya_collection_profile_v20_1',JSON.stringify({name:NAME,bio:'RC543本番GAS 2端末画像同期検証',favoritePlatforms:['SFC','GBA'],favoriteGames:['夢幻の如く','ポケットモンスター ファイアレッド'],links:{},visibility:{}}));
      localStorage.setItem('fujiya_collection_profile_v20_1_updated_at',new Date().toISOString());
    }
  },{NAME,phone});
  return ctx;
}
async function register(page,platform,title){
  await dismiss(page);
  await page.locator('[data-ui-tab="register"]:visible').first().click({timeout:10000});
  await sleep(400);
  const quick=page.locator('#quickRegisterModeBtn');
  if(await quick.count()&&await quick.isVisible()){await quick.click();await sleep(200)}
  await page.locator('#platform').fill(platform);
  await page.locator('#title').fill(title);
  await page.locator('#title').dispatchEvent('input');
  await sleep(800);
  await page.locator('#saveBtn').click({timeout:10000});
  await sleep(1600);await dismiss(page);
}
async function stateInfo(page){
  return page.evaluate(()=>{
    let root={};try{root=JSON.parse(localStorage.getItem('fujiya_collection_v1')||'{}')}catch(e){}
    const entries=Array.isArray(root.entries)?root.entries:[];
    return {userId:localStorage.getItem('fujiya_collection_user_id')||'',entries:entries.map(e=>({id:e.id,title:e.title,platform:e.platform,updatedAt:e.updatedAt}))};
  });
}
async function idbPhoto(page,id){
  return page.evaluate(async id=>{
    try{
      const db=await new Promise((ok,bad)=>{const r=indexedDB.open('fujiya_collection_entry_photos_v1');r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)});
      const row=await new Promise((ok,bad)=>{const tx=db.transaction('photos','readonly');const r=tx.objectStore('photos').get(id);r.onsuccess=()=>ok(r.result||null);r.onerror=()=>bad(r.error)});
      db.close();return {exists:!!row?.data,length:String(row?.data||'').length,updatedAt:String(row?.updatedAt||'')};
    }catch(e){return {exists:false,error:String(e)}}
  },id);
}
async function capturePhotos(page){
  return page.evaluate(async()=>{
    if(typeof window.deviceSyncCaptureLocalRecords!=='function')return [];
    const rows=await window.deviceSyncCaptureLocalRecords();
    return (rows||[]).filter(r=>String(r?.id||'').includes('entry_photo')).map(r=>({id:String(r.id||''),updatedAt:String(r.updatedAt||''),deletedAt:String(r.deletedAt||''),kind:String(r?.data?.kind||''),itemId:String(r?.data?.itemId||''),state:String(r?.data?.state||''),part:Number(r?.data?.part??-1),total:Number(r?.data?.total??-1),textLength:String(r?.data?.text||'').length}));
  });
}
async function pairStatus(page){return page.evaluate(()=>({body:document.body.innerText.slice(0,4000),status:document.querySelector('#deviceSyncStatus')?.innerText||'',modal:document.querySelector('#directQrArrival')?.innerText||'',hash:location.hash}))}
(async()=>{
  const browser=await chromium.launch({headless:true});
  const pcCtx=await makeContext(browser,false);const pc=await pcCtx.newPage();
  pc.on('console',m=>{if(/同期|画像|DEVICE_SYNC|登録画像|QR|接続/.test(m.text()))log.push('PC '+m.type()+': '+m.text())});pc.on('pageerror',e=>log.push('PC PAGEERROR '+e.message));
  await pc.goto(APP,{waitUntil:'domcontentloaded',timeout:60000});await sleep(6500);await dismiss(pc);
  const version='RC1.4.543';
  const injected=await pc.evaluate(()=>window.__RC543_CANDIDATE__||'');
  if(injected!=='loaded')throw new Error('候補JS差替え失敗 marker='+injected);
  await register(pc,'SFC','夢幻の如く');await register(pc,'GBA','ポケットモンスター ファイアレッド');
  let pcState=await stateInfo(pc);const ownerUserId=pcState.userId;
  const fire=pcState.entries.find(e=>e.title==='ポケットモンスター ファイアレッド');const mugen=pcState.entries.find(e=>e.title==='夢幻の如く');
  if(!ownerUserId||!fire||!mugen)throw new Error('PC登録準備失敗 '+JSON.stringify(pcState));
  await pc.locator('[data-desktop-more]:visible').first().click();await sleep(200);await pc.locator('[data-desktop-tab="sync"]:visible').click();await sleep(400);await pc.locator('#devicePairShowQrBtn:visible').click();
  await pc.waitForFunction(()=>!!document.querySelector('#devicePairUrl')?.dataset?.url,undefined,{timeout:20000});
  const pairUrl=await pc.locator('#devicePairUrl').evaluate(el=>el.dataset.url||'');
  await pc.screenshot({path:'01-pc-pair-qr.png',fullPage:false});
  const phoneCtx=await makeContext(browser,true);const phone=await phoneCtx.newPage();
  phone.on('console',m=>{if(/同期|画像|DEVICE_SYNC|登録画像|QR|接続/.test(m.text()))log.push('PHONE '+m.type()+': '+m.text())});phone.on('pageerror',e=>log.push('PHONE PAGEERROR '+e.message));
  await phone.goto(pairUrl,{waitUntil:'domcontentloaded',timeout:60000});
  try{await phone.waitForFunction(()=>document.body.innerText.includes('端末の接続が完了しました')||document.body.innerText.includes('接続完了：登録'),undefined,{timeout:300000});}
  catch(e){const d=await pairStatus(phone);fs.writeFileSync('pair-failure.json',JSON.stringify({d,log},null,2));await phone.screenshot({path:'pair-failure.png',fullPage:false});throw e}
  await phone.screenshot({path:'02-phone-paired.png',fullPage:false});await sleep(1500);await dismiss(phone);
  let phoneState=await stateInfo(phone);if(!phoneState.entries.some(e=>e.title===fire.title))throw new Error('接続後スマホにFireRedなし '+JSON.stringify(phoneState));
  await pc.locator('[data-ui-tab="list"]:visible').first().click();await sleep(900);await pc.locator(`button[data-action="edit"][data-id="${fire.id}"]`).first().click();await sleep(500);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAATUlEQVR4nO3PQQ0AIBDAsAP/nuGNAvZoFSzZOjNnyNi1dwfgUQCeBOBJAPYgAE8CsCQATwKwJwF4EoAnAdiDADwJwJMA7EEAngRgTwLwJAB7EgBfsA0Cfn4UQwAAAABJRU5ErkJggg==','base64');
  await pc.locator('#photo').setInputFiles({name:'sync-test.png',mimeType:'image/png',buffer:png});
  await pc.waitForFunction(()=>{const x=document.querySelector('#photoPreview');return x&&String(x.src).startsWith('data:image/')},undefined,{timeout:20000});
  await pc.locator('#saveBtn').click();await sleep(4500);
  const pcPhoto=await idbPhoto(pc,fire.id);const captured=await capturePhotos(pc);
  if(!pcPhoto.exists)throw new Error('PC画像保存失敗');
  await pc.locator('[data-ui-tab="list"]:visible').first().click();await sleep(1000);await pc.screenshot({path:'03-pc-photo-saved.png',fullPage:false});
  await sleep(20000);await phone.reload({waitUntil:'domcontentloaded',timeout:60000});await sleep(14000);await dismiss(phone);
  const mt=phone.locator('[data-mobile-tab="list"]:visible').first();if(await mt.count()){await mt.click();await sleep(900)}
  phoneState=await stateInfo(phone);const phoneFire=phoneState.entries.find(e=>e.id===fire.id)||phoneState.entries.find(e=>e.title===fire.title);const phonePhoto=phoneFire?await idbPhoto(phone,phoneFire.id):{exists:false,error:'entry missing'};
  await phone.screenshot({path:'04-phone-after-sync.png',fullPage:false});pcState=await stateInfo(pc);
  const result={version,ownerUserId,fireId:fire.id,mugenId:mugen.id,pairUrlGenerated:!!pairUrl,pcPhoto,phonePhoto,captured,pcOrder:pcState.entries.map(e=>e.title),phoneOrder:phoneState.entries.map(e=>e.title),pcEntries:pcState.entries,phoneEntries:phoneState.entries,log};
  fs.writeFileSync('result.json',JSON.stringify(result,null,2));console.log('RESULT '+JSON.stringify(result));await browser.close();
  if(!captured.some(r=>r.kind==='entry_photo_state_v2'&&r.itemId===fire.id&&r.state==='set'))process.exitCode=20;
  if(!captured.some(r=>r.kind==='entry_photo_chunk_v1'&&r.itemId===fire.id&&r.textLength>0))process.exitCode=21;
  if(!phonePhoto.exists)process.exitCode=22;
})().catch(e=>{console.error('E2E_FATAL',e);fs.writeFileSync('fatal.txt',String(e&&e.stack||e));process.exit(1)});
