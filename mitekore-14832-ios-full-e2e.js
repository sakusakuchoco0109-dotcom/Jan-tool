const { webkit, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const TARGET='https://hilarious-haupia-6e0406.netlify.app/';

function patch14831to14832(html){
  if(html.includes('14832-ios-legal-gate-fix')) return html;
  if(!html.includes('14831-onboarding-id-and-chrome-post-fix')) throw new Error('target is neither 14831 nor 14832');
  html=html.replace('<meta content="width=device-width,initial-scale=1" name="viewport"/>','<meta content="width=device-width,initial-scale=1,viewport-fit=cover" name="viewport"/>');
  html=html.replace("window.__FUJIYA_CLIENT_APP_VERSION__='14831-onboarding-id-and-chrome-post-fix';","window.__FUJIYA_CLIENT_APP_VERSION__='14832-ios-legal-gate-fix';");
  const marker='</style>\n<div class="fujiya-legal-modal14750" id="fujiyaTermsModal14750"';
  const css=`\n/* 14832 iPhone Safari */\n.fujiya-legal-modal14750{box-sizing:border-box;width:100%;height:var(--fujiya-legal-vh14832,100dvh);min-height:0;overflow:hidden;-webkit-text-size-adjust:100%;text-size-adjust:100%}\n.fujiya-legal-card14750{min-height:0}.fujiya-legal-body14750{min-height:0;flex:1 1 auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}\n.fujiya-legal-gate-check14750{position:relative;box-sizing:border-box}.fujiya-legal-gate-check14750 input[type="checkbox"]{width:22px!important;min-width:22px!important;max-width:22px!important;height:22px!important;min-height:22px!important;max-height:22px!important;flex:0 0 22px!important;padding:0!important;margin:1px 0 0!important;border-radius:5px;accent-color:#2b82ba;box-sizing:border-box}\n@supports (-webkit-touch-callout:none){.fujiya-legal-modal14750{backdrop-filter:none;-webkit-backdrop-filter:none}}\n@media(max-width:600px){.fujiya-legal-modal14750{align-items:flex-end;justify-content:center;padding-top:max(8px,env(safe-area-inset-top,0px));padding-right:max(8px,env(safe-area-inset-right,0px));padding-bottom:max(8px,env(safe-area-inset-bottom,0px));padding-left:max(8px,env(safe-area-inset-left,0px))}.fujiya-legal-card14750{width:100%;max-width:620px;max-height:calc(var(--fujiya-legal-vh14832,100dvh) - max(8px,env(safe-area-inset-top,0px)) - max(8px,env(safe-area-inset-bottom,0px)));border-radius:18px 18px 12px 12px}.fujiya-legal-head14750{flex:0 0 auto;padding:14px 15px}.fujiya-legal-body14750{padding:14px 15px 12px}.fujiya-legal-gate14750 .fujiya-legal-body14750{font-size:.94rem;line-height:1.65}.fujiya-legal-gate14750 .fujiya-legal-actions14750:last-child{flex:0 0 auto;padding:11px 15px 12px}.fujiya-legal-gate14750 .fujiya-legal-body14750>.fujiya-legal-actions14750{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 12px!important}.fujiya-legal-gate14750 .fujiya-legal-body14750>.fujiya-legal-actions14750 button{width:100%;min-width:0;min-height:44px;padding:8px 6px;font-size:.86rem;line-height:1.25}.fujiya-legal-gate-check14750{gap:10px;padding:12px;align-items:flex-start}#fujiyaLegalAccept14750{min-height:48px}}\n@media(max-width:380px){.fujiya-legal-gate14750 .fujiya-legal-body14750>.fujiya-legal-actions14750{grid-template-columns:1fr}}\n`;
  if(!html.includes(marker)) throw new Error('14832 css marker missing');
  html=html.replace(marker,css+marker);
  const jsOld="  const terms=$('fujiyaTermsModal14750'),privacy=$('fujiyaPrivacyModal14750'),contact=$('fujiyaContactModal14750'),gate=$('fujiyaLegalGate14750');\n";
  const jsNew=jsOld+"  const syncLegalViewport14832=()=>{const h=Math.max(320,Math.round(window.visualViewport?.height||window.innerHeight||document.documentElement.clientHeight||0));document.documentElement.style.setProperty('--fujiya-legal-vh14832',`${h}px`);};\n  syncLegalViewport14832();window.addEventListener('resize',syncLegalViewport14832,{passive:true});window.addEventListener('orientationchange',()=>setTimeout(syncLegalViewport14832,60),{passive:true});window.visualViewport?.addEventListener('resize',syncLegalViewport14832,{passive:true});window.visualViewport?.addEventListener('scroll',syncLegalViewport14832,{passive:true});\n";
  if(!html.includes(jsOld)) throw new Error('14832 js marker missing');
  return html.replace(jsOld,jsNew);
}

function seed(){
  const now=new Date().toISOString();
  localStorage.setItem('fujiya_legal_acceptance_v1',JSON.stringify({version:'2026-09-10',acceptedAt:now}));
  localStorage.setItem('fujiya_unified_first_setup_v1_done','1');
  localStorage.setItem('fujiya_collection_setup_done_v1',now);
  localStorage.setItem('fujiya_collection_first_run_seen_v20_2_35cn','1');
  localStorage.setItem('fujiya_collection_tutorial_seen_v2_rc1474','1');
  localStorage.setItem('fujiya_collection_user_id','fujiya_ios_audit_14832');
  localStorage.setItem('fujiya_mitereco_identity_user_v2','fujiya_ios_audit_14832');
  localStorage.setItem('fujiya_collection_accessibility_v1',JSON.stringify({fontSize:'normal',theme:'night',contrast:false,colorSupport:false}));
}

async function geometry(page,label){
  return await page.evaluate((label)=>{
    const visible=e=>{if(!e||!e.isConnected)return false;const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
    const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),right:+r.right.toFixed(1),bottom:+r.bottom.toFixed(1)}};
    const active=document.querySelector('body[data-active-tab]');
    const nav=document.getElementById('mobileBottomNav');
    const overflow=[];
    for(const e of document.querySelectorAll('main,section.panel,.panel,.mobile-more-sheet,.detail-modal-card,.fujiya-legal-card14750,#quickProfileEditor,#globalSearchModal596')){
      if(!visible(e))continue;const r=e.getBoundingClientRect();
      let p=e.parentElement,scrollable=false;
      while(p&&p!==document.body){const s=getComputedStyle(p);if(/auto|scroll/.test(s.overflowX)&&p.scrollWidth>p.clientWidth+2){scrollable=true;break}p=p.parentElement}
      if(!scrollable&&(r.left<-3||r.right>innerWidth+3))overflow.push({id:e.id||'',cls:String(e.className||'').slice(0,90),left:+r.left.toFixed(1),right:+r.right.toFixed(1),w:+r.width.toFixed(1)});
    }
    return {label,innerW:innerWidth,innerH:innerHeight,scrollW:document.documentElement.scrollWidth,bodyScrollW:document.body.scrollWidth,activeTab:active?.dataset.activeTab||'',nav:rect(nav),overflow:overflow.slice(0,12),version:window.__FUJIYA_CLIENT_APP_VERSION__||''};
  },label);
}

