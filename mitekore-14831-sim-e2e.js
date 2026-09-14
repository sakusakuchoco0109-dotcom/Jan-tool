const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');

const TARGET='https://hilarious-haupia-6e0406.netlify.app/';
const MAIL_API='https://api.mail.tm';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function json(url,opt={}){const r=await fetch(url,opt);const t=await r.text();if(!r.ok)throw new Error(`${r.status}:${t.slice(0,250)}`);return t?JSON.parse(t):{};}
async function mailbox(){const d=await json(`${MAIL_API}/domains?page=1`);const domain=d?.['hydra:member']?.find(x=>x?.domain)?.domain;if(!domain)throw new Error('no mail domain');const address=`mitekore-14831-${Date.now()}-${Math.random().toString(36).slice(2,7)}@${domain}`;const password=`Mtk!${Date.now()}Aa#${Math.random().toString(36).slice(2,9)}`;await json(`${MAIL_API}/accounts`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,password})});const tok=await json(`${MAIL_API}/token`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,password})});return{address,token:tok.token};}
async function getCode(mb,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){const list=await json(`${MAIL_API}/messages?page=1`,{headers:{authorization:`Bearer ${mb.token}`}});for(const m of list?.['hydra:member']||[]){const full=await json(`${MAIL_API}/messages/${m.id}`,{headers:{authorization:`Bearer ${mb.token}`}});const raw=[full.subject,full.text,...(Array.isArray(full.html)?full.html:[full.html])].filter(Boolean).join('\n');const x=raw.match(/(?:確認コード|認証コード|verification code)[^0-9]{0,100}([0-9]{6})/i)||raw.match(/\b([0-9]{6})\b/);if(x)return x[1];}await sleep(2000);}throw new Error('mail timeout');}

