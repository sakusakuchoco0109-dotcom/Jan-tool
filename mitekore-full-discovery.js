const { chromium } = require('playwright');
const fs=require('fs');
const APP='https://hilarious-haupia-6e0406.netlify.app/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function setup(browser,phone){
  const ctx=await browser.newContext(phone?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:1000}});
  await ctx.addInitScript(()=>{
    localStorage.setItem('fujiya_mitekore_early_access_v2',JSON.stringify({orderNumber:'99999999',verifiedAt:Date.now(),campaign:'live-sweep'}));
    localStorage.setItem('fujiya_collection_setup_done_v1','1');
    localStorage.setItem('fujiya_collection_tutorial_seen_v2_rc1474','1');
    localStorage.setItem('fujiya_collection_first_run_seen_v20_2_35cn','1');
    localStorage.setItem('fujiya_collection_user_name','ChatGPT実画面監査');
  });
  return ctx;
}
async function dismiss(page){
  try{
    const agree=page.locator('#fujiyaLegalAgree14750');
    if(await agree.count()&&await agree.isVisible()){
      if(!(await agree.isChecked().catch(()=>false))) await agree.check({force:true});
      const ok=page.locator('#fujiyaLegalAccept14750');
      if(await ok.count()&&await ok.isVisible()){await ok.click({force:true});await sleep(700);}
    }
  }catch{}
  for(const sel of ['[data-profile-unlock-close]','#rareBurstCloseBtn','.mike-talk-close','#tutorialCloseBtn','#firstRunCloseBtn']){
    try{const el=page.locator(sel).first();if(await el.count()&&await el.isVisible())await el.click({force:true,timeout:600});}catch{}
  }
}
async function shot(page,label){
  await dismiss(page);await sleep(250);
  const data=await page.evaluate(()=>{
    const vis=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
    const txt=e=>String(e.innerText||e.textContent||e.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
    const els=[...document.querySelectorAll('button,a,input,select,textarea,[role="button"]')].filter(vis);
    return {url:location.href,title:document.title,body:document.body.innerText.slice(0,18000),
      buttons:els.map(e=>({tag:e.tagName,id:e.id||'',text:txt(e).slice(0,180),disabled:!!e.disabled,tab:e.getAttribute('data-ui-tab')||e.getAttribute('data-mobile-tab')||e.getAttribute('data-desktop-tab')||''})).slice(0,1000),
      headings:[...document.querySelectorAll('h1,h2,h3,h4,.section-title,.panel-title')].filter(vis).map(txt).filter(Boolean).slice(0,150),
      viewport:{w:innerWidth,h:innerHeight,scrollH:document.documentElement.scrollHeight}};
  });
  await page.screenshot({path:'discovery-'+label+'.png',fullPage:true});
  fs.writeFileSync('discovery-'+label+'.json',JSON.stringify(data,null,2));
  return data;
}
async function clickTab(page,tab){
  for(const sel of ['[data-ui-tab="'+tab+'"]','[data-mobile-tab="'+tab+'"]','[data-desktop-tab="'+tab+'"]']){
    const el=page.locator(sel).first();
    if(await el.count()&&await el.isVisible()){await el.click({force:true});await sleep(1200);await dismiss(page);return true;}
  }
  return false;
}
async function clickText(page,text){
  const el=page.getByText(text,{exact:true}).first();
  if(await el.count()&&await el.isVisible()){await el.click({force:true});await sleep(1000);await dismiss(page);return true;}
  const b=page.locator('button,a,[role="button"]').filter({hasText:text}).first();
  if(await b.count()&&await b.isVisible()){await b.click({force:true});await sleep(1000);await dismiss(page);return true;}
  return false;
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const out={app:APP,ranAt:new Date().toISOString()};
 for(const cfg of [{k:'pc',phone:false},{k:'phone',phone:true}]){
   const ctx=await setup(browser,cfg.phone),page=await ctx.newPage();
   const errors=[],responses=[];
   page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
   page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(m.type().toUpperCase()+' '+m.text())});
   page.on('response',r=>{if(r.status()>=400)responses.push({status:r.status(),url:r.url().slice(0,300)});});
   await page.goto(APP,{waitUntil:'domcontentloaded',timeout:60000});await sleep(7000);await dismiss(page);
   out[cfg.k]={errors,responses,views:{home:await shot(page,cfg.k+'-home')}};
   for(const [name,tab] of [['register','register'],['collection','list'],['dex','dex'],['magazine','magazine']]){
     try{if(await clickTab(page,tab))out[cfg.k].views[name]=await shot(page,cfg.k+'-'+name);}catch(e){errors.push('TAB '+name+' '+e.message);}
   }
   for(const name of ['その他','設定','プロフィール','みてレコ','ショーケース','二つ名']){
     try{if(await clickText(page,name))out[cfg.k].views[name]=await shot(page,cfg.k+'-'+name.replace(/[^0-9A-Za-z\u3040-\u30ff\u3400-\u9fff]/g,'_'));}catch(e){errors.push('TEXT '+name+' '+e.message);}
   }
   await ctx.close();
 }
 fs.writeFileSync('full-discovery.json',JSON.stringify(out,null,2));
 console.log('DISCOVERY_SUMMARY '+JSON.stringify({pcViews:Object.keys(out.pc.views),phoneViews:Object.keys(out.phone.views),pcErrors:out.pc.errors.slice(-20),phoneErrors:out.phone.errors.slice(-20),pcHttp:out.pc.responses.slice(-20),phoneHttp:out.phone.responses.slice(-20)}));
 await browser.close();
})().catch(e=>{fs.writeFileSync('discovery-fatal.txt',String(e&&e.stack||e));console.error(e);process.exit(1);});
