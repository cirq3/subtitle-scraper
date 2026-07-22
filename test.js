const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('Testing lksubs.com search...');
  await page.goto('https://www.lksubs.com/?s=Avatar', { waitUntil: 'networkidle2', timeout: 30000 });
  
  const title = await page.title();
  console.log('Page title:', title);
  
  const links = await page.evaluate(() => {
    const found = [];
    document.querySelectorAll('a').forEach(a => {
      if (a.href.includes('/movies/')) found.push(a.href);
    });
    return found.slice(0, 5);
  });
  console.log('Movie links found:', links);
  
  // Check if Cloudflare challenge
  const content = await page.content();
  if (content.includes('challenge') || content.includes('captcha') || content.includes('Checking your browser')) {
    console.log('CLOUDFLARE PROTECTION DETECTED!');
  }
  
  await browser.close();
}

test().catch(console.error);
