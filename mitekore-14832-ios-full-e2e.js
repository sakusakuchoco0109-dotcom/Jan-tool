const { webkit, devices } = require('playwright');
const http=require('http'), fs=require('fs');
const TARGET='https://hilarious-haupia-6e0406.netlify.app/';

function patch14832(html){
  if(html.includes('14832-ios-legal-gate-fix')) return html;
  if(!html.includes('14831-onboarding-id-and-chrome-post-fix')) throw new Error('live is neither 14831 nor 14832');
  html=html.replace('<meta content="width=device-width,initial-scale=1" name="viewport"/>','<meta content="width=device-width,initial-scale=1,viewport-fit=cover" name="viewport"/>');
  html=html.replace("window.__FUJIYA_CLIENT_APP_VERSION__='14831-onboarding-id-and-chrome-post-fix';","window.__FUJIYA_CLIENT_APP_VERSION__='14832-ios-legal-gate-fix';");
  const marker='</style>\n<div class="fujiya-legal-modal14750" id="fujiyaTermsModal14750"';
  const css=`\n/* 14832 iPhone Safari */\n.fujiya-legal-modal14750{box-sizing:border-box;width:100%;height:var(--fujiya-legal-vh14832,100dvh);min-height:0;overflow:hidden;-webkit-text-size-adjust:100%;text-size-adjust:100%}\n.fujiya-legal-card14750{min-height:0}.fujiya-legal-body14750{min-height:0;flex:1 1 auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}\n.fujiya-legal-gate-check14750{position:relative;box-sizing:border-box}.fujiya-legal-gate-check14750 input[type="checkbox"]{width:22px!important;min-width:22px!important;max-width:22px!important;height:22px!important;min-height:22px!important;max-height:22px!important;flex:0 0 22px!important;padding:0!important;margin:1px 0 0!important;border-radius:5px;accent-color:#2b82ba;box-sizing:border-box}\n@supports (-webkit-touch-callout:none){.fujiya-legal-modal14750{backdrop-filter:none;-webkit-backdrop-filter:none}}\n@media(max-width:600px){.fujiya-legal-modal14750{align-items:flex-end;justify-content:center;padding-top:max(8px,env(safe-area-inset-top,0px));padding-right:max(8px,env(safe-area-inset-right,0px));padding-bottom:max(8px,env(safe-area-inset-bottom,0px));padding-left:max(8px,env(safe-area-inset-left,0px))}.fujiya-legal-card14750{width:100%;max-width:620px;max-height:calc(var(--fujiya-legal-vh14832,100dvh) - max(8px,env(safe-area-inset-top,0px)) - max(8px,env(safe-area-inset-bottom,0px)));border-radius:18px 18px 12px 12px}.fujiya-legal-head14750{flex:0 0 auto;padding:14px 15px}.fujiya-legal-body14750{padding:14px 15px 12px}.fujiya-legal-gate14750 .fujiya-legal-body14750{font-size:.94rem;line-height:1.65}.fujiya-legal-gate14750 .fujiya-legal-actions14750:last-child{flex:0 0 auto;padding:11px 15px 12px}.fujiya-legal-gate14750 .fujiya-legal-body14750>.fujiya-legal-actions14750{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 12px!important}.fujiya-legal-gate14750 .fujiya-legal-body14750>.fujiya-legal-actions14750 button{width:100%;min-width:0;min-height:44px;padding:8px 6px;font-size:.86rem;line-height:1.25}.fujiya-legal-gate-check14750{gap:10px;padding:12px;align-items:flex-start}#fujiyaLegalAccept14750{min-height:48px}}\n@media(max-width:380px){.fujiya-legal-gate14750 .fujiya-legal-body14750>.fujiya-legal-actions14750{grid-template-columns:1fr}}\n`;
  if(!html.includes(marker)) throw new Error('css patch marker missing');
  html=html.replace(marker,css+marker);
  const jsOld="  const terms=$('fujiyaTermsModal14750'),privacy=$('fujiyaPrivacyModal14750'),contact=$('fujiyaContactModal14750'),gate=$('fujiyaLegalGate14750');\n";
  const jsNew=jsOld+"  const syncLegalViewport14832=()=>{const h=Math.max(320,Math.round(window.visualViewport?.height||window.innerHeight||document.documentElement.clientHeight||0));document.documentElement.style.setProperty('--fujiya-legal-vh14832',`${h}px`);};\n  syncLegalViewport14832();window.addEventListener('resize',syncLegalViewport14832,{passive:true});window.addEventListener('orientationchange',()=>setTimeout(syncLegalViewport14832,60),{passive:true});window.visualViewport?.addEventListener('resize',syncLegalViewport14832,{passive:true});window.visualViewport?.addEventListener('scroll',syncLegalViewport14832,{passive:true});\n";
  if(!html.includes(jsOld)) throw new Error('js patch marker missing');
  return html.replace(jsOld,jsNew);
}

