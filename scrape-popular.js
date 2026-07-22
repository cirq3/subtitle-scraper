const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const LKSUBS_URL = 'https://www.lksubs.com';
const OUTPUT_FILE = path.join(__dirname, 'public', 'subtitles.json');

// Popular movies to scrape
const POPULAR_MOVIES = [
  'Avatar', 'Jawan', 'Leo', 'Pushpa', 'RRR', 'KGF',
  'Animal', 'Pathaan', 'Dunki', 'Rocky Rani',
  'Manjummel Boys', 'Premalu', 'Aavesham',
  'The Dark Knight', 'Inception', 'Interstellar',
  'Spider-Man', 'Batman', 'Avengers',
  'Frozen', 'Coco', 'Shrek',
  'Stranger Things', 'Breaking Bad', 'Game of Thrones',
];

async function searchAndGetSubtitles(query) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // Search
    await page.goto(`${LKSUBS_URL}/?s=${encodeURIComponent(query)}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Get first movie link
    const movieLink = await page.evaluate(() => {
      const link = document.querySelector('a[href*="/movies/"]');
      return link ? link.href : null;
    });

    if (!movieLink) return null;

    // Go to movie page
    await page.goto(movieLink, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000)); // Wait for AJAX to load download links

    // Extract ALL links with /links/ pattern
    const allLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href*="/links/"]').forEach(a => {
        links.push({ href: a.href, text: a.textContent?.trim() || '', parentText: a.parentElement?.textContent?.trim() || '' });
      });
      return links;
    });

    console.log(`  Found ${allLinks.length} link elements`);
    for (const l of allLinks) {
      console.log(`    Link: ${l.href} | Text: ${l.text} | Parent: ${l.parentText.substring(0, 80)}`);
    }

    // Find the subtitle link - look for any link where nearby text mentions "subtitle"
    let subtitleLink = null;
    for (const link of allLinks) {
      const combined = (link.text + ' ' + link.parentText).toLowerCase();
      if (combined.includes('subtitle')) {
        subtitleLink = link.href;
        break;
      }
    }

    // If no explicit subtitle link, try to find it in table rows
    if (!subtitleLink) {
      subtitleLink = await page.evaluate(() => {
        // Look through all table rows for "subtitle" text
        const rows = document.querySelectorAll('tr');
        for (const row of rows) {
          const text = row.textContent?.toLowerCase() || '';
          if (text.includes('subtitle')) {
            const link = row.querySelector('a[href*="/links/"]');
            if (link) return link.href;
          }
        }
        // Also check divs
        const divs = document.querySelectorAll('div');
        for (const div of divs) {
          const text = div.textContent?.toLowerCase() || '';
          if (text.includes('subtitle') && text.length < 200) {
            const link = div.querySelector('a[href*="/links/"]');
            if (link) return link.href;
          }
        }
        return null;
      });
    }

    if (!subtitleLink) {
      console.log(`  No subtitle link found in ${allLinks.length} links`);
      return null;
    }

    // Get download URL
    await page.goto(subtitleLink, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    const downloadUrl = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const link of links) {
        if (link.href && (link.href.includes('ddl') || link.href.includes('.srt') || link.href.includes('download'))) {
          return link.href;
        }
      }
      return null;
    });

    return {
      query,
      title: await page.title(),
      movieUrl: movieLink,
      subtitleLink,
      downloadUrl,
      scrapedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Error scraping ${query}:`, err.message);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('Starting popular movies scrape...');

  const results = [];

  for (const movie of POPULAR_MOVIES) {
    console.log(`\nScraping: ${movie}`);
    const result = await searchAndGetSubtitles(movie);
    if (result) {
      results.push(result);
      console.log(`  Found: ${result.downloadUrl ? 'Yes' : 'No'}`);
    } else {
      console.log(`  Not found`);
    }
  }

  // Save results
  const output = {
    lastUpdated: new Date().toISOString(),
    totalMovies: results.length,
    movies: results,
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log(`\nDone! Scraped ${results.length} movies`);
  console.log(`Results saved to ${OUTPUT_FILE}`);
}

main().catch(console.error);
