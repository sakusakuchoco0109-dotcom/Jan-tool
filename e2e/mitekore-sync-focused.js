const { chromium } = require('playwright');
const BASE='https://hilarious-haupia-6e0406.netlify.app/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out={checks:[],console:[],timings:{}};
function check(name,ok,detail=''){out.checks.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' :: '+detail:''));}
function watch(page,who){
  page.on('console',m=>{
    const t=m.type(),s=m.text();
    if(/端末同期|DEVICE_SYNC|device_sync|POST完了通知|PT_BALANCE_BUSY|TITLE_MASTER/i.test(s)){
      out.console.push({who,type:t,text:s}); console.log('['+who+']['+t+'] '+s);
    }
  });
}
async function boot(page,who){
  watch(page,who);
  const t=Date.now();
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:120000});
  out.timings[who+'_dom_ms']=Date.now()-t;
  await page.waitForTimeout(1000);
  const normal=page.locator('#fujiyaEarlyAccessNormalStart14728');
  if(await normal.isVisible().catch(()=>false)){await normal.click();await page.waitForTimeout(250);}
  const agree=page.locator('#fujiyaLegalAgree14750');
  if(await agree.isVisible().catch(()=>false)){
    await agree.check(); await page.locator('#fujiyaLegalAccept14750').click(); await page.waitForTimeout(250);
  }
  const unified=page.locator('#unifiedFirstSetup14675');
  if(await unified.isVisible().catch(()=>false)){
    await page.evaluate(()=>{
      localStorage.setItem('fujiya_unified_first_setup_v1_done','1');
      localStorage.setItem('fujiya_collection_setup_done_v1',new Date().toISOString());
      localStorage.setItem('fujiya_collection_first_run_seen_v20_2_35cn','1');
      localStorage.setItem('fujiya_collection_tutorial_seen_v2_rc1474','1');
      window.__MITEKORE_UNIFIED_SETUP_ACTIVE__=false;
      const el=document.getElementById('unifiedFirstSetup14675');if(el){el.hidden=true;el.style.display='none';}
    });
  }
  check(who+' 起動',true,out.timings[who+'_dom_ms']+'ms');
}
async function goRegister(page){
  await page.evaluate(()=>{
    (document.querySelector('[data-mobile-tab="register"]')||document.querySelector('[data-ui-tab="register"]'))?.click();
  });
  await page.waitForTimeout(400);
  const quick=page.locator('#quickRegisterModeBtn');
  if(await quick.isVisible().catch(()=>false))await quick.click();
}
async function addGame(page,who,title){
  await goRegister(page);
  await page.locator('#platform').fill('SFC');
  await page.locator('#title').fill(title);
  const c=page.locator('#masterCandidates .candidate-item').filter({hasText:title}).first();
  const ct=Date.now();
  await c.waitFor({state:'visible',timeout:10000});
  const cms=Date.now()-ct;
  await c.click();
  check(who+' 候補 '+title,true,cms+'ms');
  const save=page.locator('#saveBtn');
  await save.waitFor({state:'visible',timeout:10000});
  const st=Date.now(); await save.click();
  await page.waitForFunction(t=>Array.isArray(window.state?.entries)&&window.state.entries.some(e=>String(e.title||'').includes(t)),title,{timeout:30000});
  check(who+' 登録 '+title,true,(Date.now()-st)+'ms');
}
async function waitTitle(page,title,timeout=90000){
  const t=Date.now();
  try{
    await page.waitForFunction(tt=>Array.isArray(window.state?.entries)&&window.state.entries.some(e=>String(e.title||'').includes(tt)),title,{timeout});
    return Date.now()-t;
  }catch(e){return -1;}
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const pcCtx=await browser.newContext({viewport:{width:1440,height:900}});
    const pc=await pcCtx.newPage();
    await boot(pc,'PC');
    await addGame(pc,'PC','スーパーマリオワールド');

    const setup=await pc.evaluate(async()=>{
      const key=window.deviceSyncGenerateKey();
      localStorage.setItem('fujiya_device_sync_secret_v1',key);
      localStorage.setItem('fujiya_device_sync_device_name_v1','GitHub-PC');
      const t=Date.now();
      const remote=await window.deviceSyncPull(key);
      const records=window.deviceSyncCaptureLocalRecords();
      const pushed=await window.deviceSyncPush(key,Number(remote?.revision||0),records,{requestId:'ghfocus-'+Date.now()});
      return {key,pushMs:Date.now()-t,revision:Number(pushed?.revision||0),count:records.length};
    });
    check('PC 初期同期送信',true,setup.pushMs+'ms records='+setup.count+' rev='+setup.revision);

    const mobCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const mobile=await mobCtx.newPage();
    await boot(mobile,'スマホ');
    await mobile.evaluate(key=>{
      localStorage.setItem('fujiya_device_sync_secret_v1',key);
      localStorage.setItem('fujiya_device_sync_device_name_v1','GitHub-Mobile');
    },setup.key);
    const tPull=Date.now();
    await mobile.reload({waitUntil:'domcontentloaded',timeout:120000});
    await mobile.waitForTimeout(500);
    // clear gates after reload if needed
    const normal=mobile.locator('#fujiyaEarlyAccessNormalStart14728');if(await normal.isVisible().catch(()=>false))await normal.click();
    const pcToMobile=await waitTitle(mobile,'スーパーマリオワールド',90000);
    check('PC→スマホ自動同期',pcToMobile>=0,pcToMobile+'ms');

    await addGame(mobile,'スマホ','クロノ・トリガー');
    const mobileToPc=await waitTitle(pc,'クロノ・トリガー',90000);
    check('スマホ→PC自動同期',mobileToPc>=0,mobileToPc+'ms');

    const revErrors=out.console.filter(x=>/revision確認.*(タイムアウト|Unknown action)/i.test(x.text));
    check('revision軽量確認',revErrors.length===0,revErrors.length?'errors='+revErrors.length:'timeout/Unknown actionなし');
    out.timings.pc_to_mobile_ms=pcToMobile;out.timings.mobile_to_pc_ms=mobileToPc;out.timings.initial_push_ms=setup.pushMs;
    console.log('RESULT_JSON '+JSON.stringify(out));
    if(pcToMobile<0||mobileToPc<0)process.exitCode=2;
    await mobCtx.close(); await pcCtx.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});