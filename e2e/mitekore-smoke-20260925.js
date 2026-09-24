// rerun: 2026-09-25 updated netlify
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://hilarious-haupia-6e0406.netlify.app/';
const out = { startedAt: new Date().toISOString(), base: BASE, checks: [], console: [], pageErrors: [], timings: {}, notes: [] };
const check=(name,ok,detail='')=>{ out.checks.push({name,ok,detail}); console.log((ok?'PASS':'FAIL')+' '+name+(detail?' :: '+detail:'')); };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safeShot=async(page,name)=>{ try{ await page.screenshot({path:'artifacts/'+name+'.png',fullPage:true}); }catch(e){} };
const titleInSync=async(page,title)=>page.evaluate((t)=>{
  try { return JSON.stringify(window.deviceSyncCaptureLocalRecords?.()||[]).includes(t); } catch(e){ return false; }
}, title);

async function ensureNormalAccess(page){
  const gate=page.locator('#fujiyaEarlyAccessGateV1');
  if(await gate.isVisible().catch(()=>false)){
    const normal=page.locator('#fujiyaEarlyAccessNormalStart14728');
    if(await normal.isVisible().catch(()=>false)){
      await normal.click();
      await page.waitForTimeout(500);
    }
  }
}
async function acceptLegal(page){
  const gate=page.locator('#fujiyaLegalGate14750');
  if(await gate.isVisible().catch(()=>false)){
    await page.locator('#fujiyaLegalAgree14750').check();
    await page.locator('#fujiyaLegalAccept14750').click();
    await page.waitForTimeout(500);
  }
}
async function boot(page, name){
  page.on('console',m=>{ const txt=m.text(); out.console.push({who:name,type:m.type(),text:txt}); console.log('['+name+']['+m.type()+'] '+txt); });
  page.on('pageerror',e=>{ out.pageErrors.push({who:name,error:String(e.stack||e)}); console.log('['+name+'][pageerror] '+String(e)); });
  const t0=Date.now();
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:120000});
  out.timings[name+'_dom_ms']=Date.now()-t0;
  await page.waitForTimeout(2500);
  await ensureNormalAccess(page);
  await acceptLegal(page);
  const newBtn=page.locator('#firstRunNewBtn');
  if(await newBtn.isVisible().catch(()=>false)){
    await newBtn.click();
    await page.locator('#firstRunName').fill('ChatGPT同期検証0925-'+name);
    await page.locator('#firstRunNextBtn').click();
    await page.locator('#firstRunStartBtn').click();
    await page.waitForTimeout(1200);
  }
  await acceptLegal(page);
  const unified=page.locator('#unifiedFirstSetup14675');
  if(await unified.isVisible().catch(()=>false)){
    await page.evaluate(()=>{
      localStorage.setItem('fujiya_unified_first_setup_v1_done','1');
      localStorage.setItem('fujiya_collection_setup_done_v1',new Date().toISOString());
      localStorage.setItem('fujiya_collection_first_run_seen_v20_2_35cn','1');
      localStorage.setItem('fujiya_collection_tutorial_seen_v2_rc1474','1');
      window.__MITEKORE_UNIFIED_SETUP_ACTIVE__=false;
      const el=document.getElementById('unifiedFirstSetup14675'); if(el){el.hidden=true;el.style.display='none';}
    });
    out.notes.push(name+' unified初回設定はメール確認必須のためE2Eでは完了フラグを付与して本体テストへ移行');
  }
  check(name+' 起動', true, 'DOM '+out.timings[name+'_dom_ms']+'ms');
}

