const { chromium } = require('playwright');

const TARGET='https://hilarious-haupia-6e0406.netlify.app/';
const MAIL_API='https://api.mail.tm';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function json(url,opt={}){const r=await fetch(url,opt);const t=await r.text();if(!r.ok)throw new Error(`${r.status}:${t.slice(0,250)}`);return t?JSON.parse(t):{};}
async function mailbox(){const d=await json(`${MAIL_API}/domains?page=1`);const domain=d?.['hydra:member']?.find(x=>x?.domain)?.domain;if(!domain)throw new Error('no mail domain');const address=`mitekore-repro-${Date.now()}-${Math.random().toString(36).slice(2,7)}@${domain}`;const password=`Mtk!${Date.now()}Aa#${Math.random().toString(36).slice(2,9)}`;await json(`${MAIL_API}/accounts`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,password})});const tok=await json(`${MAIL_API}/token`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,password})});return{address,token:tok.token};}
async function getCode(mb,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){const list=await json(`${MAIL_API}/messages?page=1`,{headers:{authorization:`Bearer ${mb.token}`}});for(const m of list?.['hydra:member']||[]){const full=await json(`${MAIL_API}/messages/${m.id}`,{headers:{authorization:`Bearer ${mb.token}`}});const raw=[full.subject,full.text,...(Array.isArray(full.html)?full.html:[full.html])].filter(Boolean).join('\n');const x=raw.match(/(?:確認コード|認証コード|verification code)[^0-9]{0,100}([0-9]{6})/i)||raw.match(/\b([0-9]{6})\b/);if(x)return x[1];}await sleep(2000);}throw new Error('mail timeout');}

async function enterSetup(page){
  try{await page.waitForFunction(()=>{const e=document.getElementById('fujiyaLegalGate14750');return !!e&&e.classList.contains('show')&&e.getAttribute('aria-hidden')==='false'},null,{timeout:8000});await page.check('#fujiyaLegalAgree14750');await page.click('#fujiyaLegalAccept14750');await page.waitForFunction(()=>{const e=document.getElementById('fujiyaLegalGate14750');return !e||!e.classList.contains('show')||e.getAttribute('aria-hidden')==='true'},null,{timeout:10000});}catch(_){}
  const first=page.locator('#ufsStartFirst14728');
  if(await first.isVisible().catch(()=>false)) await first.click();
  await page.locator('#ufsStartNormal14728').waitFor({state:'visible',timeout:10000}).catch(()=>{});
  const normal=page.locator('#ufsStartNormal14728');
  if(await normal.isVisible().catch(()=>false)) await normal.click();
  await page.waitForSelector('#ufsEmail14675',{state:'visible',timeout:15000});
}

async function runScenario(browser,{name,seedLegacy=false,blackholeBeacon=false,expectSuccess=false,expectTimeout=false}){
  const mb=await mailbox();
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'ja-JP'});
  if(seedLegacy){
    await context.addInitScript(()=>{
      try{
        localStorage.setItem('fujiya_collection_user_id','99999999');
        localStorage.setItem('fujiya_mitereco_identity_user_v2','99999999');
        localStorage.setItem('fujiya_device_identity_owner_user_v1','99999999');
        localStorage.setItem('fujiya_device_shared_canonical_user_v1','99999999');
        localStorage.setItem('fujiya_collection_v20_1',JSON.stringify({entries:[{id:'legacy-test',title:'旧テストデータ',platform:'FC',updatedAt:'2026-01-01T00:00:00Z'}]}));
      }catch(_){}
    });
  }
  if(blackholeBeacon){
    await context.addInitScript(()=>{
      try{Object.defineProperty(Navigator.prototype,'sendBeacon',{configurable:true,value:function(){return true;}})}catch(_){}
    });
  }
  const page=await context.newPage();
  const result={name,seedLegacy,blackholeBeacon,posts:[],statusPolls:0,passed:false};
  page.on('request',req=>{if(!req.url().includes('script.google.com'))return;if(req.method()==='POST'){const p=new URLSearchParams(req.postData()||'');result.posts.push(p.get('action')||'');}else if(req.url().includes('cloud_backup_auth_status'))result.statusPolls++;});
  try{
    await page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForSelector('#ufsSendCode14675',{state:'attached',timeout:60000});
    await enterSetup(page);
    await page.fill('#ufsEmail14675',mb.address);
    await page.click('#ufsSendCode14675');
    await page.waitForFunction(()=>{const a=document.getElementById('ufsCodeArea14675');return a&&!a.hidden},null,{timeout:45000});
    result.codeAreaVisible=true;
    const code=await getCode(mb);
    result.mailReceived=true;
    await page.fill('#ufsCode14675',code);
    const start=Date.now();
    await page.click('#ufsVerifyCode14675');
    await page.waitForFunction(()=>{
      const success=document.querySelector('[data-ufs-step="3"]')?.classList.contains('active')&&/メール確認とアカウント登録が完了/.test(String(document.getElementById('ufsPhraseStatus14675')?.textContent||''));
      const status=String(document.getElementById('ufsAccountStatus14675')?.textContent||'');
      return success||status.includes('本人確認要求をGASで受付確認できませんでした')||/CLOUD_BACKUP_/.test(status);
    },null,{timeout:90000});
    result.elapsedMs=Date.now()-start;
    result.accountStatus=await page.$eval('#ufsAccountStatus14675',e=>String(e.textContent||'').trim()).catch(()=> '');
    result.phraseStatus=await page.$eval('#ufsPhraseStatus14675',e=>String(e.textContent||'').trim()).catch(()=> '');
    result.success=/メール確認とアカウント登録が完了/.test(result.phraseStatus);
    result.timeoutError=result.accountStatus.includes('本人確認要求をGASで受付確認できませんでした');
    if(expectSuccess)result.passed=result.success&&!result.timeoutError;
    else if(expectTimeout)result.passed=result.timeoutError&&!result.success;
  }catch(e){result.error=String(e?.message||e);}
  await page.screenshot({path:`mike-repro-${name}.png`,fullPage:true}).catch(()=>{});
  await context.close();
  return result;
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const out={target:TARGET,startedAt:new Date().toISOString(),scenarios:[]};
  try{
    out.scenarios.push(await runScenario(browser,{name:'legacy99999999',seedLegacy:true,blackholeBeacon:false,expectSuccess:true}));
    out.scenarios.push(await runScenario(browser,{name:'beacon-blackhole',seedLegacy:false,blackholeBeacon:true,expectTimeout:true}));
    out.passed=out.scenarios.every(x=>x.passed);
  }finally{out.finishedAt=new Date().toISOString();require('fs').writeFileSync('mitekore-mike-repro-0914-result.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));await browser.close();}
  if(!out.passed)process.exit(1);
})();