function seedCompletedUser(){
  const now=new Date().toISOString();
  localStorage.setItem('fujiya_legal_acceptance_v1',JSON.stringify({version:'2026-09-10',acceptedAt:now}));
  localStorage.setItem('fujiya_unified_first_setup_v1_done','1');
  localStorage.setItem('fujiya_collection_setup_done_v1',now);
  localStorage.setItem('fujiya_collection_first_run_seen_v20_2_35cn','1');
  localStorage.setItem('fujiya_collection_tutorial_seen_v2_rc1474','1');
  localStorage.setItem('fujiya_existing_account_linked_v14787','1');
  localStorage.setItem('fujiya_mitekore_user_mode_v1','normal');
  localStorage.setItem('fujiya_collection_user_id','fujiya_ios_audit_14832');
  localStorage.setItem('fujiya_mitereco_identity_user_v2','fujiya_ios_audit_14832');
  localStorage.setItem('fujiya_ui_active_tab_v1','list');
  localStorage.setItem('fujiya_collection_accessibility_v1',JSON.stringify({fontSize:'normal',theme:'night',contrast:false,colorSupport:false}));
}

async function snapshot(page,label,panelId,expectedTab){
  return await page.evaluate(({label,panelId,expectedTab})=>{
    const vis=e=>{if(!e||!e.isConnected)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity!==0&&r.width>0&&r.height>0};
    const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),right:+r.right.toFixed(1),bottom:+r.bottom.toFixed(1)}};
    const panel=document.getElementById(panelId), nav=document.getElementById('mobileBottomNav');
    const overflow=[];
    const candidates=[...document.querySelectorAll('main,section.panel,.panel,.mobile-more-sheet,.detail-modal-card,.modal-card,.fujiya-legal-card14750,#quickProfileEditor,#globalSearchModal596')];
    for(const e of candidates){
      if(!vis(e))continue;const r=e.getBoundingClientRect();let p=e.parentElement,insideScroller=false;
      while(p&&p!==document.body){const st=getComputedStyle(p);if(/auto|scroll/.test(st.overflowX)&&p.scrollWidth>p.clientWidth+2){insideScroller=true;break}p=p.parentElement}
      if(!insideScroller&&(r.left<-3||r.right>innerWidth+3))overflow.push({id:e.id||'',cls:String(e.className||'').slice(0,80),left:+r.left.toFixed(1),right:+r.right.toFixed(1)});
    }
    return {label,expectedTab,activeTab:document.body?.dataset?.activeTab||'',panelId,panelVisible:vis(panel),panelRect:rect(panel),innerW:innerWidth,innerH:innerHeight,scrollW:document.documentElement.scrollWidth,bodyScrollW:document.body.scrollWidth,nav:rect(nav),overflow:overflow.slice(0,12),earlyGateHidden:document.getElementById('fujiyaEarlyAccessGateV1')?.hidden===true,unifiedSetupHidden:document.getElementById('unifiedFirstSetup14675')?.hidden===true,version:window.__FUJIYA_CLIENT_APP_VERSION__||''};
  },{label,panelId,expectedTab});
}