async function goTab(page, tab){
  await page.evaluate((t)=>{
    const d=document.querySelector('[data-ui-tab="'+t+'"]');
    const m=document.querySelector('[data-mobile-tab="'+t+'"]');
    (m||d)?.click();
  },tab);
  await page.waitForTimeout(650);
}
async function addGame(page, platform, title, rating='4'){
  const start=Date.now();
  await goTab(page,'register');
  const quick=page.locator('#quickRegisterModeBtn');
  if(await quick.isVisible().catch(()=>false)) await quick.click();
  await page.locator('#platform').fill(platform);
  await page.locator('#platform').dispatchEvent('change').catch(()=>{});
  await page.locator('#title').fill(title);
  const candidate=page.locator('#masterCandidates .candidate-item').filter({hasText:title}).first();
  let masterSelected=false;
  try{
    await candidate.waitFor({state:'visible',timeout:12000});
    await candidate.click();
    masterSelected=true;
  }catch(e){
    out.notes.push('タイトル候補未表示のため手入力登録へ継続: '+title);
    check('タイトル候補 '+title,false,'12秒以内に候補が出ない');
  }
  await page.locator('#rating').selectOption(rating).catch(()=>{});
  const save=page.locator('#saveBtn');
  await save.waitFor({state:'visible',timeout:10000});
  if(await save.isDisabled()) throw new Error('saveBtn disabled: '+await save.textContent());
  await save.click();
  await page.waitForTimeout(1800);
  const ok=await titleInSync(page,title);
  check('登録 '+title,ok,(Date.now()-start)+'ms / master='+masterSelected);
  return Date.now()-start;
}

async function basicInteractions(page, who){
  try{
    await goTab(page,'list');
    const count=await page.locator('#cards .card').count().catch(()=>0);
    check(who+' 一覧表示',count>0,'cards='+count);
  }catch(e){ check(who+' 一覧表示',false,String(e)); }

  try{
    await goTab(page,'dex');
    await page.waitForTimeout(550);
    const text=(await page.locator('#dexPanel').innerText().catch(()=>'' )).slice(0,300);
    check(who+' 図鑑表示',!!text,text.replace(/\s+/g,' ').slice(0,140));
  }catch(e){ check(who+' 図鑑表示',false,String(e)); }

  try{
    const searchButtons=page.locator('[data-global-search-open596]');
    let searchBtn=null;
    for(let i=0;i<await searchButtons.count();i++){ const b=searchButtons.nth(i); if(await b.isVisible().catch(()=>false)){searchBtn=b;break;} }
    if(searchBtn){
      await searchBtn.click();
      await page.waitForTimeout(400);
      const input=page.locator('#globalSearchInput596');
      if(await input.isVisible().catch(()=>false)){
        await input.fill('マリオ');
        await page.waitForTimeout(900);
        const txt=(await page.locator('#globalSearchModal596').innerText().catch(()=>'' )).slice(0,600);
        check(who+' 全体検索',/マリオ|検索結果|該当/.test(txt),txt.replace(/\s+/g,' ').slice(0,180));
        await page.keyboard.press('Escape').catch(()=>{});
      }
    }
  }catch(e){ check(who+' 全体検索',false,String(e)); }
}
async function tapTabs(page, who){
  const tabs=['list','dex','data','log','magazine','sync','manage'];
  for(const tab of tabs){
    try{
      await goTab(page,tab);
      await page.waitForTimeout(250);
      check(who+' タブ '+tab,true);
    }catch(e){ check(who+' タブ '+tab,false,String(e)); }
  }
}

