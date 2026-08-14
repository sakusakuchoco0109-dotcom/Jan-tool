const { chromium } = require('playwright');
const fs=require('fs');
const APP='http://127.0.0.1:8899/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const out={startedAt:new Date().toISOString(),steps:[]};
 const browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 await ctx.addInitScript(()=>{
   localStorage.setItem('fujiya_mitekore_early_access_v2',JSON.stringify({orderNumber:'99999999',verifiedAt:Date.now(),campaign:'rc544-final'}));
   localStorage.setItem('fujiya_collection_setup_done_v1','1');
   localStorage.setItem('fujiya_collection_tutorial_seen_v2_rc1474','1');
   localStorage.setItem('fujiya_collection_first_run_seen_v20_2_35cn','1');
   localStorage.setItem('fujiya_collection_user_name','ChatGPT544最終確認0815');
   localStorage.setItem('fujiya_collection_share_opt_in_v1','1');
 });
 const p=await ctx.newPage();p.setDefaultTimeout(20000);p.on('dialog',d=>d.accept().catch(()=>{}));
 await p.goto(APP,{waitUntil:'domcontentloaded',timeout:60000});await sleep(7000);
 for(const s of ['[data-profile-unlock-close]','.mike-talk-close','#tutorialCloseBtn','#firstRunCloseBtn','#rareBurstCloseBtn']){try{const e=p.locator(s).first();if(await e.count()&&await e.isVisible())await e.click({timeout:500})}catch{}}
 const v=await p.evaluate(()=>({hero:document.querySelector('.hero-build-version')?.textContent||'',core:[...document.scripts].map(s=>s.src).find(s=>s.includes('app-core-'))||''}));
 if(v.hero!=='RC1.4.544'||!v.core.includes('app-core-544.js'))throw Error('544 asset mismatch '+JSON.stringify(v));
 out.steps.push({name:'544資産',ok:true,detail:v});await p.screenshot({path:'rc544final-01-asset.png'});
 const tab=p.locator('[data-ui-tab="magazine"]:visible').first();await tab.click();await sleep(2500);
 const q=p.locator('#miteMagazineSearch');const prefix='ChatGPT544長文スクロール検証0815';let card=null;
 const end=Date.now()+120000;
 while(Date.now()<end){await q.fill(prefix);await sleep(500);const c=p.locator('.mitemaga-card:visible').filter({hasText:prefix}).first();if(await c.count()){card=c;break;}const refresh=p.locator('[data-mag-refresh]').first();if(await refresh.count()&&await refresh.isVisible())await refresh.click().catch(()=>{});await sleep(3500);}
 if(!card)throw Error('長文検証記事が見つからない');
 const read=card.getByRole('button',{name:'続きを読む',exact:true}).first();await read.waitFor({state:'visible',timeout:20000});await read.click();
 const modal=p.locator('#miteMagazineReaderModal');await modal.waitFor({state:'visible',timeout:30000});await p.locator('#miteMagazineReader .mitemaga-reader-body').waitFor({state:'visible',timeout:30000});
 const before=await modal.evaluate(el=>({scrollTop:el.scrollTop,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,overflow:getComputedStyle(el).overflowY,cardMax:getComputedStyle(el.querySelector('.mitemaga-reader-card')).maxHeight,cardOverflow:getComputedStyle(el.querySelector('.mitemaga-reader-card')).overflowY}));
 if(before.scrollHeight<=before.clientHeight+300)throw Error('reader modal not scrollable '+JSON.stringify(before));
 const box=await modal.boundingBox();if(box)await p.mouse.move(box.x+box.width*.65,box.y+box.height*.7);
 for(let i=0;i<30;i++){await p.mouse.wheel(0,1100);await sleep(50);}
 const after=await modal.evaluate(el=>({scrollTop:el.scrollTop,max:el.scrollHeight-el.clientHeight}));
 if(after.scrollTop<after.max-120)throw Error('cannot reach bottom '+JSON.stringify({before,after}));
 out.steps.push({name:'みてマガ長文スクロール',ok:true,detail:{before,after,title:await p.locator('#miteMagazineReaderTitle').innerText()}});await p.screenshot({path:'rc544final-02-magazine-bottom.png'});
 await p.locator('[data-mag-reader-close]:visible').click();
 const notify=await p.evaluate(()=>{const o=document.createElement('div');o.className='profile-unlock-overlay profile-unlock-nonblocking show';o.innerHTML='<section class="profile-unlock-dialog"><h2>通知確認</h2><button>閉じる</button></section>';document.body.appendChild(o);const r={overlayPointer:getComputedStyle(o).pointerEvents,dialogPointer:getComputedStyle(o.firstElementChild).pointerEvents,position:getComputedStyle(o).position};o.remove();return r});
 if(notify.overlayPointer!=='none'||notify.dialogPointer!=='auto')throw Error('nonblocking title notification failed '+JSON.stringify(notify));
 out.steps.push({name:'二つ名通知非ブロッキング',ok:true,detail:notify});await p.screenshot({path:'rc544final-03-notification.png'});
 out.finishedAt=new Date().toISOString();fs.writeFileSync('rc544-final-result.json',JSON.stringify(out,null,2));await browser.close();
})().catch(e=>{fs.writeFileSync('rc544-final-result.json',JSON.stringify({error:String(e&&e.stack||e)},null,2));console.error(e);process.exit(1)});
