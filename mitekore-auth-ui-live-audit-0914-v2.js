const { chromium } = require('playwright');
const fs = require('fs');

const TARGET = 'https://hilarious-haupia-6e0406.netlify.app/';
const BAD_TIMEOUT = '本人確認要求をGASで受付確認できませんでした';

(async () => {
  const out = { target: TARGET, startedAt: new Date().toISOString(), gasPosts: [], gasStatusRequests: [], consoleErrors: [], pageErrors: [], passed: false };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ja-JP' });
  const page = await context.newPage();

  page.on('console', m => { if (m.type() === 'error') out.consoleErrors.push(m.text()); });
  page.on('pageerror', e => out.pageErrors.push(String(e?.message || e)));
  page.on('request', req => {
    const url = req.url();
    if (!url.includes('script.google.com')) return;
    if (req.method() === 'POST') {
      const p = new URLSearchParams(req.postData() || '');
      out.gasPosts.push({ method: 'POST', action: p.get('action') || '', url: url.replace(/([?&](?:email|code|userId|requestId)=)[^&]*/g, '$1***') });
    } else if (url.includes('cloud_backup_auth_status')) {
      out.gasStatusRequests.push({ method: req.method(), url: url.replace(/([?&](?:email|code|userId|requestId)=)[^&]*/g, '$1***') });
    }
  });

  try {
    const r = await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 60000 });
    out.pageLoaded = !!r && r.ok();
    await page.waitForFunction(() => !!window.fujiyaPremiumCloudBackup?.onboardingVerifyCode && !!document.getElementById('ufsVerifyCode14675'), null, { timeout: 60000 });
    out.uiReady = true;

    const email = `mitekore-github-ui-${Date.now()}@example.com`;
    await page.evaluate(({ email }) => {
      try { window.fujiyaStartNormalVersion14728?.(); } catch (_) {}
      const mail = document.getElementById('ufsEmail14675');
      const area = document.getElementById('ufsCodeArea14675');
      const code = document.getElementById('ufsCode14675');
      if (mail) mail.value = email;
      if (area) area.hidden = false;
      if (code) code.value = '000000';
    }, { email });

    const started = Date.now();
    await page.evaluate(() => document.getElementById('ufsVerifyCode14675')?.click());

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
    out.passed = out.pageLoaded && out.uiReady && !out.timeoutMessage && /確認コードが無効|有効時間が切れています/.test(out.statusText) && out.verifyPostCount >= 1 && out.statusPollCount >= 1;
  } catch (e) {
    out.fatalError = String(e?.stack || e);
  } finally {
    out.finishedAt = new Date().toISOString();
    fs.writeFileSync('mitekore-auth-ui-live-audit-0914-v2-result.json', JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
  }

  if (!out.passed) process.exit(1);
})();
