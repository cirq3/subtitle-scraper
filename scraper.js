const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const LKSUBS_URL = 'https://www.lksubs.com';
const OUTPUT_FILE = path.join(__dirname, 'subtitles.json');

async function searchLksubs(query) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // Search for the movie
    const searchUrl = `${LKSUBS_URL}/?s=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for search results
    await page.waitForSelector('a[href*="/movies/"]', { timeout: 10000 }).catch(() => null);

    // Extract movie links
    const movieLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href*="/movies/"]').forEach(a => {
        const href = a.href;
        if (href && !links.includes(href)) {
          links.push(href);
        }
      });
      return links.slice(0, 5);
    });

    return movieLinks;
  } finally {
    await browser.close();
  }
}

async function getMovieDetails(movieUrl) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    await page.goto(movieUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for download links to load (they're loaded via AJAX)
    await page.waitForSelector('a[href*="/links/"]', { timeout: 15000 }).catch(() => null);

    // Extract movie details and subtitle link
    const details = await page.evaluate(() => {
      const title = document.querySelector('h3')?.textContent?.trim() || '';

      // Find the subtitle download link
      let subtitleLink = null;
      document.querySelectorAll('a[href*="/links/"]').forEach(a => {
        const text = a.textContent?.toLowerCase() || '';
        const parent = a.parentElement?.textContent?.toLowerCase() || '';
        if (text.includes('subtitle') || parent.includes('subtitle')) {
          subtitleLink = a.href;
        }
      });

      // If no explicit subtitle link, find any link with subtitle in nearby text
      if (!subtitleLink) {
        document.querySelectorAll('tr, div').forEach(el => {
          const text = el.textContent?.toLowerCase() || '';
          if (text.includes('subtitle')) {
            const link = el.querySelector('a[href*="/links/"]');
            if (link) {
              subtitleLink = link.href;
            }
          }
        });
      }

      return { title, subtitleLink };
    });

    return details;
  } finally {
    await browser.close();
  }
}

async function getDownloadUrl(linkUrl) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // The /links/ page redirects to the actual download
    await page.goto(linkUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for redirect or download link
    await new Promise(r => setTimeout(r, 3000));

    // Check current URL (might have redirected)
    const currentUrl = page.url();

    // Extract download URL from the page
    const downloadUrl = await page.evaluate(() => {
      // Look for direct download links
      const links = document.querySelectorAll('a[href*=".srt"], a[href*=".zip"], a[href*="download"], a[href*="ddl"]');
      for (const link of links) {
        if (link.href) return link.href;
      }

      // Look for any prominent link
      const allLinks = document.querySelectorAll('a');
      for (const link of allLinks) {
        if (link.href && (link.href.includes('ddl') || link.href.includes('download') || link.href.includes('.srt'))) {
          return link.href;
        }
      }

      return null;
    });

    return downloadUrl || currentUrl;
  } finally {
    await browser.close();
  }
}

// Main scraper function
async function scrapeSubtitles(movieTitle) {
  console.log(`Searching for: ${movieTitle}`);

  // Step 1: Search lksubs.com
  const movieLinks = await searchLksubs(movieTitle);
  console.log(`Found ${movieLinks.length} results`);

  if (movieLinks.length === 0) {
    return { found: false, message: 'No results found' };
  }

  // Step 2: Get details from first result
  const details = await getMovieDetails(movieLinks[0]);
  console.log(`Movie: ${details.title}`);
  console.log(`Subtitle link: ${details.subtitleLink || 'Not found'}`);

  if (!details.subtitleLink) {
    return { found: false, message: 'No subtitle link found' };
  }

  // Step 3: Get actual download URL
  const downloadUrl = await getDownloadUrl(details.subtitleLink);
  console.log(`Download URL: ${downloadUrl}`);

  return {
    found: true,
    title: details.title,
    movieUrl: movieLinks[0],
    downloadUrl,
  };
}

// Export for use in other scripts
module.exports = { scrapeSubtitles, searchLksubs, getMovieDetails, getDownloadUrl };

// Run directly
if (require.main === module) {
  const movieTitle = process.argv[2] || 'Avatar';
  scrapeSubtitles(movieTitle)
    .then(result => {
      console.log('\nResult:', JSON.stringify(result, null, 2));
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}
