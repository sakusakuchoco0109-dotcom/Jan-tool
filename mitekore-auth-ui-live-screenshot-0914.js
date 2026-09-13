const { chromium } = require('playwright');
const fs = require('fs');

const TARGET = 'https://hilarious-haupia-6e0406.netlify.app/';
const BAD_TIMEOUT = '本人確認要求をGASで受付確認できませんでした';
const SCREENSHOT = 'mitekore-auth-ui-live-screenshot-0914.png';

(async () => {
  const out = { target: TARGET, startedAt: new Date().toISOString(), gasPosts: [], gasStatusRequests: [], consoleErrors: [], pageErrors: [], passed: false };
  const browser = await chromium.launch({ headless: true });
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

  try {
    const r = await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 60000 });
    out.pageLoaded = !!r && r.ok();
    await page.waitForFunction(() => !!window.fujiyaPremiumCloudBackup?.onboardingVerifyCode && !!document.getElementById('ufsVerifyCode14675'), null, { timeout: 60000 });
    out.uiReady = true;

    // Fresh browser: wait for the real legal gate to appear, then accept it with actual UI controls.
    try {
      await page.waitForFunction(() => {
        const el = document.getElementById('fujiyaLegalGate14750');
        return !!el && el.classList.contains('show') && el.getAttribute('aria-hidden') === 'false';
      }, null, { timeout: 5000 });
    } catch (_) {}

    const legalVisible = await page.evaluate(() => {
      const el = document.getElementById('fujiyaLegalGate14750');
      return !!el && el.classList.contains('show') && el.getAttribute('aria-hidden') === 'false';
    });
    if (legalVisible) {
      await page.check('#fujiyaLegalAgree14750');
      await page.click('#fujiyaLegalAccept14750');
      await page.waitForFunction(() => {
        const el = document.getElementById('fujiyaLegalGate14750');
        return !el || !el.classList.contains('show') || el.getAttribute('aria-hidden') === 'true';
      }, null, { timeout: 10000 });
      out.legalAcceptedByUi = true;
    } else {
      out.legalAcceptedByUi = false;
    }

    const email = `mitekore-github-ui-${Date.now()}@example.com`;
    await page.evaluate(({ email }) => {
      try { window.fujiyaStartNormalVersion14728?.(); } catch (_) {}
      const mail = document.getElementById('ufsEmail14675');
      const area = document.getElementById('ufsCodeArea14675');
      const code = document.getElementById('ufsCode14675');
      if (mail) mail.value = email;
      if (area) area.hidden = false;
      if (code) code.value = '000000';
      document.getElementById('ufsVerifyCode14675')?.scrollIntoView({ block: 'center' });
    }, { email });

    const started = Date.now();
    await page.click('#ufsVerifyCode14675');

    await page.waitForFunction(({ bad }) => {
      const t = String(document.getElementById('ufsAccountStatus14675')?.textContent || '').trim();
      if (!t) return false;
      if (t.includes('確認コードを確認しています')) return false;
      if (t.includes('確認・端末同期の準備を行っています')) return false;
      if (t.includes('処理中')) return false;
      return t.includes(bad) || /確認コードが無効|有効時間が切れています|本人確認に失敗|クラウドアカウント情報を発行できません/.test(t);
    }, { bad: BAD_TIMEOUT }, { timeout: 80000 });

    out.elapsedMs = Date.now() - started;
    out.statusText = await page.$eval('#ufsAccountStatus14675', e => String(e.textContent || '').trim());
    out.timeoutMessage = out.statusText.includes(BAD_TIMEOUT);
    out.verifyPostCount = out.gasPosts.filter(x => x.action === 'cloud_backup_setup_verify_frame').length;
    out.statusPollCount = out.gasStatusRequests.length;
    out.appVersion = await page.evaluate(() => window.MITEKORE_VERSION || window.__MITEKORE_VERSION__ || document.documentElement.getAttribute('data-version') || '');
    out.passed = out.pageLoaded && out.uiReady && !out.timeoutMessage && /確認コードが無効|有効時間が切れています/.test(out.statusText) && out.verifyPostCount >= 1 && out.statusPollCount >= 1;

    // Actual Chromium-rendered Netlify page after the real GAS response returns.
    await page.screenshot({ path: SCREENSHOT, fullPage: true });
  } catch (e) {
    out.fatalError = String(e?.stack || e);
    try { await page.screenshot({ path: SCREENSHOT, fullPage: true }); } catch (_) {}
  } finally {
    out.finishedAt = new Date().toISOString();
    fs.writeFileSync('mitekore-auth-ui-live-screenshot-0914-result.json', JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
  }

  if (!out.passed) process.exit(1);
})();
