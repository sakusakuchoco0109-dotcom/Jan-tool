const {chromium}=require('playwright');
const fs=require('fs');
const APP='https://hilarious-haupia-6e0406.netlify.app/';
const MAIL_API='https://api.mail.tm';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const report={startedAt:new Date().toISOString(),app:APP,version:'',steps:[],issues:[],console:[],timings:{},ids:{}};
let shotNo=0;
function safe(s){return String(s).replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,60)}
async function shot(page,name,full=false){const p='rel-'+String(++shotNo).padStart(2,'0')+'-'+safe(name)+'.png';await page.screenshot({path:p,fullPage:full});return p}
function issue(kind,text,extra={}){report.issues.push({kind,text,...extra});console.log('ISSUE',kind,text)}
async function step(page,name,fn,{critical=false}={}){const t=Date.now();try{const detail=await fn();const screenshot=page?await shot(page,name):'';report.steps.push({name,ok:true,ms:Date.now()-t,detail:detail??null,screenshot});console.log('PASS',name,JSON.stringify(detail??{}));return detail}catch(e){let screenshot='';try{if(page)screenshot=await shot(page,'FAIL-'+name,true)}catch{}const x={name,ok:false,critical,ms:Date.now()-t,error:String(e&&e.stack||e),screenshot};report.steps.push(x);issue(critical?'critical':'warning',name+': '+String(e?.message||e));console.error('FAIL',name,e);if(critical)throw e;return null}}
async function json(url,opt={}){const r=await fetch(url,opt);const t=await r.text();if(!r.ok)throw new Error('HTTP '+r.status+' '+t.slice(0,200));return t?JSON.parse(t):{}}
async function mailbox(){const d=await json(MAIL_API+'/domains?page=1');const domain=(d?.['hydra:member']||[]).find(x=>x?.domain)?.domain;if(!domain)throw new Error('mail.tm domainなし');const address='mitekore-14902-'+Date.now()+'-'+Math.random().toString(36).slice(2,7)+'@'+domain;const password='Mtk!'+Date.now()+'Aa#'+Math.random().toString(36).slice(2,9);await json(MAIL_API+'/accounts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,password})});const tok=await json(MAIL_API+'/token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,password})});return{address,token:tok.token}}
async function getCode(mb,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){const list=await json(MAIL_API+'/messages?page=1',{headers:{authorization:'Bearer '+mb.token}});for(const m of list?.['hydra:member']||[]){const full=await json(MAIL_API+'/messages/'+m.id,{headers:{authorization:'Bearer '+mb.token}});const raw=[full.subject,full.text,...(Array.isArray(full.html)?full.html:[full.html])].filter(Boolean).join('\n');const x=raw.match(/(?:確認コード|認証コード|verification code)[^0-9]{0,100}([0-9]{6})/i)||raw.match(/\b([0-9]{6})\b/);if(x)return x[1]}await sleep(2000)}throw new Error('確認コードメール timeout')}
async function attach(page,label){page.on('pageerror',e=>report.console.push({page:label,type:'pageerror',text:String(e.message||e)}));page.on('console',m=>{if(['error','warning'].includes(m.type()))report.console.push({page:label,type:m.type(),text:m.text().slice(0,1000)})});page.on('response',r=>{const u=r.url();if(r.status()>=400&&(u.includes('script.google')||u.includes('googleusercontent')||u.includes('netlify')))report.console.push({page:label,type:'http'+r.status(),text:u.slice(0,600)})});page.on('dialog',async d=>{report.console.push({page:label,type:'dialog',text:d.message()});try{await d.accept()}catch{}})}
async function dismiss(page){for(let pass=0;pass<3;pass++){for(const sel of ['[data-profile-unlock-close]','#rareBurstCloseBtn','.mike-talk-close','#tutorialCloseBtn','#firstRunPreviewCloseBtn','[data-mag-editor-close]','[data-mag-reader-close]','.image-modal-close','.detail-modal-close']){try{const e=page.locator(sel).first();if(await e.count()&&await e.isVisible())await e.click({timeout:350})}catch{}}}}
async function acceptLegal(page){try{await page.waitForFunction(()=>{const e=document.getElementById('fujiyaLegalGate14750');return !e||e.classList.contains('show')},null,{timeout:8000});const agree=page.locator('#fujiyaLegalAgree14750');if(await agree.count()&&await agree.isVisible()){await agree.check();await page.locator('#fujiyaLegalAccept14750').click();await sleep(500)}}catch{}}
async function freshRegister(page){
  const mb=await mailbox();report.ids.email=mb.address;
  await page.goto(APP,{waitUntil:'domcontentloaded',timeout:60000});await sleep(2500);await acceptLegal(page);
  await page.waitForSelector('#ufsChoiceFirst14759',{timeout:60000});
  await page.locator('#ufsChoiceFirst14759').click();
  await page.waitForFunction(()=>document.querySelector('[data-ufs-step="1"]')?.classList.contains('active'),null,{timeout:10000});
  await page.locator('#ufsStartNormal14728').click();
  await page.waitForFunction(()=>document.querySelector('[data-ufs-step="2"]')?.classList.contains('active'),null,{timeout:10000});
  await page.locator('#ufsEmail14675').fill(mb.address);
  await page.locator('#ufsSendCode14675').click();
  await page.waitForFunction(()=>!document.getElementById('ufsCodeArea14675')?.hidden,null,{timeout:45000});
  const code=await getCode(mb);report.ids.mailCodeReceived=true;
  await page.locator('#ufsCode14675').fill(code);
  const t=Date.now();await page.locator('#ufsVerifyCode14675').click();
  await page.waitForFunction(()=>document.querySelector('[data-ufs-step="3"]')?.classList.contains('active')||/メール確認とアカウント登録が完了/.test(String(document.getElementById('ufsPhraseStatus14675')?.textContent||'')),null,{timeout:120000});
  report.timings.accountVerifyMs=Date.now()-t;
  const phrase=await page.locator('#ufsPhrase14675').innerText().catch(()=> '');
  report.ids.phraseLength=phrase.replace(/\s/g,'').length;
  await page.locator('#ufsPhraseNext14675').click();
  await page.waitForFunction(()=>document.querySelector('[data-ufs-step="4"]')?.classList.contains('active'),null,{timeout:15000});
  await page.locator('#ufsFinish14675').click();await sleep(1800);await dismiss(page);
  const d=await page.evaluate(()=>({userId:localStorage.getItem('fujiya_collection_user_id')||'',mode:localStorage.getItem('fujiya_mitekore_user_mode_v1')||'',setup:localStorage.getItem('fujiya_collection_setup_done_v1')||'',version:String(window.__FUJIYA_CLIENT_APP_VERSION__||document.body.innerText.match(/RC1\.4\.\d+/)?.[0]||'')}));
  report.ids.userId=d.userId;report.version=d.version;return d
}
async function nav(page,tab){await dismiss(page);const ds=page.locator('[data-ui-tab="'+tab+'"]:visible').first();if(await ds.count()){await ds.click();await sleep(700);return}const ms=page.locator('[data-mobile-tab="'+tab+'"]:visible').first();if(await ms.count()){await ms.click();await sleep(700);return}if(tab==='magazine'){const x=page.getByText('みてトピ',{exact:false}).filter({visible:true}).last();if(await x.count()){await x.click();await sleep(700);return}}throw new Error('navなし '+tab)}
async function registerGame(page,platform,title,owned='owned'){
  await nav(page,'register');const quick=page.locator('#quickRegisterModeBtn');if(await quick.count()&&await quick.isVisible()){await quick.click();await sleep(200)}
  await page.locator('#platform').fill(platform);await page.locator('#title').fill(title);await page.locator('#title').dispatchEvent('input');await sleep(500);
  const radio=page.locator('input[name="owned"][value="'+owned+'"]');if(await radio.count())await radio.check();
  await page.locator('#saveBtn').click();await sleep(1500);await dismiss(page);
  return page.evaluate(title=>{let r={};try{r=JSON.parse(localStorage.getItem('fujiya_collection_v1')||'{}')}catch{};return (r.entries||[]).find(e=>e.title===title)||null},title)
}
async function state(page){return page.evaluate(()=>{let r={};try{r=JSON.parse(localStorage.getItem('fujiya_collection_v1')||'{}')}catch{};return{entries:(r.entries||[]).map(e=>({id:e.id,title:e.title,platform:e.platform,owned:e.owned,memo:e.memo,updatedAt:e.updatedAt})),userId:localStorage.getItem('fujiya_collection_user_id')||''}})}
async function waitTitle(page,title,timeout){const t=Date.now();try{await page.waitForFunction(title=>{try{const r=JSON.parse(localStorage.getItem('fujiya_collection_v1')||'{}');return (r.entries||[]).some(e=>e.title===title)}catch{return false}},title,{timeout,polling:1000});return Date.now()-t}catch{return -1}}
async function openSync(page){const more=page.locator('[data-desktop-more]:visible').first();if(await more.count()){await more.click();await sleep(200);const tab=page.locator('[data-desktop-tab="sync"]:visible').first();if(await tab.count()){await tab.click();await sleep(700);return}}const b=page.getByText('端末同期',{exact:false}).filter({visible:true}).last();if(await b.count()){await b.click();await sleep(700);return}throw new Error('同期画面を開けない')}
async function pairPhone(browser,pc){
  await openSync(pc);await pc.locator('#devicePairShowQrBtn:visible').click();await pc.waitForFunction(()=>!!document.querySelector('#devicePairUrl')?.dataset?.url,null,{timeout:20000});const url=await pc.locator('#devicePairUrl').evaluate(e=>e.dataset.url||'');
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ja-JP'});const p=await ctx.newPage();await attach(p,'phone');const t=Date.now();await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForFunction(()=>document.body.innerText.includes('端末の接続が完了しました')||document.body.innerText.includes('接続完了：登録'),null,{timeout:300000});
  report.timings.pairMs=Date.now()-t;await sleep(1200);await dismiss(p);return{ctx,page:p,url}
}
async function detailButton(page,id,action){await nav(page,'list');const b=page.locator('button[data-action="detail"][data-id="'+id+'"]').first();if(await b.count()){await b.click();await sleep(450)}else{const e=page.locator('button[data-action="edit"][data-id="'+id+'"]').first();if(await e.count())await e.click();else throw new Error('詳細/編集ボタンなし')}const a=page.locator('[data-detail-action="'+action+'"]').first();if(!await a.count())throw new Error('detail actionなし '+action);await a.click();await sleep(700)}
(async()=>{
  const browser=await chromium.launch({headless:true});
  const pcCtx=await browser.newContext({viewport:{width:1440,height:1000},locale:'ja-JP'});const pc=await pcCtx.newPage();await attach(pc,'pc');
  await step(pc,'初回登録_メール確認_じゅもん_開始',()=>freshRegister(pc),{critical:true});
  await step(pc,'プロフィール編集',async()=>{const b=pc.locator('#quickProfileEditBtn');if(!await b.count())throw new Error('プロフィール編集ボタンなし');await b.click();await sleep(400);const n=pc.locator('#quickUserNameInput');await n.fill('ChatGPT配布前監査0924');const bio=pc.locator('#quickProfileBioInput');if(await bio.count())await bio.fill('配布前E2E監査');await pc.locator('#quickSaveUserNameBtn').click();await sleep(1200);return{saved:true}});
  const fire=await step(pc,'PC_所持登録_FireRed',()=>registerGame(pc,'GBA','ポケットモンスター ファイアレッド','owned'),{critical:true});if(fire)report.ids.fireId=fire.id;
  const mother=await step(pc,'PC_欲しい登録_MOTHER2',()=>registerGame(pc,'SFC','MOTHER2 ギーグの逆襲','want'));if(mother)report.ids.motherId=mother.id;
  const paired=await step(pc,'端末接続_PCからスマホ',()=>pairPhone(browser,pc),{critical:true});const phone=paired.page;
  await step(phone,'PC登録がスマホへ反映',async()=>{const ms=await waitTitle(phone,'ポケットモンスター ファイアレッド',60000);if(ms<0)throw new Error('60秒で反映なし');report.timings.pcToPhoneMs=ms;return{ms}});
  const mugen=await step(phone,'スマホ_所持登録_夢幻の如く',()=>registerGame(phone,'SFC','夢幻の如く','owned'),{critical:true});if(mugen)report.ids.mugenId=mugen.id;
  await step(pc,'スマホ登録がPCへ自動反映',async()=>{const ms=await waitTitle(pc,'夢幻の如く',210000);report.timings.phoneToPcMs=ms;if(ms<0)throw new Error('210秒で反映なし');return{ms,seconds:Math.round(ms/1000)}});
  await step(pc,'一覧_検索_編集保存',async()=>{await nav(pc,'list');const q=pc.locator('#search');await q.fill('ポケットモンスター ファイアレッド');await sleep(500);const visible=await pc.locator('button[data-action="edit"]:visible,button[data-action="detail"]:visible').count();await q.fill('');const edit=pc.locator('button[data-action="edit"][data-id="'+fire.id+'"]').first();if(!await edit.count())throw new Error('編集ボタンなし');await edit.click();await sleep(400);const memo=pc.locator('#memo');if(await memo.count())await memo.fill('配布前監査メモ0924');await pc.locator('#saveBtn').click();await sleep(1200);return{visible}});
  await step(phone,'PC編集メモがスマホへ反映',async()=>{const t=Date.now();try{await phone.waitForFunction(id=>{try{const r=JSON.parse(localStorage.getItem('fujiya_collection_v1')||'{}');return (r.entries||[]).find(e=>e.id===id)?.memo==='配布前監査メモ0924'}catch{return false}},fire.id,{timeout:180000,polling:1000});const ms=Date.now()-t;report.timings.editPcToPhoneMs=ms;return{ms}}catch{throw new Error('180秒で編集メモ反映なし')}});
  await step(pc,'欲しいものリスト',async()=>{await nav(pc,'buyback');const b=pc.locator('#openWishlistListBtn');if(!await b.count())throw new Error('欲しいものボタンなし');await b.click();await sleep(600);const body=await pc.locator('body').innerText();if(!body.includes('MOTHER2'))throw new Error('MOTHER2が欲しいものに出ない');return{found:true}});
  await step(pc,'ショーケース追加',async()=>{await pc.keyboard.press('Escape').catch(()=>{});await detailButton(pc,fire.id,'shelf');return pc.evaluate(()=>({count:window.__MITEKORE_SHOWCASE_API__?.getProfileItems?.().length||0}))});
  await step(pc,'買取リスト追加',async()=>{await pc.keyboard.press('Escape').catch(()=>{});await detailButton(pc,fire.id,'buyback');await nav(pc,'buyback');const b=pc.locator('#openBuybackListBtn');if(await b.count()){await b.click();await sleep(500)}const text=await pc.locator('body').innerText();if(!text.includes('ポケットモンスター ファイアレッド'))throw new Error('買取リストにFireRedなし');return{found:true}});
  await step(pc,'図鑑_検索',async()=>{await pc.keyboard.press('Escape').catch(()=>{});await nav(pc,'dex');const q=pc.locator('#dexSearch');if(!await q.count())throw new Error('図鑑検索欄なし');await q.fill('MOTHER2');await q.dispatchEvent('input');await sleep(1200);const body=await pc.locator('body').innerText();if(!body.includes('MOTHER2'))throw new Error('図鑑検索でMOTHER2なし');return{found:true}});
  await step(pc,'みてレコ_画面表示',async()=>{await nav(pc,'mitereco');await sleep(1500);const body=await pc.locator('body').innerText();return{hasPlay:/遊ぶ|プレイ|みてレコ/.test(body),excerpt:body.slice(-700)}});
  await step(pc,'みてトピ_記事閲覧_PC',async()=>{await nav(pc,'magazine');await sleep(2500);const read=pc.locator('[data-mag-read]:visible').first();if(!await read.count())throw new Error('記事カードなし');await read.click();await sleep(1200);const modal=pc.locator('#miteMagazineReaderModal');if(!await modal.count()||await modal.isHidden())throw new Error('記事モーダル開かない');const box=await pc.locator('.mitemaga-reader-toolbar').boundingBox();if(!box||box.y<0)throw new Error('記事上端が画面外 '+JSON.stringify(box));return{toolbarY:box.y}});
  await step(phone,'みてトピ_記事閲覧_スマホ上被り',async()=>{await phone.keyboard.press('Escape').catch(()=>{});await nav(phone,'magazine');await sleep(2500);const read=phone.locator('[data-mag-read]:visible').first();if(!await read.count())throw new Error('スマホ記事カードなし');await read.click();await sleep(1000);const toolbar=phone.locator('.mitemaga-reader-toolbar');const box=await toolbar.boundingBox();const close=phone.locator('[data-mag-reader-close]');const cb=await close.boundingBox();if(!box||box.y<0||!cb||cb.y<0)throw new Error('上被り '+JSON.stringify({box,cb}));return{toolbarY:box.y,closeY:cb.y,viewport:await phone.evaluate(()=>({w:innerWidth,h:innerHeight}))}});
  await step(pc,'完全バックアップ_ダウンロード',async()=>{await pc.keyboard.press('Escape').catch(()=>{});const more=pc.locator('[data-desktop-more]:visible').first();if(await more.count()){await more.click();await sleep(200);const m=pc.locator('[data-desktop-tab="manage"]:visible').first();if(await m.count())await m.click()}await sleep(500);const b=pc.locator('#exportFullBackupBtn');if(!await b.count())throw new Error('完全バックアップボタンなし');const dl=pc.waitForEvent('download',{timeout:30000});await b.click();const d=await dl;return{filename:d.suggestedFilename()}});
  await step(pc,'特大文字_主要モーダル上被り',async()=>{await pc.evaluate(()=>{document.documentElement.setAttribute('data-fujiya-font-size','xlarge');localStorage.setItem('fujiya_font_size_v1','xlarge')});await nav(pc,'magazine');await sleep(1500);const r=pc.locator('[data-mag-read]:visible').first();if(await r.count())await r.click();await sleep(700);const box=await pc.locator('.mitemaga-reader-toolbar').boundingBox();if(box&&box.y<0)throw new Error('特大で上被り');return{toolbarY:box?.y??null}});
  const pcState=await state(pc),phState=await state(phone);report.state={pc:pcState,phone:phState};
  for(const x of report.console){if(x.type==='pageerror')issue('console','pageerror: '+x.text,{page:x.page});if(/^http4|^http5/.test(x.type))issue('network',x.type+' '+x.text,{page:x.page})}
  if(report.timings.phoneToPcMs>120000)issue('ux','スマホ→PC同期が2分超',{ms:report.timings.phoneToPcMs});
  if(report.timings.phoneToPcMs>60000)issue('ux','スマホ→PC同期が1分超で待ち感あり',{ms:report.timings.phoneToPcMs});
  report.finishedAt=new Date().toISOString();report.summary={passed:report.steps.filter(x=>x.ok).length,failed:report.steps.filter(x=>!x.ok).length,criticalFailed:report.steps.filter(x=>!x.ok&&x.critical).length,issueCount:report.issues.length};
  fs.writeFileSync('mitekore-14902-release-audit-result.json',JSON.stringify(report,null,2));console.log('AUDIT_SUMMARY '+JSON.stringify(report.summary));await browser.close();
  if(report.summary.criticalFailed)process.exit(2);
})().catch(async e=>{report.fatal=String(e&&e.stack||e);report.finishedAt=new Date().toISOString();fs.writeFileSync('mitekore-14902-release-audit-result.json',JSON.stringify(report,null,2));console.error('AUDIT_FATAL',e);process.exit(1)});
// trigger 2026-09-24 release audit