async function clickTab(page,tab){
  if(tab==='shelf'){
    await page.evaluate(()=>document.querySelector('[data-mobile-shelf]')?.click());
  }else{
    await page.evaluate(t=>{const els=[...document.querySelectorAll(`[data-mobile-tab="${t}"],[data-ui-tab="${t}"]`)];(els.find(e=>getComputedStyle(e).display!=='none')||els[0])?.click();},tab);
  }
  await page.waitForTimeout(700);
}

async function auditModal(page,name,openFn,closeFn){
  await openFn(); await page.waitForTimeout(350);
  const g=await geometry(page,name);
  await page.screenshot({path:`14832-modal-${name}.png`,fullPage:false});
  await closeFn(); await page.waitForTimeout(150);
  return g;
}

async function runDevice(name,device){
  const browser=await webkit.launch({headless:true});
  const context=await browser.newContext(device);
  const page=await context.newPage();
  const out={name,consoleErrors:[],pageErrors:[],screens:[],modals:[]};
  page.on('console',m=>{if(m.type()==='error')out.consoleErrors.push(m.text())});
  page.on('pageerror',e=>out.pageErrors.push(String(e)));
  await page.addInitScript(seed);
  try{
    await page.goto('http://127.0.0.1:18033/',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForSelector('#mobileBottomNav',{state:'visible',timeout:25000});
    await page.waitForTimeout(2500);
    const tabs=['register','list','dex','buyback','magazine','mitereco','data','sync','manage','growth','shelf'];
    for(const tab of tabs){
      await clickTab(page,tab);
      const g=await geometry(page,tab); out.screens.push(g);
      await page.screenshot({path:`14832-${name}-${tab}.png`,fullPage:false});
    }
    // その他メニュー
    out.modals.push(await auditModal(page,'more',async()=>page.evaluate(()=>document.querySelector('[data-mobile-more]')?.click()),async()=>page.evaluate(()=>document.querySelector('[data-mobile-more-close]')?.click())));
    // 全体検索
    out.modals.push(await auditModal(page,'search',async()=>page.evaluate(()=>document.querySelector('[data-global-search-open596]')?.click()),async()=>page.evaluate(()=>window.fujiyaGlobalSearch596?.close?.())));
    // 利用規約 / プライバシー
    out.modals.push(await auditModal(page,'terms',async()=>page.evaluate(()=>document.querySelector('[data-open-terms14750]')?.click()),async()=>page.evaluate(()=>document.querySelector('#fujiyaTermsModal14750 [data-close-legal14750]')?.click())));
    out.modals.push(await auditModal(page,'privacy',async()=>page.evaluate(()=>document.querySelector('[data-open-privacy14750]')?.click()),async()=>page.evaluate(()=>document.querySelector('#fujiyaPrivacyModal14750 [data-close-legal14750]')?.click())));
    // プロフィール編集（存在する場合）
    await clickTab(page,'growth');
    const hasProfile=await page.evaluate(()=>!!document.getElementById('quickProfileEditBtn'));
    if(hasProfile){
      out.modals.push(await auditModal(page,'profile-editor',async()=>page.evaluate(()=>document.getElementById('quickProfileEditBtn')?.click()),async()=>page.evaluate(()=>document.getElementById('quickProfileEditBtn')?.click())));
    }
    const all=[...out.screens,...out.modals];
    out.passed=all.every(x=>x.version==='14832-ios-legal-gate-fix'&&x.scrollW<=x.innerW+2&&x.bodyScrollW<=x.innerW+2&&x.overflow.length===0&&(!x.nav||x.nav.right<=x.innerW+2)) && out.pageErrors.length===0;
  }catch(e){out.error=String(e?.stack||e);out.passed=false}
  await browser.close(); return out;
}

(async()=>{
  const live=await (await fetch(TARGET)).text();
  const html=patch14831to14832(live);
  const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html)});
  await new Promise(r=>server.listen(18033,'127.0.0.1',r));
  const out={startedAt:new Date().toISOString(),liveVersion:live.includes('14832-ios-legal-gate-fix')?'14832':(live.includes('14831-onboarding-id-and-chrome-post-fix')?'14831':'other'),tests:[]};
  try{
    out.tests.push(await runDevice('iphone13',devices['iPhone 13']));
    out.tests.push(await runDevice('iphonese',{...devices['iPhone SE'],viewport:{width:375,height:667}}));
    out.passed=out.tests.every(x=>x.passed);
  }finally{
    server.close();out.finishedAt=new Date().toISOString();fs.writeFileSync('mitekore-14832-ios-full-e2e-result.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
  }
  if(!out.passed)process.exit(1);
})();
