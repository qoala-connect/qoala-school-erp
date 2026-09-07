const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'admin@school.com');
  await page.type('input[type="password"]', 'Password@123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  await delay(2000);

  await page.goto('http://localhost:3000/dashboard/examination?tab=dashboard', { waitUntil: 'networkidle2' });
  await delay(2500);

  const artifactDir = 'C:\\Users\\91737\\.gemini\\antigravity\\brain\\a0c65139-e038-44cf-878d-39fc010b657b';
  const screenshotPath = path.join(artifactDir, 'dashboard_clean_balanced.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved to:', screenshotPath);
  await browser.close();
}

capture();