function patch14831(html){
  html=html.replace("window.__FUJIYA_CLIENT_APP_VERSION__='14829-cloud-auth-netlify-post-fix';","window.__FUJIYA_CLIENT_APP_VERSION__='14831-onboarding-id-and-chrome-post-fix';");
  const ensureRe=/  function ensureOnboardingUserId\(\)\{[\s\S]*?\n  \}\n  function normalizeEmail/;
  const ensureNew=`  const ONBOARDING_USER_ID_KEY_14831='fujiya_cloud_onboarding_user_id_v1';\n  const ONBOARDING_EMAIL_KEY_14831='fujiya_cloud_onboarding_email_v1';\n  const validOnboardingUserId14831=value=>/^fujiya_[A-Za-z0-9._:-]{6,190}$/.test(String(value||'').trim());\n  function clearOnboardingUserId14831(){try{localStorage.removeItem(ONBOARDING_USER_ID_KEY_14831);localStorage.removeItem(ONBOARDING_EMAIL_KEY_14831)}catch(_){}}\n  function ensureOnboardingUserId(emailValue=''){\n    const email=String(emailValue||'').trim().toLowerCase();\n    const pinned=safeGet(ONBOARDING_USER_ID_KEY_14831).trim(),pinnedEmail=safeGet(ONBOARDING_EMAIL_KEY_14831).trim().toLowerCase();\n    if(validOnboardingUserId14831(pinned)&&(!email||!pinnedEmail||pinnedEmail===email)){if(email&&!pinnedEmail)safeSet(ONBOARDING_EMAIL_KEY_14831,email);return pinned;}\n    if(email&&pinnedEmail&&pinnedEmail!==email)clearOnboardingUserId14831();\n    const keys=['fujiya_collection_user_id','fujiya_mitereco_identity_user_v2'];let id='';\n    for(const key of keys){const value=safeGet(key).trim();if(validOnboardingUserId14831(value)){id=value;break}}\n    if(!id){try{id=\`fujiya_\${crypto.randomUUID()}\`}catch(_){id=\`fujiya_\${Date.now().toString(36)}_\${Math.random().toString(36).slice(2,12)}\`}}\n    safeSet(ONBOARDING_USER_ID_KEY_14831,id);if(email)safeSet(ONBOARDING_EMAIL_KEY_14831,email);keys.forEach(k=>{if(!validOnboardingUserId14831(safeGet(k)))safeSet(k,id)});return id;\n  }\n  function normalizeEmail`;
  if(!ensureRe.test(html))throw new Error('ensure patch target missing');
  html=html.replace(ensureRe,ensureNew);

  const transportRe=/  function cloudPostNoWait14673\(action,fields=\{\},requestId=''\)\{[\s\S]*?\n  \}\n  function requestId14673/;
  const transportNew=`  async function cloudPostNoWait14673(action,fields={},requestId=''){\n    const id=String(requestId||requestId14673(action));\n    if(action==='cloud_backup_code_frame'){const payload=new URLSearchParams({action:String(action||''),requestId:id});Object.entries(fields||{}).forEach(([k,v])=>payload.set(k,String(v??'')));try{navigator.sendBeacon?.(GAS,payload)}catch(_){}try{void fetch(GAS,{method:'POST',mode:'no-cors',credentials:'omit',cache:'no-store',redirect:'follow',keepalive:true,body:payload}).catch(()=>{})}catch(_){}try{window.submitGasPostFormNoWait?.(action,fields,id,GAS)}catch(_){}return id;}\n    const payload=new URLSearchParams({action:String(action||''),requestId:id});Object.entries(fields||{}).forEach(([k,v])=>payload.set(k,String(v??'')));\n    try{await fetch(GAS,{method:'POST',mode:'no-cors',credentials:'omit',cache:'no-store',redirect:'follow',keepalive:true,body:payload});return id}catch(fetchError){console.warn('cloud auth fetch POST failed; beacon fallback',fetchError)}\n    try{if(typeof navigator.sendBeacon==='function'&&navigator.sendBeacon(GAS,payload))return id}catch(_){}\n    if(typeof window.submitGasPostFormNoWait==='function'){try{window.submitGasPostFormNoWait(action,fields,id,GAS);return id}catch(_){}}\n    throw new Error('本人確認要求を送信できませんでした。ブラウザの通信設定を確認してもう一度お試しください');\n  }\n  function requestId14673`;
  if(!transportRe.test(html))throw new Error('transport patch target missing');
  html=html.replace(transportRe,transportNew);
  html=html.replace("    cloudPostNoWait14673(action,{...fields,appVersion:String(window.__FUJIYA_CLIENT_APP_VERSION__||'RC1.4.662-device-sync-timeout-fix')},rid);","    await cloudPostNoWait14673(action,{...fields,appVersion:String(window.__FUJIYA_CLIENT_APP_VERSION__||'RC1.4.662-device-sync-timeout-fix')},rid);");
  html=html.replace("authPost('cloud_backup_code_frame',{mode:'setup',email,userId:ensureOnboardingUserId()})","authPost('cloud_backup_code_frame',{mode:'setup',email,userId:ensureOnboardingUserId(email)})");
  html=html.replace("const userId=ensureOnboardingUserId();\n    if(!/^fuji_","const userId=ensureOnboardingUserId(email);\n    if(!/^fuji_");
  html=html.replace("const userId=ensureOnboardingUserId();\n    const sourceSyncKey","const userId=ensureOnboardingUserId(email);\n    const sourceSyncKey");
  html=html.replace("    storeCloudCredentials(email,phrase,r);\n\n    // 14768:","    storeCloudCredentials(email,phrase,r);\n    clearOnboardingUserId14831();\n\n    // 14768:");
  return html;
}

async function enterSetup(page){
  await page.waitForFunction(()=>!!document.getElementById('ufsChoiceFirst14759')&&!!document.getElementById('ufsSendCode14675'),null,{timeout:60000});
  try{await page.waitForFunction(()=>{const e=document.getElementById('fujiyaLegalGate14750');return !!e&&e.classList.contains('show')&&e.getAttribute('aria-hidden')==='false'},null,{timeout:8000});await page.check('#fujiyaLegalAgree14750');await page.click('#fujiyaLegalAccept14750');}catch(_){}
  await page.click('#ufsChoiceFirst14759');
  await page.waitForFunction(()=>document.querySelector('[data-ufs-step="1"]')?.classList.contains('active'),null,{timeout:10000});
  await page.click('#ufsStartNormal14728');
  await page.waitForFunction(()=>document.querySelector('[data-ufs-step="2"]')?.classList.contains('active'),null,{timeout:10000});
}

