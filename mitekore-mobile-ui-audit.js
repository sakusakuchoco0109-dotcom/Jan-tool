const { chromium } = require('playwright');
const fs = require('fs');
const vm = require('vm');
const APP = 'https://hilarious-haupia-6e0406.netlify.app/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Reuse the already-established test context from the existing discovery harness.
const baseSource = fs.readFileSync('mitekore-full-discovery.js','utf8');
const cut = baseSource.indexOf('(async()=>{');
if(cut < 0) throw new Error('existing discovery harness format changed');
const sandbox = {require, console, process, setTimeout, clearTimeout, Buffer};
sandbox.globalThis = sandbox;
vm.runInNewContext(baseSource.slice(0,cut) + '\n;globalThis.__mobileAuditBase={makeContext,dismiss};', sandbox, {filename:'mobile-audit-base.js'});
const makeContext = sandbox.__mobileAuditBase.makeContext;
const dismiss = sandbox.__mobileAuditBase.dismiss;

function fileSafe(s){return String(s||'view').replace(/[^\p{L}\p{N}]+/gu,'_').replace(/^_+|_+$/g,'').slice(0,60)||'view'}

async function scan(page,label){
  await dismiss(page); await sleep(250);
  const data = await page.evaluate(() => {
    const vw=innerWidth,vh=innerHeight;
    const visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.01&&r.width>0&&r.height>0};
    const txt=e=>String(e.innerText||e.textContent||e.getAttribute('aria-label')||e.getAttribute('title')||'').replace(/\s+/g,' ').trim();
    const all=[...document.querySelectorAll('body *')].filter(visible);
    const overflow=all.map(e=>({e,r:e.getBoundingClientRect(),s:getComputedStyle(e)})).filter(x=>x.r.left<-3||x.r.right>vw+3).filter(x=>!(x.s.position==='fixed'&&x.r.width>vw*1.7)).map(x=>({tag:x.e.tagName,id:x.e.id||'',cls:String(x.e.className||'').slice(0,120),text:txt(x.e).slice(0,90),left:Math.round(x.r.left),right:Math.round(x.r.right),width:Math.round(x.r.width)})).slice(0,120);
    const controls=[...document.querySelectorAll('button,a,input,textarea,select,[role="button"],summary')].filter(visible).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,id:e.id||'',cls:String(e.className||'').slice(0,100),text:txt(e).slice(0,80),w:Math.round(r.width),h:Math.round(r.height),font:parseFloat(s.fontSize)||0,disabled:!!e.disabled,dataMobile:e.getAttribute('data-mobile-tab')||''}});
    const smallTargets=controls.filter(x=>!x.disabled&&x.text&&(x.w<34||x.h<30)).slice(0,100);
    const tinyText=all.map(e=>({e,s:getComputedStyle(e),t:txt(e),r:e.getBoundingClientRect()})).filter(x=>x.t&&x.t.length<120&&parseFloat(x.s.fontSize)>0&&parseFloat(x.s.fontSize)<9&&x.r.width>8).map(x=>({tag:x.e.tagName,id:x.e.id||'',cls:String(x.e.className||'').slice(0,100),text:x.t.slice(0,90),font:parseFloat(x.s.fontSize)})).slice(0,100);
    const se=document.scrollingElement||document.documentElement;
    return {version:(document.body.innerText.match(/RC1\.4\.[\w.-]+/)||[])[0]||'',viewport:{w:vw,h:vh},scroll:{height:se.scrollHeight,client:se.clientHeight,top:se.scrollTop,body:getComputedStyle(document.body).overflow,html:getComputedStyle(document.documentElement).overflow},overflow,smallTargets,tinyText,controls:controls.slice(0,300),headings:[...document.querySelectorAll('h1,h2,h3,.section-title,.panel-title,.modal-title')].filter(visible).map(txt).filter(Boolean).slice(0,80),body:document.body.innerText.slice(0,9000)};
  });
  let canScroll=true;
  if(data.scroll.height>data.scroll.client+3){
    const before=await page.evaluate(()=>document.scrollingElement?.scrollTop||0);
    await page.evaluate(()=>window.scrollTo(0,Math.min(220,(document.scrollingElement?.scrollHeight||0)-1))); await sleep(100);
    const after=await page.evaluate(()=>document.scrollingElement?.scrollTop||0);
    canScroll=after>before+2; await page.evaluate(()=>window.scrollTo(0,0));
  }
  data.canScroll=canScroll;
  fs.writeFileSync(`mobile-audit-${fileSafe(label)}.json`,JSON.stringify(data,null,2));
  try{await page.screenshot({path:`mobile-audit-${fileSafe(label)}.png`,fullPage:true,timeout:25000});}catch(e){data.screenshotError=String(e.message||e)}
  return data;
}

