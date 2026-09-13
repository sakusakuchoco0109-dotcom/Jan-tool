const { chromium } = require('playwright');
const fs = require('fs');

const TARGET = 'https://hilarious-haupia-6e0406.netlify.app/';
const TIMEOUT_MESSAGE = '本人確認要求をGASで受付確認できませんでした';

(async () => {
  const result = {
    target: TARGET,
    startedAt: new Date().toISOString(),
    pageLoaded: false,
    apiReady: false,
    verifyReachedTerminal: false,
    timedOutMessage: false,
    elapsedMs: null,
    terminalMessage: '',
    gasPosts: [],
    gasStatusRequests: [],
    consoleErrors: [],
    pageErrors: [],
    passed: false
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'ja-JP'
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') result.consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => result.pageErrors.push(String(err && err.message || err)));
  page.on('request', req => {
    const url = req.url();
    if (!url.includes('script.google.com')) return;
    const method = req.method();
    const item = { method, url: url.replace(/([?&](?:email|code|userId|requestId)=)[^&]*/g, '$1***') };
    if (method === 'POST') {
      const data = req.postData() || '';
      item.action = (() => { try { return new URLSearchParams(data).get('action') || ''; } catch { return ''; } })();
      result.gasPosts.push(item);
    } else if (url.includes('cloud_backup_auth_status')) {
      result.gasStatusRequests.push(item);
    }
  });

  try {
    const response = await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 60000 });
    result.pageLoaded = !!response && response.ok();

    await page.waitForFunction(() => !!window.fujiyaPremiumCloudBackup?.onboardingVerifyCode, null, { timeout: 60000 });
    result.apiReady = true;

    const fakeEmail = `mitekore-github-e2e-${Date.now()}@example.com`;
    const started = Date.now();
    const terminal = await page.evaluate(async ({ fakeEmail }) => {
      try {
        const value = await Promise.race([
          window.fujiyaPremiumCloudBackup.onboardingVerifyCode(fakeEmail, '000000')
            .then(v => ({ kind: 'resolved', message: JSON.stringify(v || {}) })),
          new Promise(resolve => setTimeout(() => resolve({ kind: 'runner-timeout', message: '80秒以内に完了しませんでした' }), 80000))
        ]);
        return value;
      } catch (e) {
        return { kind: 'rejected', message: String(e?.message || e || ''), code: String(e?.code || '') };
      }
    }, { fakeEmail });
    result.elapsedMs = Date.now() - started;
    result.terminalMessage = terminal.message || '';
    result.terminalKind = terminal.kind;
    result.terminalCode = terminal.code || '';
    result.timedOutMessage = result.terminalMessage.includes(TIMEOUT_MESSAGE) || terminal.kind === 'runner-timeout';

    // Fake email + fake code must terminate as a normal GAS-side rejection, not stay pending until client timeout.
    result.verifyReachedTerminal = terminal.kind === 'rejected' && !result.timedOutMessage;

    const verifyPosts = result.gasPosts.filter(x => x.action === 'cloud_backup_setup_verify_frame');
    result.verifyPostCount = verifyPosts.length;
    result.statusPollCount = result.gasStatusRequests.length;
    result.passed = result.pageLoaded && result.apiReady && result.verifyReachedTerminal && result.verifyPostCount >= 1 && result.statusPollCount >= 1;
  } catch (e) {
    result.fatalError = String(e && e.stack || e);
  } finally {
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync('mitekore-auth-live-audit-0914-result.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
  }

  if (!result.passed) process.exit(1);
})();
