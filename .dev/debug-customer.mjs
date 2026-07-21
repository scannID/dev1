const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('CONSOLE', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
  page.on('requestfailed', (req) => console.log('REQFAIL', req.url(), req.failure()?.errorText));
  await page.goto('http://192.168.1.3:5173/b/test-biz?qr=abc', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const root = await page.\('#root', (el) => el.innerHTML.slice(0, 500));
  console.log('ROOT', JSON.stringify(root));
  await browser.close();
})().catch((e) => { console.error('SCRIPT', e); process.exit(1); });
