const { chromium } = require('playwright');
const fs = require('fs');

const TARGET='https://hilarious-haupia-6e0406.netlify.app/';
const EXPECTED='14831-onboarding-id-and-chrome-post-fix';
const MAIL_API='https://api.mail.tm';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function json(url,opt={}){const r=await fetch(url,opt);const t=await r.text();if(!r.ok)throw new Error(`${r.status}:${t.slice(0,250)}`);return t?JSON.parse(t):{};}
async function mailbox(){const d=await json(`${MAIL_API}/domains?page=1`);const domain=d?.['hydra:member']?.find(x=>x?.domain)?.domain;if(!domain)throw new Error('no mail domain');const address=`mitekore-live14831-${Date.now()}-${Math.random().toString(36).slice(2,7)}@${domain}`;const password=`Mtk!${Date.now()}Aa#${Math.random().toString(36).slice(2,9)}`;await json(`${MAIL_API}/accounts`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,password})});const tok=await json(`${MAIL_API}/token`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,password})});return{address,token:tok.token};}
async function getCode(mb,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){const list=await json(`${MAIL_API}/messages?page=1`,{headers:{authorization:`Bearer ${mb.token}`}});for(const m of list?.['hydra:member']||[]){const full=await json(`${MAIL_API}/messages/${m.id}`,{headers:{authorization:`Bearer ${mb.token}`}});const raw=[full.subject,full.text,...(Array.isArray(full.html)?full.html:[full.html])].filter(Boolean).join('\n');const x=raw.match(/(?:確認コード|認証コード|verification code)[^0-9]{0,100}([0-9]{6})/i)||raw.match(/\b([0-9]{6})\b/);if(x)return x[1];}await sleep(2000);}throw new Error('mail timeout');}

async function enterSetup(page){
  await page.waitForFunction(()=>!!document.getElementById('ufsChoiceFirst14759')&&!!document.getElementById('ufsSendCode14675'),null,{timeout:60000});
  try{await page.waitForFunction(()=>{const e=document.getElementById('fujiyaLegalGate14750');return !!e&&e.classList.contains('show')&&e.getAttribute('aria-hidden')==='false'},null,{timeout:8000});await page.check('#fujiyaLegalAgree14750');await page.click('#fujiyaLegalAccept14750');await page.waitForFunction(()=>{const e=document.getElementById('fujiyaLegalGate14750');return !e||!e.classList.contains('show')||e.getAttribute('aria-hidden')==='true'},null,{timeout:10000});}catch(_){}
  await page.click('#ufsChoiceFirst14759');
  await page.waitForFunction(()=>document.querySelector('[data-ufs-step="1"]')?.classList.contains('active'),null,{timeout:10000});
  await page.click('#ufsStartNormal14728');
  await page.waitForFunction(()=>document.querySelector('[data-ufs-step="2"]')?.classList.contains('active'),null,{timeout:10000});
}

