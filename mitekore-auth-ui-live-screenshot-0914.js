const { chromium } = require('playwright');
const fs = require('fs');

const TARGET = 'https://hilarious-haupia-6e0406.netlify.app/';
const SCREENSHOT = 'mitekore-auth-ui-live-screenshot-0914.png';
const MAIL_API = 'https://api.mail.tm';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function json(url, options={}) {
  const r = await fetch(url, options);
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${text.slice(0,400)}`);
  return text ? JSON.parse(text) : {};
}

async function makeMailbox() {
  const domains = await json(`${MAIL_API}/domains?page=1`);
  const domain = domains?.['hydra:member']?.find(x => x?.domain)?.domain;
  if (!domain) throw new Error('mail.tm domain unavailable');
  const address = `mitekore-e2e-${Date.now()}-${Math.random().toString(36).slice(2,8)}@${domain}`;
  const password = `Mtk!${Date.now()}aB9#${Math.random().toString(36).slice(2,10)}`;
  await json(`${MAIL_API}/accounts`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({address,password}) });
  const token = await json(`${MAIL_API}/token`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({address,password}) });
  if (!token?.token) throw new Error('mail.tm token unavailable');
  return { address, password, token: token.token };
}

async function waitForCode(mailbox, timeoutMs=120000) {
  const deadline = Date.now() + timeoutMs;
  let lastSubjects = [];
  while (Date.now() < deadline) {
    const list = await json(`${MAIL_API}/messages?page=1`, { headers:{authorization:`Bearer ${mailbox.token}`} });
    const messages = list?.['hydra:member'] || [];
    lastSubjects = messages.map(m => m.subject).filter(Boolean);
    for (const m of messages) {
      const full = await json(`${MAIL_API}/messages/${m.id}`, { headers:{authorization:`Bearer ${mailbox.token}`} });
      const raw = [full.subject, full.text, ...(Array.isArray(full.html)?full.html:[full.html])].filter(Boolean).join('\n');
      const match = raw.match(/(?:確認コード|認証コード|verification code)[^0-9]{0,80}([0-9]{6})/i) || raw.match(/\b([0-9]{6})\b/);
      if (match) return { code: match[1], subject: full.subject || m.subject || '', messageId: m.id };
    }
    await sleep(2500);
  }
  throw new Error(`verification email not received in time; subjects=${JSON.stringify(lastSubjects)}`);
}