(async()=>{
  fs.mkdirSync('artifacts',{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    const desktopCtx=await browser.newContext({viewport:{width:1440,height:1000}});
    const desktop=await desktopCtx.newPage();
    await boot(desktop,'PC');
    await addGame(desktop,'SFC','スーパーマリオワールド','5');
    await safeShot(desktop,'01-pc-after-register');

    await basicInteractions(desktop,'PC');
    await tapTabs(desktop,'PC');
    const lateMaster=await desktop.evaluate(()=>({
      count:(typeof MASTER_TITLES!=='undefined'&&Array.isArray(MASTER_TITLES))?MASTER_TITLES.length:null,
      indexReady:!!window.fujiyaMasterSearchIndexReady?.(),
      mario:(typeof findMasterCandidates==='function')?findMasterCandidates('スーパーマリオワールド').slice(0,5).map(x=>({title:x.canonicalTitle,platform:x.platform,id:x.sharedTitleId})):[]
    }));
    check('PC タイトルDB遅延後状態',Number(lateMaster.count||0)>1000,JSON.stringify(lateMaster));
    await safeShot(desktop,'02-pc-tabs');

    const syncSetup=await desktop.evaluate(async()=>{
      const key=window.deviceSyncGenerateKey();
      localStorage.setItem('fujiya_device_sync_secret_v1',key);
      localStorage.setItem('fujiya_device_sync_device_name_v1','GitHub-PC');
      const remote=await window.deviceSyncPull(key);
      const records=window.deviceSyncCaptureLocalRecords();
      const pushed=await window.deviceSyncPush(key,Number(remote?.revision||0),records,{requestId:'gh-'+Date.now()});
      return {key,revision:pushed?.revision||remote?.revision||0,count:records.length};
    });
    check('PC同期初期送信',!!syncSetup.key,'records='+syncSetup.count+' rev='+syncSetup.revision);

    const mobileCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const mobile=await mobileCtx.newPage();
    await boot(mobile,'スマホ');
    await mobile.evaluate(({key})=>{
      localStorage.setItem('fujiya_device_sync_secret_v1',key);
      localStorage.setItem('fujiya_device_sync_device_name_v1','GitHub-スマホ');
    },syncSetup);
    await mobile.reload({waitUntil:'domcontentloaded',timeout:120000});
    await mobile.waitForTimeout(1200);
    await ensureNormalAccess(mobile);
    await acceptLegal(mobile);
    const mStart=Date.now();
    let gotPc=false;
    for(let i=0;i<90;i++){
      if(await titleInSync(mobile,'スーパーマリオワールド')){gotPc=true;break;}
      await sleep(2000);
    }
    out.timings.pc_to_mobile_ms=Date.now()-mStart;
    check('PC→スマホ自動同期',gotPc,out.timings.pc_to_mobile_ms+'ms');
    await safeShot(mobile,'03-mobile-after-pull');

    await addGame(mobile,'SFC','クロノ・トリガー','4');
    const pStart=Date.now();
    let gotMobile=false;
    for(let i=0;i<120;i++){
      if(await titleInSync(desktop,'クロノ・トリガー')){gotMobile=true;break;}
      await sleep(2000);
    }
    out.timings.mobile_to_pc_ms=Date.now()-pStart;
    check('スマホ→PC自動同期',gotMobile,out.timings.mobile_to_pc_ms+'ms');

    await basicInteractions(mobile,'スマホ');
    await tapTabs(mobile,'スマホ');
    await safeShot(mobile,'04-mobile-tabs');

    // UIのはみ出し・上被りの簡易監査
    const layout=await mobile.evaluate(()=>{
      const bad=[];
      const vw=innerWidth,vh=innerHeight;
      const selectors=['#mobileBottomNav','.mitemaga-reader-card','.public-profile-hub-card','.modal-backdrop > *','.image-modal-backdrop > *'];
      for(const s of selectors){
        document.querySelectorAll(s).forEach(el=>{
          const st=getComputedStyle(el); if(st.display==='none'||st.visibility==='hidden') return;
          const r=el.getBoundingClientRect();
          if(r.left<-2||r.right>vw+2||r.top<-2||r.bottom>vh+2) bad.push({selector:s,rect:{x:r.x,y:r.y,w:r.width,h:r.height},vw,vh});
        });
      }
      return bad;
    });
    check('スマホ固定UI画面外監査',layout.length===0,JSON.stringify(layout));

    // 重大なconsole errorだけ抽出（favicon等は除外）
    const severe=out.console.filter(x=>x.type==='error'&&!/favicon|ERR_BLOCKED_BY_CLIENT/i.test(x.text));
    out.notes.push('console error count='+severe.length);
    check('重大console error',severe.length===0,severe.slice(0,10).map(x=>x.text).join(' | '));

    await desktopCtx.close(); await mobileCtx.close();
  } catch(e){
    check('E2E全体',false,String(e.stack||e));
    console.error(e);
  } finally {
    out.finishedAt=new Date().toISOString();
    fs.writeFileSync('artifacts/results.json',JSON.stringify(out,null,2));
    console.log('RESULT_JSON '+JSON.stringify(out));
    await browser.close();
  }
})();