const { webkit, devices } = require('playwright');
const http=require('http'),fs=require('fs');
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
  localStorage.setItem('fujiya_collection_active_tab_v1','list');
  localStorage.setItem('fujiya_ui_active_tab_v1','list');
  localStorage.setItem('fujiya_collection_accessibility_v1',JSON.stringify({fontSize:'normal',theme:'night',contrast:false,colorSupport:false}));
}

async function metrics(page,label,selector){
  return page.evaluate(({label,selector})=>{
    const el=document.querySelector(selector),s=el?getComputedStyle(el):null,r=el?.getBoundingClientRect();
    const visible=!!(el&&s&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0);
    const badChecks=[...document.querySelectorAll('input[type="checkbox"],input[type="radio"]')].filter(e=>{const st=getComputedStyle(e),q=e.getBoundingClientRect();return st.display!=='none'&&st.visibility!=='hidden'&&q.width>0&&q.height>0&&(q.width>40||q.height>40)}).map(e=>{const q=e.getBoundingClientRect();return {id:e.id||'',name:e.name||'',type:e.type,w:+q.width.toFixed(1),h:+q.height.toFixed(1)}}).slice(0,20);
    return {label,selector,visible,rect:r?{x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),right:+r.right.toFixed(1),bottom:+r.bottom.toFixed(1)}:null,innerW:innerWidth,innerH:innerHeight,scrollW:document.documentElement.scrollWidth,bodyScrollW:document.body.scrollWidth,activeTab:document.body?.dataset?.activeTab||'',mobileHome:document.body?.dataset?.mobileHome||'',mobileShelfMode:document.body?.dataset?.mobileShelfMode||'',uiScale:document.documentElement.dataset.fujiyaUiScale||'',badChecks,earlyGateHidden:document.getElementById('fujiyaEarlyAccessGateV1')?.hidden===true,setupHidden:document.getElementById('unifiedFirstSetup14675')?.hidden===true,version:window.__FUJIYA_CLIENT_APP_VERSION__||''};
  },{label,selector});
}
function commonPass(x){return x.version==='14832-ios-legal-gate-fix'&&x.visible&&x.earlyGateHidden&&x.setupHidden&&x.uiScale==='normal'&&x.scrollW<=x.innerW+2&&x.bodyScrollW<=x.innerW+2&&x.rect&&x.rect.x>=-3&&x.rect.right<=x.innerW+3&&x.badChecks.length===0}
async function capture(page,out,device,label,selector,extra=()=>true){
  await page.waitForTimeout(350);const x=await metrics(page,label,selector);x.passed=commonPass(x)&&extra(x);out.push(x);await page.screenshot({path:`14832-${device}-${label}.png`,fullPage:false});return x;
}
async function clickBottomTab(page,tab){
  await page.locator(`#mobileBottomNav [data-mobile-tab="${tab}"]`).click();
  await page.waitForFunction(t=>document.body?.dataset?.activeTab===t&&document.body?.dataset?.mobileHome==='0',tab,{timeout:8000});
}
async function openMore(page){
  const sheet=page.locator('#mobileMoreSheet');if(await sheet.isVisible())return;
  await page.locator('#mobileBottomNav [data-mobile-more]').click();await sheet.waitFor({state:'visible',timeout:5000});
}
async function clickMoreTab(page,tab){
  await openMore(page);await page.locator(`#mobileMoreSheet [data-mobile-tab="${tab}"]`).click();
  await page.waitForFunction(t=>document.body?.dataset?.activeTab===t&&document.body?.dataset?.mobileHome==='0',tab,{timeout:10000});
}
async function openHome(page){
  await page.locator('#mobileBottomNav [data-mobile-home-rc1498]').click();
  await page.waitForFunction(()=>document.body?.dataset?.mobileHome==='1'&&document.body?.dataset?.activeTab==='list',{timeout:8000});
}
async function openSupportModal(page,kind){
  await clickMoreTab(page,'manage');
  const selector=`#fujiyaSupportManage14750 [data-open-${kind}14750]`;
  await page.locator(selector).click();
  const id=kind==='terms'?'#fujiyaTermsModal14750':kind==='privacy'?'#fujiyaPrivacyModal14750':'#fujiyaContactModal14750';
  await page.locator(id).waitFor({state:'visible',timeout:5000});return id;
}
async function closeLegal(page,id){await page.locator(`${id} [data-legal-close14750]`).click();await page.locator(id).waitFor({state:'hidden',timeout:5000})}