(async () => {
  const out = { target: TARGET, startedAt: new Date().toISOString(), gasPosts: [], gasStatusRequests: [], consoleErrors: [], pageErrors: [], passed: false };
  let browser;
  try {
    const mailbox = await makeMailbox();
    out.testMailboxDomain = mailbox.address.split('@')[1];
    out.mailboxCreated = true;

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'ja-JP' });
    const page = await context.newPage();

    page.on('console', m => { if (m.type() === 'error') out.consoleErrors.push(m.text()); });
    page.on('pageerror', e => out.pageErrors.push(String(e?.message || e)));
    page.on('request', req => {
      const url = req.url();
      if (!url.includes('script.google.com')) return;
      if (req.method() === 'POST') {
        const p = new URLSearchParams(req.postData() || '');
        out.gasPosts.push({ method: 'POST', action: p.get('action') || '' });
      } else if (url.includes('cloud_backup_auth_status')) {
        out.gasStatusRequests.push({ method: req.method() });
      }
    });

    const r = await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 60000 });
    out.pageLoaded = !!r && r.ok();
    await page.waitForFunction(() => !!document.getElementById('ufsChoiceFirst14759') && !!document.getElementById('ufsSendCode14675'), null, { timeout: 60000 });
    out.uiReady = true;

    await page.waitForFunction(() => {
      const el = document.getElementById('fujiyaLegalGate14750');
      return !!el && el.classList.contains('show') && el.getAttribute('aria-hidden') === 'false';
    }, null, { timeout: 8000 });
    await page.check('#fujiyaLegalAgree14750');
    await page.click('#fujiyaLegalAccept14750');
    await page.waitForFunction(() => {
      const el = document.getElementById('fujiyaLegalGate14750');
      return !el || !el.classList.contains('show') || el.getAttribute('aria-hidden') === 'true';
    }, null, { timeout: 10000 });
    out.legalAcceptedByUi = true;

    await page.click('#ufsChoiceFirst14759');
    await page.waitForFunction(() => document.querySelector('[data-ufs-step="1"]')?.classList.contains('active'), null, { timeout: 10000 });
    out.firstUseSelectedByUi = true;

    await page.click('#ufsStartNormal14728');
    await page.waitForFunction(() => document.querySelector('[data-ufs-step="2"]')?.classList.contains('active'), null, { timeout: 10000 });
    out.normalPlanSelectedByUi = true;

    await page.fill('#ufsEmail14675', mailbox.address);
    const sendStarted = Date.now();
    await page.click('#ufsSendCode14675');
    await page.waitForFunction(() => {
      const area = document.getElementById('ufsCodeArea14675');
      const status = String(document.getElementById('ufsAccountStatus14675')?.textContent || '');
      return area && !area.hidden && /確認コード|確認メール/.test(status);
    }, null, { timeout: 45000 });
    out.sendUiAdvanced = true;
    out.sendElapsedMs = Date.now() - sendStarted;

    const mail = await waitForCode(mailbox, 120000);
    out.mailReceived = true;
    out.mailSubject = mail.subject;
    out.codeExtracted = true;

    await page.fill('#ufsCode14675', mail.code);
    const verifyStarted = Date.now();
    await page.click('#ufsVerifyCode14675');

    await page.waitForFunction(() => {
      const step3 = document.querySelector('[data-ufs-step="3"]')?.classList.contains('active');
      const phrase = String(document.getElementById('ufsPhrase14675')?.textContent || '').replace(/\s/g,'');
      const status = String(document.getElementById('ufsPhraseStatus14675')?.textContent || '');
      return step3 && phrase.length >= 16 && /メール確認とアカウント登録が完了|完全クラウドバックアップ・端末同期の準備がすべて完了/.test(status);
    }, null, { timeout: 90000 });

    out.verifyElapsedMs = Date.now() - verifyStarted;
    out.successStepVisible = true;
    out.phraseIssued = await page.$eval('#ufsPhrase14675', e => String(e.textContent || '').replace(/\s/g,'').length >= 16);
    out.successStatus = await page.$eval('#ufsPhraseStatus14675', e => String(e.textContent || '').trim());
    out.verifyPostCount = out.gasPosts.filter(x => x.action === 'cloud_backup_setup_verify_frame').length;
    out.sendPostCount = out.gasPosts.filter(x => x.action === 'cloud_backup_setup_send_code_frame').length;
    out.statusPollCount = out.gasStatusRequests.length;
    out.passed = out.pageLoaded && out.uiReady && out.legalAcceptedByUi && out.firstUseSelectedByUi && out.normalPlanSelectedByUi && out.sendUiAdvanced && out.mailReceived && out.codeExtracted && out.successStepVisible && out.phraseIssued;
    out.pageTitle = await page.title();
    await page.screenshot({ path: SCREENSHOT, fullPage: true });
  } catch (e) {
    out.fatalError = String(e?.stack || e);
    try {
      if (browser) {
        const contexts = browser.contexts();
        const pages = contexts.flatMap(c => c.pages());
        if (pages[0]) await pages[0].screenshot({ path: SCREENSHOT, fullPage: true });
      }
    } catch (_) {}
  } finally {
    out.finishedAt = new Date().toISOString();
    fs.writeFileSync('mitekore-auth-ui-live-screenshot-0914-result.json', JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    if (browser) await browser.close();
  }

  if (!out.passed) process.exit(1);
})();