async function clickVisible(page,locator){
  const n=await locator.count();
  for(let i=0;i<n;i++){
    const el=locator.nth(i);
    try{if(await el.isVisible()){await el.click({timeout:2500});await sleep(700);await dismiss(page);return true}}catch(_){ }
  }
  return false;
}
async function go(page,name,selector){
  if(selector && await clickVisible(page,page.locator(selector))) return true;
  if(await clickVisible(page,page.getByText(name,{exact:true}))) return true;
  return clickVisible(page,page.locator('button,a,[role="button"],summary').filter({hasText:name}));
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const report={startedAt:new Date().toISOString(),url:APP,profiles:{}};
  for(const profile of [{name:'390x844',w:390,h:844},{name:'360x800',w:360,h:800}]){
    const ctx=await makeContext(browser,true);
    const page=await ctx.newPage();
    await page.setViewportSize({width:profile.w,height:profile.h});
    const errors=[];
    page.on('pageerror',e=>errors.push('PAGEERROR '+String(e.message||e)));
    page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.type().toUpperCase()+' '+m.text())});
    await page.goto(APP,{waitUntil:'domcontentloaded',timeout:60000});await sleep(6500);await dismiss(page);
    const views={home:await scan(page,`${profile.name}-home`)};
    const nav=[
      ['ホーム',null],['登録','[data-mobile-tab="register"]'],['一覧','[data-mobile-tab="list"]'],['図鑑','[data-mobile-tab="dex"]'],['その他',null]
    ];
    for(const [name,sel] of nav){try{if(await go(page,name,sel))views[name]=await scan(page,`${profile.name}-${name}`)}catch(e){errors.push(`NAV ${name}: ${e.message}`)}}
    // Read-only routes reachable from the mobile UI.
    for(const name of ['プロフィール','みてレコ','みてトピ','ショーケース','二つ名','データ','設定']){
      try{if(await go(page,name,null))views[name]=await scan(page,`${profile.name}-${name}`)}catch(e){errors.push(`NAV ${name}: ${e.message}`)}
    }
    report.profiles[profile.name]={views,errors};
    await ctx.close();
  }
  report.finishedAt=new Date().toISOString();
  const summary={};
  for(const [p,r] of Object.entries(report.profiles)){
    summary[p]={views:Object.keys(r.views),errors:r.errors.slice(-40),issues:{}};
    for(const [n,v] of Object.entries(r.views))summary[p].issues[n]={horizontalOverflow:v.overflow.length,smallTargets:v.smallTargets.length,tinyText:v.tinyText.length,canScroll:v.canScroll,screenshotError:v.screenshotError||''};
  }
  fs.writeFileSync('mobile-ui-audit.json',JSON.stringify(report,null,2));
  fs.writeFileSync('mobile-ui-audit-summary.json',JSON.stringify(summary,null,2));
  console.log('MOBILE_UI_AUDIT_SUMMARY '+JSON.stringify(summary));
  await browser.close();
})().catch(e=>{console.error('MOBILE_UI_AUDIT_FATAL',e);fs.writeFileSync('mobile-ui-audit-fatal.txt',String(e?.stack||e));process.exit(1)});