async function runDevice(name,device){
  const browser=await webkit.launch({headless:true}),context=await browser.newContext(device),page=await context.newPage();
  const out={name,consoleErrors:[],pageErrors:[],screens:[],overlays:[]};
  page.on('console',m=>{if(m.type()==='error')out.consoleErrors.push(m.text())});page.on('pageerror',e=>out.pageErrors.push(String(e)));
  await page.addInitScript(seedCompletedUser);
  try{
    await page.goto('http://127.0.0.1:18033/',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForSelector('#mobileBottomNav',{state:'visible',timeout:25000});await page.waitForTimeout(2300);

    await openHome(page);await capture(page,out.screens,name,'home','#quickStatusBar',x=>x.mobileHome==='1'&&x.activeTab==='list');
    await page.locator('#quickProfileEditBtn').waitFor({state:'visible',timeout:5000});await page.locator('#quickProfileEditBtn').click();await page.locator('#quickProfileEditor').waitFor({state:'visible',timeout:5000});
    await capture(page,out.overlays,name,'profile-editor','#quickProfileEditor',x=>x.mobileHome==='1');await page.locator('#quickCloseProfileEditorBtn').click();

    for(const [tab,selector] of [['register','#entryPanel'],['list','#listPanel'],['dex','#dexPanel']]){await clickBottomTab(page,tab);await capture(page,out.screens,name,tab,selector,x=>x.activeTab===tab&&x.mobileHome==='0')}
    for(const [tab,selector] of [['buyback','#listChoiceHub'],['magazine','#miteMagazinePanel'],['mitereco','#miteRecoPanel'],['data','#sharedPanel'],['sync','#deviceSyncPanel'],['manage','#manageOverviewPanel']]){await clickMoreTab(page,tab);await capture(page,out.screens,name,tab,selector,x=>x.activeTab===tab&&x.mobileHome==='0')}

    await openMore(page);await capture(page,out.overlays,name,'more','#mobileMoreSheet',x=>x.mobileHome==='0');await page.locator('[data-mobile-more-close]').click();

    await openMore(page);await page.locator('#mobileMoreSheet [data-mobile-shelf]').click();await page.waitForFunction(()=>document.body?.dataset?.activeTab==='list'&&document.body?.dataset?.mobileHome==='0'&&document.body?.dataset?.mobileShelfMode==='1',{timeout:8000});
    await capture(page,out.screens,name,'shelf','#shelfPanel',x=>x.activeTab==='list'&&x.mobileShelfMode==='1'&&x.mobileHome==='0');

    await openMore(page);await page.locator('#mobileMoreSheet [data-global-search-open596]').click();await page.locator('#globalSearchModal596').waitFor({state:'visible',timeout:5000});
    await capture(page,out.overlays,name,'global-search','.global-search-dialog596');await page.locator('[data-global-search-close596]').click();

    for(const kind of ['terms','privacy','contact']){const id=await openSupportModal(page,kind);await capture(page,out.overlays,name,kind,`${id} .fujiya-legal-card14750`);await closeLegal(page,id)}

    out.passed=[...out.screens,...out.overlays].every(x=>x.passed)&&out.pageErrors.length===0;
  }catch(e){out.error=String(e?.stack||e);out.passed=false}
  await browser.close();return out;
}

(async()=>{
  const live=await (await fetch(TARGET)).text(),html=patch14832(live);
  const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html)});await new Promise(r=>server.listen(18033,'127.0.0.1',r));
  const out={startedAt:new Date().toISOString(),liveVersion:live.includes('14832-ios-legal-gate-fix')?'14832':live.includes('14831-onboarding-id-and-chrome-post-fix')?'14831':'other',tests:[]};
  try{out.tests.push(await runDevice('iphone13',devices['iPhone 13']));out.tests.push(await runDevice('iphonese',{...devices['iPhone SE'],viewport:{width:375,height:667}}));out.passed=out.tests.every(t=>t.passed)}finally{server.close();out.finishedAt=new Date().toISOString();fs.writeFileSync('mitekore-14832-ios-full-e2e-result.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2))}
  if(!out.passed)process.exit(1);
})();
