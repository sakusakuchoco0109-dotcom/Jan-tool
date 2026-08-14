const { chromium } = require('playwright');
const fs=require('fs');
const APP='https://hilarious-haupia-6e0406.netlify.app/';
const patchedJs=fs.readFileSync('app-core-543-candidate.js','utf8');
const NAME='ChatGPT総合検証0814';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function makeContext(browser,phone=false){
  const ctx=await browser.newContext(phone?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:1000}});
  await ctx.route(/\/assets\/app-core-542\.js(?:\?.*)?$/,r=>r.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:patchedJs+"\nwindow.__RC543_CANDIDATE__='loaded';"}));
  await ctx.addInitScript(({NAME})=>{
    localStorage.setItem('fujiya_mitekore_early_access_v2',JSON.stringify({orderNumber:'99999999',verifiedAt:Date.now(),campaign:'full-audit'}));
    localStorage.setItem('fujiya_collection_setup_done_v1','1');
    localStorage.setItem('fujiya_collection_tutorial_seen_v2_rc1474','1');
    localStorage.setItem('fujiya_collection_first_run_seen_v20_2_35cn','1');
    localStorage.setItem('fujiya_collection_user_name',NAME);
    localStorage.setItem('fujiya_collection_share_opt_in_v1','1');
    localStorage.setItem('fujiya_collection_share_purchase_price_opt_in_v1','1');
  },{NAME});
  return ctx;
}
async function dismiss(page){
 for(const sel of ['[data-profile-unlock-close]','#rareBurstCloseBtn','.mike-talk-close','#tutorialCloseBtn','#firstRunCloseBtn']){try{const el=page.locator(sel).first();if(await el.count()&&await el.isVisible())await el.click({timeout:500})}catch{}}
}
async function snapshot(page,label){
  await dismiss(page);await sleep(250);
  const info=await page.evaluate(()=>{
    const vis=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
    const txt=e=>String(e.innerText||e.textContent||e.getAttribute('aria-label')||e.getAttribute('title')||'').replace(/\s+/g,' ').trim();
    const interact=[...document.querySelectorAll('button,a,input,textarea,select,[role="button"],[data-ui-tab],[data-mobile-tab],[data-desktop-tab]')].filter(vis).map(e=>({tag:e.tagName,id:e.id||'',cls:String(e.className||'').slice(0,120),text:txt(e).slice(0,160),type:e.getAttribute('type')||'',name:e.getAttribute('name')||'',placeholder:e.getAttribute('placeholder')||'',dataUi:e.getAttribute('data-ui-tab')||'',dataMobile:e.getAttribute('data-mobile-tab')||'',dataDesktop:e.getAttribute('data-desktop-tab')||'',action:e.getAttribute('data-action')||''}));
    const headings=[...document.querySelectorAll('h1,h2,h3,h4,.section-title,.panel-title,.modal-title')].filter(vis).map(txt).filter(Boolean);
    return {url:location.href,title:document.title,version:document.body.innerText.match(/RC1\.4\.\d+/)?.[0]||'',headings:[...new Set(headings)].slice(0,120),interact:interact.slice(0,800),body:document.body.innerText.slice(0,14000)};
  });
  fs.writeFileSync(`discovery-${label}.json`,JSON.stringify(info,null,2));
  await page.screenshot({path:`discovery-${label}.png`,fullPage:true});
  return info;
}
async function clickByText(page,text){
  const loc=page.getByText(text,{exact:true}).filter({visible:true}).first();
  if(await loc.count()){try{await loc.click({timeout:2500});await sleep(900);await dismiss(page);return true}catch{}}
  const b=page.locator('button,a,[role="button"]').filter({hasText:text}).first();
  if(await b.count()&&await b.isVisible()){try{await b.click({timeout:2500});await sleep(900);await dismiss(page);return true}catch{}}
  return false;
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const results={};
 for(const [kind,phone] of [['pc',false],['phone',true]]){
   const ctx=await makeContext(browser,phone),page=await ctx.newPage();
   const errors=[];page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.type().toUpperCase()+' '+m.text())});
   await page.goto(APP,{waitUntil:'domcontentloaded',timeout:60000});await sleep(7000);await dismiss(page);
   results[kind]={home:await snapshot(page,`${kind}-home`),views:{},errors};
   const candidates=['ホーム','一覧','登録','図鑑','リスト','みてレコ','みてマガ','プロフィール','その他','設定','データ','ショーケース','二つ名'];
   for(const name of candidates){
     try{
       const ok=await clickByText(page,name);
       if(ok) results[kind].views[name]=await snapshot(page,`${kind}-${name.replace(/[^\p{L}\p{N}]+/gu,'_')}`);
     }catch(e){errors.push(`NAV ${name}: ${e.message}`)}
   }
   await ctx.close();
 }
 // static source term discovery
 const terms=['みてレコ','みてマガ','ショーケース','買取','欲しい','プロフィール','二つ名','図鑑','レビュー','アンケート','記録投稿','競技','RSS'];
 results.source={};for(const t of terms){const arr=[];let pos=0;while((pos=patchedJs.indexOf(t,pos))>=0&&arr.length<12){arr.push(patchedJs.slice(Math.max(0,pos-700),Math.min(patchedJs.length,pos+1500)));pos+=t.length}results.source[t]=arr}
 fs.writeFileSync('full-discovery.json',JSON.stringify(results,null,2));
 console.log('DISCOVERY_SUMMARY '+JSON.stringify({pcViews:Object.keys(results.pc.views),phoneViews:Object.keys(results.phone.views),pcErrors:results.pc.errors.slice(-20),phoneErrors:results.phone.errors.slice(-20),sourceCounts:Object.fromEntries(Object.entries(results.source).map(([k,v])=>[k,v.length]))}));
 await browser.close();
})().catch(e=>{console.error('DISCOVERY_FATAL',e);fs.writeFileSync('discovery-fatal.txt',String(e&&e.stack||e));process.exit(1)});
