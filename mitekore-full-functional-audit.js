const {chromium}=require('playwright');
const fs=require('fs');
const APP='https://hilarious-haupia-6e0406.netlify.app/';
const PRIMARY='ChatGPT総合検証0814';
const PARTICIPANT='ChatGPT参加者0814';
const COMP='ChatGPT総合検証0814 タイムアタック';
const ARTICLE='ChatGPT総合検証0814 動作確認';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAATUlEQVR4nO3PQQ0AIBDAsAP/nuGNAvZoFSzZOjNnyNi1dwfgUQCeBOBJAPYgAE8CsCQATwKwJwF4EoAnAdiDADwJwJMA7EEAngRgTwLwJAB7EgBfsA0Cfn4UQwAAAABJRU5ErkJggg==','base64');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const report={startedAt:new Date().toISOString(),version:'',steps:[],errors:[],ids:{},observations:[]};
let shotNo=0;
function safeName(s){return String(s).replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,70)}
async function shot(page,name,full=false){shotNo++;const path=`audit-${String(shotNo).padStart(2,'0')}-${safeName(name)}.png`;await page.screenshot({path,fullPage:full});return path}
async function dismiss(page){
 for(let pass=0;pass<3;pass++)for(const sel of ['[data-profile-unlock-close]','#rareBurstCloseBtn','.mike-talk-close','#tutorialCloseBtn','#firstRunCloseBtn','[data-mag-editor-close]','[data-mag-reader-close]','[data-mitereco-close-player-profile]']){try{const e=page.locator(sel).first();if(await e.count()&&await e.isVisible())await e.click({timeout:350})}catch{}}
}
async function step(page,name,fn){const started=Date.now();try{const detail=await fn();const screenshot=await shot(page,name);report.steps.push({name,ok:true,ms:Date.now()-started,detail:detail??null,screenshot});console.log('PASS',name,JSON.stringify(detail??{}));return detail}catch(e){let screenshot='';try{screenshot=await shot(page,'FAIL-'+name,true)}catch{}const item={name,ok:false,ms:Date.now()-started,error:String(e&&e.stack||e),screenshot};report.steps.push(item);report.errors.push(item);console.error('FAIL',name,e);return null}}
async function context(browser,name,phone=false){
 const ctx=await browser.newContext(phone?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:1000}});
 await ctx.addInitScript(({name})=>{
   localStorage.setItem('fujiya_mitekore_early_access_v2',JSON.stringify({orderNumber:'99999999',verifiedAt:Date.now(),campaign:'full-functional-audit'}));
   localStorage.setItem('fujiya_collection_setup_done_v1','1');
   localStorage.setItem('fujiya_collection_tutorial_seen_v2_rc1474','1');
   localStorage.setItem('fujiya_collection_first_run_seen_v20_2_35cn','1');
   localStorage.setItem('fujiya_collection_user_name',name);
   localStorage.setItem('fujiya_collection_share_opt_in_v1','1');
   localStorage.setItem('fujiya_collection_share_purchase_price_opt_in_v1','1');
 },{name});
 return ctx;
}
async function openApp(ctx,name){const p=await ctx.newPage();p.on('pageerror',e=>report.observations.push({page:name,type:'pageerror',text:e.message}));p.on('console',m=>{if(['error','warning'].includes(m.type()))report.observations.push({page:name,type:m.type(),text:m.text().slice(0,1200)})});p.on('dialog',async d=>{report.observations.push({page:name,type:'dialog',text:d.message()});try{await d.accept()}catch{}});await p.goto(APP,{waitUntil:'domcontentloaded',timeout:60000});await sleep(7000);await dismiss(p);if(!report.version)report.version=await p.evaluate(()=>document.body.innerText.match(/RC1\.4\.\d+/)?.[0]||'');return p}
async function nav(page,tab){await dismiss(page);const e=page.locator(`[data-ui-tab="${tab}"]:visible`).first();if(!await e.count())throw new Error('nav not found '+tab);await e.click();await sleep(900);await dismiss(page)}
async function register(page,platform,title,owned='owned'){
 await nav(page,'register');const quick=page.locator('#quickRegisterModeBtn');if(await quick.count()&&await quick.isVisible()){await quick.click();await sleep(200)}
 await page.locator('#platform').fill(platform);await page.locator('#title').fill(title);await page.locator('#title').dispatchEvent('input');
 const radio=page.locator(`input[name="owned"][value="${owned}"]`);await radio.check();await sleep(500);await page.locator('#saveBtn').click();await sleep(1800);await dismiss(page);
 return page.evaluate(title=>{let root={};try{root=JSON.parse(localStorage.getItem('fujiya_collection_v1')||'{}')}catch{};return (root.entries||[]).find(e=>e.title===title)||null},title);
}
async function listDetail(page,id){await nav(page,'list');await page.locator(`button[data-action="detail"][data-id="${id}"]`).first().click({timeout:10000});await sleep(500)}
async function magazineNav(page){await nav(page,'magazine');await sleep(2500)}
async function recoNav(page){await nav(page,'mitereco');await sleep(2500)}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const pctx=await context(browser,PRIMARY,false);const pc=await openApp(pctx,'primary');
 await step(pc,'本番バージョン確認',async()=>({version:report.version,asset:[...document.scripts||[]]}));
 await step(pc,'プロフィール編集保存',async()=>{
   await pc.locator('#quickProfileEditBtn').click();await sleep(500);
   await pc.locator('#quickUserNameInput').fill(PRIMARY);await pc.locator('#quickProfileBioInput').fill('みてコレ！総合動作確認用のテストプロフィールです。');
   const plats=pc.locator('[data-quick-profile-platform]');if(await plats.count()>0)await plats.nth(0).selectOption({label:'ゲームボーイアドバンス'}).catch(async()=>await plats.nth(0).selectOption('GBA').catch(()=>{}));
   const games=pc.locator('[data-quick-profile-game]');if(await games.count()>0)await games.nth(0).fill('ポケットモンスター ファイアレッド');
   await pc.locator('[data-quick-status-edit-tab="links"]').click();await pc.locator('#quickProfileLinkX').fill('@ChatGPT_Test_0814');
   await pc.locator('[data-quick-status-edit-tab="privacy"]').click();if(await pc.locator('#profilePublicBio').count())await pc.locator('#profilePublicBio').check();
   await pc.locator('#quickSaveUserNameBtn').click();await sleep(1800);
   const data=await pc.evaluate(()=>({userId:localStorage.getItem('fujiya_collection_user_id')||'',name:localStorage.getItem('fujiya_collection_user_name')||'',profile:JSON.parse(localStorage.getItem('fujiya_collection_profile_v20_1')||'{}')}));report.ids.primaryUserId=data.userId;return data;
 });
 const fire=await step(pc,'かんたん登録_所持_FireRed',()=>register(pc,'GBA','ポケットモンスター ファイアレッド','owned'));
 const mugen=await step(pc,'かんたん登録_所持_夢幻',()=>register(pc,'SFC','夢幻の如く','owned'));
 const mother=await step(pc,'かんたん登録_欲しい_MOTHER2',()=>register(pc,'SFC','MOTHER2 ギーグの逆襲','want'));
 if(fire)report.ids.fireId=fire.id;if(mugen)report.ids.mugenId=mugen.id;if(mother)report.ids.motherId=mother.id;
 await step(pc,'登録編集_画像とメモ',async()=>{
   await nav(pc,'list');await pc.locator(`button[data-action="edit"][data-id="${fire.id}"]`).first().click();await sleep(500);
   await pc.locator('#memo').fill('ChatGPT総合検証0814 編集テスト');await pc.locator('#photo').setInputFiles({name:'audit.png',mimeType:'image/png',buffer:PNG});
   await pc.waitForFunction(()=>String(document.querySelector('#photoPreview')?.src||'').startsWith('data:image/'),undefined,{timeout:20000});await pc.locator('#saveBtn').click();await sleep(3500);await dismiss(pc);
   return pc.evaluate(id=>{let r={};try{r=JSON.parse(localStorage.getItem('fujiya_collection_v1')||'{}')}catch{};const e=(r.entries||[]).find(x=>x.id===id);return {memo:e?.memo,updatedAt:e?.updatedAt}},fire.id)
 });
 await step(pc,'一覧_検索カード一覧切替絞込',async()=>{
   await nav(pc,'list');await pc.locator('#search').fill('ポケットモンスター ファイアレッド');await sleep(500);
   const before=await pc.locator('[data-action="detail"]:visible').count();const listBtn=pc.getByRole('button',{name:'一覧',exact:true}).last();if(await listBtn.count())await listBtn.click();await sleep(350);
   if(await pc.locator('#openFilterSheetBtn').count()){await pc.locator('#openFilterSheetBtn').click();await sleep(250);const fo=pc.locator('#filterOwned');if(await fo.count())await fo.selectOption('owned');const apply=pc.getByRole('button',{name:/適用|絞り込/}).last();if(await apply.count()&&await apply.isVisible())await apply.click().catch(()=>{});}
   await pc.locator('#search').fill('');return {visibleDetailButtons:before,bodyHasFire:(await pc.locator('body').innerText()).includes('ポケットモンスター ファイアレッド')}
 });
 await step(pc,'ショーケース追加とサイズ変更',async()=>{
   await listDetail(pc,fire.id);await pc.locator('[data-detail-action="shelf"]').click();await sleep(800);await pc.locator('#cardDetailClose').click().catch(()=>pc.keyboard.press('Escape'));await sleep(500);
   const initial=await pc.evaluate(()=>window.__MITEKORE_SHOWCASE_API__?.getProfileItems?.()||[]);if(!initial.length)throw new Error('ショーケース追加後0件');
   const api=await pc.evaluate(id=>{const a=window.__MITEKORE_SHOWCASE_API__;const keys=Object.keys(a?.presets||{});let changed=false;for(const k of keys){if(k!=='1x1'){try{const r=a.setSize(id,k);if(r!==false){changed=true;break}}catch{}}}return {items:a?.getProfileItems?.()||[],changed,presets:keys}},fire.id);
   await sleep(700);return {initialCount:initial.length,...api};
 });
 await step(pc,'買取リスト追加と表示',async()=>{
   await listDetail(pc,mugen.id);await pc.locator('[data-detail-action="buyback"]').click();await sleep(800);await pc.keyboard.press('Escape').catch(()=>{});await nav(pc,'buyback');await pc.locator('#openBuybackListBtn').click();await sleep(800);
   const body=await pc.locator('body').innerText();if(!body.includes('夢幻の如く'))throw new Error('買取リストに夢幻の如くが表示されない');return {found:true};
 });
 await step(pc,'欲しいものリスト表示',async()=>{
   await nav(pc,'buyback');await pc.locator('#openWishlistListBtn').click();await sleep(800);const body=await pc.locator('body').innerText();if(!body.includes('MOTHER2'))throw new Error('欲しいものリストにMOTHER2が表示されない');return {found:true};
 });
 await step(pc,'図鑑検索とソート',async()=>{
   await nav(pc,'dex');const q=pc.locator('#dexSearch');await q.fill('MOTHER2');await q.dispatchEvent('input');await sleep(1200);const body=await pc.locator('body').innerText();const sort=pc.locator('#dexSortSelect');if(await sort.count())await sort.selectOption('ratingDesc').catch(()=>{});if(!body.includes('MOTHER2'))throw new Error('図鑑検索でMOTHER2が見つからない');return {found:true};
 });
 await step(pc,'みてレコ_競技作成',async()=>{
   await recoNav(pc);const create=pc.locator('[data-mitereco-toggle-create]').first();await create.click();await sleep(600);
   await pc.locator('#miteRecoGameTitle').fill('ポケットモンスター ファイアレッド');await pc.locator('#miteRecoGameTitle').dispatchEvent('input');await sleep(1000);const sugg=pc.locator('[data-mitereco-game-choice]').first();if(await sugg.count()&&await sugg.isVisible())await sugg.click();
   await pc.locator('#miteRecoCompetitionName').fill(COMP);await pc.locator('#miteRecoCompetitionTags').fill('#総合検証 #ChatGPT');await pc.locator('#miteRecoCompetitionDetails').fill('ChatGPTによる総合動作確認用のテスト競技です。自己申告・自動承認。');await pc.locator('#miteRecoProofRequirement').selectOption('self');await pc.locator('#miteRecoApprovalMode').selectOption('auto');await pc.locator('#miteRecoType').selectOption('time');await pc.locator('#miteRecoDirection').selectOption('low');
   await pc.locator('#miteRecoCompetitionForm button[type="submit"]').click();await pc.waitForFunction(name=>document.body.innerText.includes(name)&&!document.querySelector('#miteRecoCompetitionForm'),COMP,{timeout:90000});await sleep(2500);
   const row=pc.locator('.mitereco-browser-card').filter({hasText:COMP}).first();if(!await row.count())throw new Error('作成競技カードが見つからない');const id=await row.locator('[data-mitereco-open-competition-detail]').getAttribute('data-mitereco-open-competition-detail');report.ids.competitionId=id;return {competitionId:id};
 });
 await step(pc,'みてレコ_作成者記録投稿',async()=>{
   await recoNav(pc);await pc.locator('#miteRecoCompetitionSearch').fill(COMP);await sleep(600);const row=pc.locator('.mitereco-browser-card').filter({hasText:COMP}).first();await row.locator('[data-mitereco-quick-join]').click();await sleep(900);await pc.locator('#miteRecoRecordValue').fill('1:23.45');const details=pc.locator('.mitereco-record-note-details');if(await details.count())await details.evaluate(e=>e.open=true);await pc.locator('#miteRecoRecordNote').fill('ChatGPT総合検証0814 初回記録');await pc.locator('#miteRecoRecordForm button[type="submit"]').click();await pc.waitForFunction(()=>document.body.innerText.includes('記録を投稿しました')||document.body.innerText.includes('自己ベスト'),undefined,{timeout:90000});return {posted:true};
 });
 await step(pc,'みてマガ_下書き保存して再開',async()=>{
   await magazineNav(pc);await pc.locator('[data-mag-write]').click();await sleep(500);await pc.locator('#miteMagazineTitle').fill(ARTICLE);const text=pc.locator('#miteMagazineBlockEditor [data-mag-block-field="text"]').first();await text.fill('ChatGPTによるみてコレ！総合動作確認用の記事です。本文・下書き・公開・アンケート・別ユーザー投票まで確認します。');await pc.locator('#miteMagazineTags').fill('総合検証, ChatGPT');
   await pc.locator('[data-mag-save-draft]').click();await pc.waitForFunction(()=>document.querySelector('#miteMagazineEditStatus')?.innerText.includes('下書き'),undefined,{timeout:15000});await pc.locator('[data-mag-editor-close]').click();await sleep(600);
   const draft=pc.locator('[data-mag-draft]').filter({hasText:ARTICLE}).first();if(!await draft.count())throw new Error('保存した下書きが一覧にない');await draft.click();await sleep(700);if(await pc.locator('#miteMagazineTitle').inputValue()!==ARTICLE)throw new Error('下書き再開でタイトル不一致');return {draftReopened:true};
 });
 await step(pc,'みてマガ_アンケート付き公開',async()=>{
   await pc.locator('#miteMagazinePollEnabled').check();await pc.locator('#miteMagazinePollQuestion').fill('総合動作確認はどうでしたか？');const opts=pc.locator('.mitemaga-poll-option-input');await opts.nth(0).fill('正常');await opts.nth(1).fill('要改善');await pc.locator('#miteMagazinePublishBtn').click();
   await pc.waitForFunction(()=>document.querySelector('#miteMagazineEditorModal')?.hidden===true,undefined,{timeout:120000});await sleep(5000);await pc.locator('#miteMagazineSearch').fill(ARTICLE);await sleep(700);const read=pc.locator('[data-mag-read]').filter({hasText:ARTICLE}).first();let target=read;if(!await target.count())target=pc.locator('.mitemaga-card').filter({hasText:ARTICLE}).locator('[data-mag-read]').first();if(!await target.count())throw new Error('公開記事が一覧に見つからない');const id=await target.getAttribute('data-mag-read');report.ids.articleId=id;await target.click();await sleep(2500);const body=await pc.locator('#miteMagazineReader').innerText();if(!body.includes('アンケート'))throw new Error('公開記事にアンケートが表示されない');return {articleId:id};
 });
 // second independent user: real community participation
 const sctx=await context(browser,PARTICIPANT,false);const second=await openApp(sctx,'participant');
 await step(second,'別ユーザー_プロフィール保存',async()=>{await second.locator('#quickProfileEditBtn').click();await sleep(400);await second.locator('#quickUserNameInput').fill(PARTICIPANT);await second.locator('#quickProfileBioInput').fill('総合検証の参加側アカウントです。');await second.locator('#quickSaveUserNameBtn').click();await sleep(1600);const u=await second.evaluate(()=>localStorage.getItem('fujiya_collection_user_id')||'');report.ids.participantUserId=u;return {userId:u}});
 await step(second,'別ユーザー_みてレコ参加と記録投稿',async()=>{
   await recoNav(second);await second.locator('[data-mitereco-refresh]').click().catch(()=>{});await sleep(3000);await second.locator('#miteRecoCompetitionSearch').fill(COMP);await sleep(900);const row=second.locator('.mitereco-browser-card').filter({hasText:COMP}).first();if(!await row.count())throw new Error('別ユーザーから競技が見つからない');await row.locator('[data-mitereco-quick-join]').click();await sleep(900);await second.locator('#miteRecoRecordValue').fill('1:20.00');await second.locator('#miteRecoRecordForm button[type="submit"]').click();await second.waitForFunction(()=>document.body.innerText.includes('記録を投稿しました')||document.body.innerText.includes('自己ベスト'),undefined,{timeout:90000});await sleep(2500);return {posted:true};
 });
 await step(second,'別ユーザー_みてマガ閲覧と投票',async()=>{
   await magazineNav(second);await second.locator('[data-mag-refresh]').click().catch(()=>{});await sleep(3500);await second.locator('#miteMagazineSearch').fill(ARTICLE);await sleep(700);const card=second.locator('.mitemaga-card').filter({hasText:ARTICLE}).first();if(!await card.count())throw new Error('別ユーザーから記事が見つからない');await card.locator('[data-mag-read]').first().click();await sleep(2500);const option=second.locator('[data-mag-vote]').filter({hasText:'正常'}).first();if(!await option.count())throw new Error('アンケートの正常選択肢がない');await option.click();await second.waitForFunction(()=>document.querySelector('.mitemaga-poll-foot')?.innerText.includes('投票済み'),undefined,{timeout:60000});return {voted:true,text:await second.locator('.mitemaga-poll').innerText()};
 });
 // Primary refresh: community result/ranking
 await step(pc,'作成者_みてレコランキング別ユーザー反映',async()=>{await pc.keyboard.press('Escape').catch(()=>{});await recoNav(pc);await pc.locator('[data-mitereco-refresh]').click().catch(()=>{});await sleep(3500);await pc.locator('#miteRecoCompetitionSearch').fill(COMP);await sleep(700);const row=pc.locator('.mitereco-browser-card').filter({hasText:COMP}).first();await row.locator('[data-mitereco-open-competition-detail]').click();await sleep(2200);const body=await pc.locator('#miteRecoCompetitionDetailModal').innerText();if(!body.includes(PARTICIPANT))throw new Error('ランキングに参加者が表示されない');return {participantVisible:true,body:body.slice(0,1600)}});
 await step(pc,'作成者_みてマガ投票結果反映',async()=>{await pc.keyboard.press('Escape').catch(()=>{});await magazineNav(pc);await pc.locator('[data-mag-refresh]').click().catch(()=>{});await sleep(3500);await pc.locator('#miteMagazineSearch').fill(ARTICLE);await sleep(600);const card=pc.locator('.mitemaga-card').filter({hasText:ARTICLE}).first();await card.locator('[data-mag-read]').first().click();await sleep(2200);const body=await pc.locator('.mitemaga-poll').innerText();if(!/1票|合計 1票/.test(body))throw new Error('別ユーザーの投票数が反映されない '+body);return {body}});
 await step(pc,'その他_データ同期設定ショーケース導線',async()=>{
   await pc.keyboard.press('Escape').catch(()=>{});await dismiss(pc);const more=pc.locator('[data-desktop-more]:visible').first();await more.click();await sleep(300);const out={};for(const tab of ['data','sync','manage']){const btn=pc.locator(`[data-desktop-tab="${tab}"]:visible`);if(!await btn.count()){out[tab]='missing';continue}await btn.click();await sleep(600);out[tab]=(await pc.locator('body').innerText()).slice(-1000);await more.click().catch(()=>{});await sleep(250)}return out;
 });
 // mobile production navigation and public content
 const mctx=await context(browser,'ChatGPTスマホ検証0814',true);const mobile=await openApp(mctx,'mobile');
 await step(mobile,'スマホ_主要タブ遷移',async()=>{const out={};for(const t of ['home','register','list','dex']){const b=mobile.locator(`[data-mobile-tab="${t}"]:visible`).first();if(!await b.count()){out[t]='missing';continue}await b.click();await sleep(600);out[t]=document.body?.dataset?.activeTab||await mobile.evaluate(()=>document.body.dataset.activeTab||'')}return out});
 await step(mobile,'スマホ_その他メニューとみてレコみてマガ',async()=>{
   const more=mobile.locator('[data-mobile-more]:visible,[data-mobile-tab="more"]:visible').first();if(await more.count())await more.click();else await mobile.getByRole('button',{name:/その他/}).last().click();await sleep(500);const text=await mobile.locator('body').innerText();const found={mitereco:text.includes('みてレコ'),magazine:text.includes('みてマガ'),buyback:text.includes('リスト')||text.includes('買取')};
   const reco=mobile.getByText('みてレコ',{exact:false}).filter({visible:true}).last();if(await reco.count()){await reco.click().catch(()=>{});await sleep(700)}return found;
 });
 await step(mobile,'スマホ_公開競技検索',async()=>{if(!await mobile.locator('#miteRecoCompetitionSearch').count()){if(typeof await mobile.evaluate(()=>typeof window.miteRecoOpenTab)==='string'){};await mobile.evaluate(()=>window.miteRecoOpenTab?.());await sleep(1000)}const q=mobile.locator('#miteRecoCompetitionSearch');if(!await q.count())throw new Error('スマホみてレコ検索欄なし');await q.fill(COMP);await sleep(700);return {found:(await mobile.locator('body').innerText()).includes(COMP)}});
 // collect persistent state summaries
 report.state=await pc.evaluate(()=>{let root={};try{root=JSON.parse(localStorage.getItem('fujiya_collection_v1')||'{}')}catch{};const ls={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/buyback|shelf|profile|device.*sync|magazine|mitereco/.test(k))ls[k]=String(localStorage.getItem(k)||'').slice(0,4000)}return {userId:localStorage.getItem('fujiya_collection_user_id'),entries:(root.entries||[]).map(e=>({id:e.id,title:e.title,platform:e.platform,owned:e.owned,memo:e.memo,updatedAt:e.updatedAt})),showcase:window.__MITEKORE_SHOWCASE_API__?.getProfileItems?.()||[],local:ls}});
 report.finishedAt=new Date().toISOString();fs.writeFileSync('functional-audit-result.json',JSON.stringify(report,null,2));console.log('AUDIT_SUMMARY '+JSON.stringify({version:report.version,passed:report.steps.filter(x=>x.ok).length,failed:report.steps.filter(x=>!x.ok).length,failedNames:report.steps.filter(x=>!x.ok).map(x=>x.name),ids:report.ids,observations:report.observations.slice(-30)}));await browser.close();
})().catch(e=>{report.fatal=String(e&&e.stack||e);fs.writeFileSync('functional-audit-result.json',JSON.stringify(report,null,2));console.error('AUDIT_FATAL',e);process.exit(1)});