async function clickFixedTab(page,tab){
  await page.evaluate(t=>document.querySelector(`#mobileBottomNav [data-mobile-tab="${t}"]`)?.click(),tab);
  await page.waitForFunction(t=>document.body?.dataset?.activeTab===t,tab,{timeout:5000});
  await page.waitForTimeout(500);
}
async function clickMoreTab(page,tab){
  await page.evaluate(()=>document.querySelector('#mobileBottomNav [data-mobile-more]')?.click());
  await page.waitForFunction(()=>document.getElementById('mobileMoreSheet')?.hidden===false,null,{timeout:3000});
  await page.evaluate(t=>document.querySelector(`#mobileMoreSheet [data-mobile-tab="${t}"]`)?.click(),tab);
  await page.waitForFunction(t=>document.body?.dataset?.activeTab===t,tab,{timeout:5000});
  await page.waitForTimeout(500);
}
async function directTab(page,tab){
  await page.evaluate(t=>window.fujiyaMobileTabSwitch?.(t),tab);
  await page.waitForFunction(t=>document.body?.dataset?.activeTab===t,tab,{timeout:5000});
  await page.waitForTimeout(500);
}
function validScreen(x){return x.version==='14832-ios-legal-gate-fix'&&x.activeTab===x.expectedTab&&x.panelVisible&&x.earlyGateHidden&&x.unifiedSetupHidden&&x.scrollW<=x.innerW+2&&x.bodyScrollW<=x.innerW+2&&x.overflow.length===0&&(!x.nav||x.nav.right<=x.innerW+2)}

async function auditModal(page,deviceName,name,open,close,selector){
  await open();await page.waitForTimeout(300);
  const x=await page.evaluate(({name,selector})=>{const e=document.querySelector(selector),r=e?.getBoundingClientRect(),s=e?getComputedStyle(e):null;return {label:name,innerW:innerWidth,innerH:innerHeight,scrollW:document.documentElement.scrollWidth,bodyScrollW:document.body.scrollWidth,visible:!!(e&&s&&s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0),rect:r?{x:+r.x.toFixed(1),y:+r.y.toFixed(1),right:+r.right.toFixed(1),bottom:+r.bottom.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)}:null,version:window.__FUJIYA_CLIENT_APP_VERSION__||''}}, {name,selector});
  await page.screenshot({path:`14832-${deviceName}-modal-${name}.png`,fullPage:false});
  await close();await page.waitForTimeout(150);
  x.passed=x.visible&&x.version==='14832-ios-legal-gate-fix'&&x.scrollW<=x.innerW+2&&x.bodyScrollW<=x.innerW+2&&x.rect&&x.rect.x>=-3&&x.rect.right<=x.innerW+3;
  return x;
}