async function runScenario(browser,name,{legacy=false,blackholeBeacon=false}={}){
  const mb=await mailbox();
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'ja-JP'});
  if(legacy)await context.addInitScript(()=>{
    localStorage.setItem('fujiya_collection_user_id','99999999');
    localStorage.setItem('fujiya_mitereco_identity_user_v2','99999999');
    localStorage.setItem('fujiya_device_identity_owner_user_v1','99999999');
    localStorage.setItem('fujiya_device_shared_canonical_user_v1','99999999');
    localStorage.setItem('fujiya_collection_v20_1',JSON.stringify({entries:[{id:'legacy-test',title:'旧テストデータ',platform:'FC'}]}));
  });
  if(blackholeBeacon)await context.addInitScript(()=>{try{Object.defineProperty(Navigator.prototype,'sendBeacon',{configurable:true,value:function(){return true;}})}catch(_){}});
  const page=await context.newPage();
  const r={name,legacy,blackholeBeacon,posts:[],polls:0,passed:false,consoleErrors:[],pageErrors:[]};
  page.on('console',m=>{if(m.type()==='error')r.consoleErrors.push(m.text())});
  page.on('pageerror',e=>r.pageErrors.push(String(e?.message||e)));
  page.on('request',req=>{if(!req.url().includes('script.google.com'))return;if(req.method()==='POST'){const p=new URLSearchParams(req.postData()||'');r.posts.push(p.get('action')||'');}else if(req.url().includes('cloud_backup_auth_status'))r.polls++;});
  try{
    const resp=await page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:60000});
    r.httpOk=!!resp&&resp.ok();
    await page.waitForFunction(()=>!!window.__FUJIYA_CLIENT_APP_VERSION__,null,{timeout:60000});
    r.appVersion=await page.evaluate(()=>String(window.__FUJIYA_CLIENT_APP_VERSION__||''));
    r.versionOk=r.appVersion===EXPECTED;
    if(!r.versionOk)throw new Error(`LIVE_VERSION_MISMATCH:${r.appVersion}`);
    await enterSetup(page);
    await page.fill('#ufsEmail14675',mb.address);
    await page.click('#ufsSendCode14675');
    await page.waitForFunction(()=>{const a=document.getElementById('ufsCodeArea14675');return a&&!a.hidden},null,{timeout:45000});
    const code=await getCode(mb);r.mailReceived=true;
    await page.fill('#ufsCode14675',code);
    const started=Date.now();
    await page.click('#ufsVerifyCode14675');
    await page.waitForFunction(()=>{const step3=document.querySelector('[data-ufs-step="3"]')?.classList.contains('active');const s=String(document.getElementById('ufsPhraseStatus14675')?.textContent||'');const e=String(document.getElementById('ufsAccountStatus14675')?.textContent||'');return (step3&&/メール確認とアカウント登録が完了/.test(s))||e.includes('本人確認要求をGASで受付確認できませんでした')||/CLOUD_BACKUP_/.test(e)},null,{timeout:90000});
    r.elapsedMs=Date.now()-started;
    r.accountStatus=await page.$eval('#ufsAccountStatus14675',e=>String(e.textContent||'').trim()).catch(()=> '');
    r.phraseStatus=await page.$eval('#ufsPhraseStatus14675',e=>String(e.textContent||'').trim()).catch(()=> '');
    r.success=/メール確認とアカウント登録が完了/.test(r.phraseStatus);
    r.finalUserId=await page.evaluate(()=>localStorage.getItem('fujiya_collection_user_id'));
    r.legacyIdMigrated=!legacy||(/^fujiya_/.test(String(r.finalUserId||''))&&r.finalUserId!=='99999999');
    r.verifyPostSeen=r.posts.includes('cloud_backup_setup_verify_frame');
    r.passed=r.versionOk&&r.success&&r.legacyIdMigrated&&r.verifyPostSeen&&!r.accountStatus.includes('本人確認要求をGASで受付確認できませんでした')&&r.pageErrors.length===0;
  }catch(e){r.error=String(e?.message||e)}
  await page.screenshot({path:`live14831-${name}.png`,fullPage:true}).catch(()=>{});
  await context.close();
  return r;
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const out={target:TARGET,expectedVersion:EXPECTED,startedAt:new Date().toISOString(),scenarios:[]};
  try{
    out.scenarios.push(await runScenario(browser,'legacy99999999',{legacy:true}));
    out.scenarios.push(await runScenario(browser,'beacon-blackhole',{blackholeBeacon:true}));
    out.passed=out.scenarios.every(x=>x.passed);
  }finally{
    await browser.close();out.finishedAt=new Date().toISOString();
    fs.writeFileSync('mitekore-14831-live-e2e-result.json',JSON.stringify(out,null,2));
    console.log(JSON.stringify(out,null,2));
  }
  if(!out.passed)process.exit(1);
})();