async function runScenario(browser,name,{legacy=false,blackholeBeacon=false}={}){
  const mb=await mailbox();const context=await browser.newContext({viewport:{width:1280,height:900},locale:'ja-JP'});
  if(legacy)await context.addInitScript(()=>{localStorage.setItem('fujiya_collection_user_id','99999999');localStorage.setItem('fujiya_mitereco_identity_user_v2','99999999');localStorage.setItem('fujiya_device_identity_owner_user_v1','99999999');localStorage.setItem('fujiya_device_shared_canonical_user_v1','99999999');localStorage.setItem('fujiya_collection_v20_1',JSON.stringify({entries:[{id:'legacy-test',title:'旧テストデータ',platform:'FC'}]}));});
  if(blackholeBeacon)await context.addInitScript(()=>{try{Object.defineProperty(Navigator.prototype,'sendBeacon',{configurable:true,value:function(){return true;}})}catch(_){}});
  const page=await context.newPage();const r={name,legacy,blackholeBeacon,posts:[],polls:0,passed:false};
  page.on('request',req=>{if(!req.url().includes('script.google.com'))return;if(req.method()==='POST'){const p=new URLSearchParams(req.postData()||'');r.posts.push(p.get('action')||'');}else if(req.url().includes('cloud_backup_auth_status'))r.polls++;});
  try{
    await page.goto('http://127.0.0.1:18031/',{waitUntil:'domcontentloaded',timeout:60000});await enterSetup(page);
    await page.fill('#ufsEmail14675',mb.address);await page.click('#ufsSendCode14675');await page.waitForFunction(()=>{const a=document.getElementById('ufsCodeArea14675');return a&&!a.hidden},null,{timeout:45000});
    const code=await getCode(mb);r.mailReceived=true;await page.fill('#ufsCode14675',code);const started=Date.now();await page.click('#ufsVerifyCode14675');
    await page.waitForFunction(()=>{const step3=document.querySelector('[data-ufs-step="3"]')?.classList.contains('active');const s=String(document.getElementById('ufsPhraseStatus14675')?.textContent||'');const e=String(document.getElementById('ufsAccountStatus14675')?.textContent||'');return (step3&&/メール確認とアカウント登録が完了/.test(s))||e.includes('本人確認要求をGASで受付確認できませんでした')||/CLOUD_BACKUP_/.test(e)},null,{timeout:90000});
    r.elapsedMs=Date.now()-started;r.accountStatus=await page.$eval('#ufsAccountStatus14675',e=>String(e.textContent||'').trim()).catch(()=> '');r.phraseStatus=await page.$eval('#ufsPhraseStatus14675',e=>String(e.textContent||'').trim()).catch(()=> '');r.success=/メール確認とアカウント登録が完了/.test(r.phraseStatus);r.finalUserId=await page.evaluate(()=>localStorage.getItem('fujiya_collection_user_id'));r.passed=r.success&&!r.accountStatus.includes('本人確認要求をGASで受付確認できませんでした');
  }catch(e){r.error=String(e?.message||e)}
  await page.screenshot({path:`14831-${name}.png`,fullPage:true}).catch(()=>{});await context.close();return r;
}

(async()=>{
  const live=await (await fetch(TARGET)).text();const patched=patch14831(live);fs.writeFileSync('14831-patched-from-live.html',patched);
  const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(patched)});await new Promise((ok,ng)=>server.listen(18031,'127.0.0.1',e=>e?ng(e):ok()));
  const browser=await chromium.launch({headless:true});const out={startedAt:new Date().toISOString(),scenarios:[]};
  try{out.scenarios.push(await runScenario(browser,'legacy99999999',{legacy:true}));out.scenarios.push(await runScenario(browser,'beacon-blackhole',{blackholeBeacon:true}));out.passed=out.scenarios.every(x=>x.passed);}finally{await browser.close();server.close();out.finishedAt=new Date().toISOString();fs.writeFileSync('mitekore-14831-sim-e2e-result.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));}
  if(!out.passed)process.exit(1);
})();