async function runDevice(name,device){
  const browser=await webkit.launch({headless:true}), context=await browser.newContext(device), page=await context.newPage();
  const out={name,consoleErrors:[],pageErrors:[],screens:[],modals:[]};
  page.on('console',m=>{if(m.type()==='error')out.consoleErrors.push(m.text())}); page.on('pageerror',e=>out.pageErrors.push(String(e)));
  await page.addInitScript(seedCompletedUser);
  try{
    await page.goto('http://127.0.0.1:18033/',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForSelector('#mobileBottomNav',{state:'visible',timeout:25000}); await page.waitForTimeout(2200);
    const gateState=await page.evaluate(()=>({early:document.getElementById('fujiyaEarlyAccessGateV1')?.hidden,setup:document.getElementById('unifiedFirstSetup14675')?.hidden,mode:localStorage.getItem('fujiya_mitekore_user_mode_v1')}));
    out.gateState=gateState;

    const fixed=[['register','entryPanel'],['list','listPanel'],['dex','dexPanel'],['buyback','listChoiceHub']];
    for(const [tab,panel] of fixed){await clickFixedTab(page,tab);const x=await snapshot(page,tab,panel,tab);x.passed=validScreen(x);out.screens.push(x);await page.screenshot({path:`14832-${name}-${tab}.png`,fullPage:false});}
    const more=[['magazine','miteMagazinePanel'],['data','sharedPanel'],['sync','deviceSyncPanel'],['manage','manageOverviewPanel']];
    for(const [tab,panel] of more){await clickMoreTab(page,tab);const x=await snapshot(page,tab,panel,tab);x.passed=validScreen(x);out.screens.push(x);await page.screenshot({path:`14832-${name}-${tab}.png`,fullPage:false});}
    // みてレコは専用open関数経由でもactiveTab=miterecoになることを確認
    await clickMoreTab(page,'mitereco');let x=await snapshot(page,'mitereco','miteRecoPanel','mitereco');x.passed=validScreen(x);out.screens.push(x);await page.screenshot({path:`14832-${name}-mitereco.png`,fullPage:false});
    // プロフィール/二つ名タブは固定ナビ外なので公開switch関数で確認
    await directTab(page,'growth');x=await snapshot(page,'growth','rpgPanel','growth');x.passed=validScreen(x);out.screens.push(x);await page.screenshot({path:`14832-${name}-growth.png`,fullPage:false});
    // ショーケースは「その他」→ショーケースで一覧内へスクロールする仕様
    await page.evaluate(()=>document.querySelector('#mobileBottomNav [data-mobile-more]')?.click());
    await page.evaluate(()=>document.querySelector('#mobileMoreSheet [data-mobile-shelf]')?.click()); await page.waitForTimeout(700);
    x=await snapshot(page,'shelf','shelfPanel','list');
    x.shelfIntersectsViewport=!!(x.panelRect&&x.panelRect.bottom>0&&x.panelRect.y<x.innerH); x.passed=validScreen(x)&&x.shelfIntersectsViewport;out.screens.push(x);await page.screenshot({path:`14832-${name}-shelf.png`,fullPage:false});

    out.modals.push(await auditModal(page,name,'more',async()=>page.evaluate(()=>document.querySelector('#mobileBottomNav [data-mobile-more]')?.click()),async()=>page.evaluate(()=>document.querySelector('[data-mobile-more-close]')?.click()),'#mobileMoreSheet'));
    out.modals.push(await auditModal(page,name,'search',async()=>page.evaluate(()=>document.querySelector('#mobileBottomNav [data-mobile-more]')?.click().then?.(()=>{})),async()=>{},'#mobileMoreSheet').catch(()=>null));
    // search: open more then actual search button
    await page.evaluate(()=>{const s=document.getElementById('mobileMoreSheet');if(s)s.hidden=true});
    out.modals.push(await auditModal(page,name,'search',async()=>page.evaluate(()=>{document.querySelector('#mobileBottomNav [data-mobile-more]')?.click();document.querySelector('#mobileMoreSheet [data-global-search-open596]')?.click()}),async()=>page.evaluate(()=>window.fujiyaGlobalSearch596?.close?.()),'#globalSearchModal596'));
    out.modals.push(await auditModal(page,name,'terms',async()=>page.evaluate(()=>document.querySelector('[data-open-terms14750]')?.click()),async()=>page.evaluate(()=>document.querySelector('#fujiyaTermsModal14750 [data-close-legal14750]')?.click()),'#fujiyaTermsModal14750 .fujiya-legal-card14750'));
    out.modals.push(await auditModal(page,name,'privacy',async()=>page.evaluate(()=>document.querySelector('[data-open-privacy14750]')?.click()),async()=>page.evaluate(()=>document.querySelector('#fujiyaPrivacyModal14750 [data-close-legal14750]')?.click()),'#fujiyaPrivacyModal14750 .fujiya-legal-card14750'));

    out.modals=out.modals.filter(Boolean);
    out.passed=out.screens.every(s=>s.passed)&&out.modals.every(m=>m.passed)&&out.pageErrors.length===0;
  }catch(e){out.error=String(e?.stack||e);out.passed=false}
  await browser.close(); return out;
}

(async()=>{
  const live=await (await fetch(TARGET)).text(), html=patch14832(live);
  const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html)});await new Promise(r=>server.listen(18033,'127.0.0.1',r));
  const out={startedAt:new Date().toISOString(),liveVersion:live.includes('14832-ios-legal-gate-fix')?'14832':live.includes('14831-onboarding-id-and-chrome-post-fix')?'14831':'other',tests:[]};
  try{out.tests.push(await runDevice('iphone13',devices['iPhone 13']));out.tests.push(await runDevice('iphonese',{...devices['iPhone SE'],viewport:{width:375,height:667}}));out.passed=out.tests.every(t=>t.passed)}finally{server.close();out.finishedAt=new Date().toISOString();fs.writeFileSync('mitekore-14832-ios-full-e2e-result.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2))}
  if(!out.passed)process.exit(1);
})();
