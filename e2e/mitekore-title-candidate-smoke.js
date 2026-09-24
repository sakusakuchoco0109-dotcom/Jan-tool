const { chromium } = require('playwright');
const BASE='https://hilarious-haupia-6e0406.netlify.app/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function prep(page,name){
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForTimeout(1200);
  const normal=page.locator('#fujiyaEarlyAccessNormalStart14728');
  if(await normal.isVisible().catch(()=>false)){await normal.click();await page.waitForTimeout(350);}
  const agree=page.locator('#fujiyaLegalAgree14750');
  if(await agree.isVisible().catch(()=>false)){
    await agree.check();
    await page.locator('#fujiyaLegalAccept14750').click();
    await page.waitForTimeout(350);
  }
  const unified=page.locator('#unifiedFirstSetup14675');
  if(await unified.isVisible().catch(()=>false)){
    await page.evaluate(()=>{
      localStorage.setItem('fujiya_unified_first_setup_v1_done','1');
      localStorage.setItem('fujiya_collection_setup_done_v1',new Date().toISOString());
      localStorage.setItem('fujiya_collection_first_run_seen_v20_2_35cn','1');
      localStorage.setItem('fujiya_collection_tutorial_seen_v2_rc1474','1');
      window.__MITEKORE_UNIFIED_SETUP_ACTIVE__=false;
      const el=document.getElementById('unifiedFirstSetup14675');if(el){el.hidden=true;el.style.display='none';}
    });
  }
  const idx=await page.evaluate(async()=>{
    const t=performance.now();
    const res=await fetch('title-index-14905.json',{cache:'no-store'});
    const data=await res.json();
    return {ok:res.ok,count:data.count,ms:Math.round(performance.now()-t),bytes:JSON.stringify(data).length};
  });
  console.log('STATIC_INDEX',name,JSON.stringify(idx));
}
async function test(page,name,title){
  await page.evaluate(()=>{
    (document.querySelector('[data-mobile-tab="register"]')||document.querySelector('[data-ui-tab="register"]'))?.click();
  });
  await page.waitForTimeout(500);
  const quick=page.locator('#quickRegisterModeBtn');
  if(await quick.isVisible().catch(()=>false))await quick.click();
  await page.locator('#platform').fill('SFC');
  await page.locator('#title').fill(title);
  const started=Date.now();
  const cand=page.locator('#masterCandidates .candidate-item').filter({hasText:title}).first();
  await cand.waitFor({state:'visible',timeout:10000});
  const ms=Date.now()-started;
  const text=(await cand.innerText()).replace(/\s+/g,' ').trim();
  console.log('CANDIDATE',name,title,ms+'ms',text);
  return ms;
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const pc=await browser.newPage({viewport:{width:1440,height:900}});
    await prep(pc,'PC');
    const pcMs=await test(pc,'PC','スーパーマリオワールド');

    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const mobile=await ctx.newPage();
    await prep(mobile,'MOBILE');
    const mMs=await test(mobile,'MOBILE','クロノ・トリガー');

    console.log('RESULT_JSON '+JSON.stringify({pcMs,mobileMs,ok:pcMs<3000&&mMs<3000}));
    await ctx.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});