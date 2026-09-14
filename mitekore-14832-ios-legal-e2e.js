const { webkit, devices } = require('playwright');
const http=require('http'); const fs=require('fs');
const TARGET='https://hilarious-haupia-6e0406.netlify.app/';

function patch(html){
  html=html.replace('<meta content="width=device-width,initial-scale=1" name="viewport"/>','<meta content="width=device-width,initial-scale=1,viewport-fit=cover" name="viewport"/>');
  html=html.replace("window.__FUJIYA_CLIENT_APP_VERSION__='14831-onboarding-id-and-chrome-post-fix';","window.__FUJIYA_CLIENT_APP_VERSION__='14832-ios-legal-gate-fix';");
  const old='''  #fujiyaLegalAccept14750{\n    width:100%;\n    min-height:50px;\n    margin:0;\n  }\n}\n</style>''';
  const add=`  #fujiyaLegalAccept14750{\n    width:100%;\n    min-height:50px;\n    margin:0;\n  }\n}\n.fujiya-legal-modal14750{box-sizing:border-box;width:100%;height:var(--fujiya-legal-vh14832,100dvh);min-height:0;overflow:hidden;-webkit-text-size-adjust:100%;text-size-adjust:100%}\n.fujiya-legal-card14750{min-height:0}.fujiya-legal-body14750{min-height:0;flex:1 1 auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}\n.fujiya-legal-gate-check14750{position:relative;box-sizing:border-box}.fujiya-legal-gate-check14750 input[type=\"checkbox\"]{width:22px!important;min-width:22px!important;max-width:22px!important;height:22px!important;min-height:22px!important;max-height:22px!important;flex:0 0 22px!important;padding:0!important;margin:1px 0 0!important;border-radius:5px;accent-color:#2b82ba;box-sizing:border-box}\n@supports (-webkit-touch-callout:none){.fujiya-legal-modal14750{backdrop-filter:none;-webkit-backdrop-filter:none}}\n@media(max-width:600px){.fujiya-legal-modal14750{align-items:flex-end;justify-content:center;padding-top:max(8px,env(safe-area-inset-top,0px));padding-right:max(8px,env(safe-area-inset-right,0px));padding-bottom:max(8px,env(safe-area-inset-bottom,0px));padding-left:max(8px,env(safe-area-inset-left,0px))}.fujiya-legal-card14750{width:100%;max-width:620px;max-height:calc(var(--fujiya-legal-vh14832,100dvh) - max(8px,env(safe-area-inset-top,0px)) - max(8px,env(safe-area-inset-bottom,0px)));border-radius:18px 18px 12px 12px}.fujiya-legal-head14750{flex:0 0 auto;padding:14px 15px}.fujiya-legal-body14750{padding:14px 15px 12px}.fujiya-legal-gate14750 .fujiya-legal-body14750{font-size:.94rem;line-height:1.65}.fujiya-legal-gate14750 .fujiya-legal-actions14750:last-child{flex:0 0 auto;padding:11px 15px 12px}.fujiya-legal-gate14750 .fujiya-legal-body14750>.fujiya-legal-actions14750{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 12px!important}.fujiya-legal-gate14750 .fujiya-legal-body14750>.fujiya-legal-actions14750 button{width:100%;min-width:0;min-height:44px;padding:8px 6px;font-size:.86rem;line-height:1.25}.fujiya-legal-gate-check14750{gap:10px;padding:12px;align-items:flex-start}#fujiyaLegalAccept14750{min-height:48px}}\n@media(max-width:380px){.fujiya-legal-gate14750 .fujiya-legal-body14750>.fujiya-legal-actions14750{grid-template-columns:1fr}}\n</style>`;
  if(!html.includes(old)) throw new Error('style patch target missing'); html=html.replace(old,add);
  const jsOld="  const terms=$('fujiyaTermsModal14750'),privacy=$('fujiyaPrivacyModal14750'),contact=$('fujiyaContactModal14750'),gate=$('fujiyaLegalGate14750');\n";
  const jsNew=jsOld+"  const syncLegalViewport14832=()=>{const h=Math.max(320,Math.round(window.visualViewport?.height||window.innerHeight||document.documentElement.clientHeight||0));document.documentElement.style.setProperty('--fujiya-legal-vh14832',`${h}px`);};\n  syncLegalViewport14832();window.addEventListener('resize',syncLegalViewport14832,{passive:true});window.addEventListener('orientationchange',()=>setTimeout(syncLegalViewport14832,60),{passive:true});window.visualViewport?.addEventListener('resize',syncLegalViewport14832,{passive:true});window.visualViewport?.addEventListener('scroll',syncLegalViewport14832,{passive:true});\n";
  if(!html.includes(jsOld)) throw new Error('js patch target missing'); return html.replace(jsOld,jsNew);
}

async function run(name, device){
  const browser=await webkit.launch({headless:true}); const context=await browser.newContext(device); const page=await context.newPage();
  const out={name,consoleErrors:[],pageErrors:[]}; page.on('console',m=>{if(m.type()==='error')out.consoleErrors.push(m.text())}); page.on('pageerror',e=>out.pageErrors.push(String(e)));
  try{
    await page.goto('http://127.0.0.1:18032/',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>document.getElementById('fujiyaLegalGate14750')?.classList.contains('show'),null,{timeout:20000});
    const data=await page.evaluate(()=>{
      const gate=document.getElementById('fujiyaLegalGate14750'), card=gate?.querySelector('.fujiya-legal-card14750'), cb=document.getElementById('fujiyaLegalAgree14750'), btn=document.getElementById('fujiyaLegalAccept14750');
      const r=e=>{const x=e.getBoundingClientRect();return {x:x.x,y:x.y,w:x.width,h:x.height,b:x.bottom,r:x.right}};
      return {innerW:innerWidth,innerH:innerHeight,scrollW:document.documentElement.scrollWidth,gate:r(gate),card:r(card),checkbox:r(cb),button:r(btn),appVersion:window.__FUJIYA_CLIENT_APP_VERSION__};
    }); Object.assign(out,data);
    out.passed=data.appVersion==='14832-ios-legal-gate-fix' && data.card.y>=-1 && data.card.b<=data.innerH+1 && data.card.x>=-1 && data.card.r<=data.innerW+1 && data.checkbox.w<=30 && data.checkbox.h<=30 && data.button.b<=data.innerH+1 && data.scrollW<=data.innerW+1;
    await page.screenshot({path:`14832-${name}.png`,fullPage:true});
  }catch(e){out.error=String(e?.message||e)}
  await browser.close(); return out;
}

(async()=>{
  const live=await (await fetch(TARGET)).text(); if(!live.includes('14831-onboarding-id-and-chrome-post-fix')) throw new Error('live is not 14831'); const html=patch(live);
  const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html)}); await new Promise(r=>server.listen(18032,'127.0.0.1',r));
  const out={startedAt:new Date().toISOString(),tests:[]}; try{out.tests.push(await run('iphone13',devices['iPhone 13'])); out.tests.push(await run('iphonese',{...devices['iPhone SE'],viewport:{width:375,height:667}})); out.passed=out.tests.every(x=>x.passed);} finally{server.close();out.finishedAt=new Date().toISOString();fs.writeFileSync('mitekore-14832-ios-legal-e2e-result.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));}
  if(!out.passed)process.exit(1);
})();
