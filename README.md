# Sinhala Subtitle Scraper

Automatically scrapes Sinhala subtitles from lksubs.com using GitHub Actions (free, unlimited).

## Setup

### 1. Create GitHub Repo
1. Go to github.com → New Repository
2. Name: `subtitle-scraper`
3. **Private** (recommended)
4. Upload all files from this folder

### 2. Enable GitHub Actions
1. Go to repo → Actions tab
2. Click "I understand my workflows, go ahead and enable them"
3. The scraper will run every 6 hours automatically

### 3. Manual Trigger
1. Go to Actions → "Scrape Sinhala Subtitles"
2. Click "Run workflow"
3. Enter a movie title (optional)
4. Click "Run workflow"

## How It Works

```
Every 6 hours:
  GitHub Actions runs scraper
    ↓
  Searches lksubs.com for popular movies
    ↓
  Gets subtitle download links
    ↓
  Saves results to subtitles.json
    ↓
  Your app reads this file for subtitle URLs
```

## Files

| File | Purpose |
|---|---|
| `scraper.js` | Core scraping logic |
| `scrape-popular.js` | Scrapes popular movies list |
| `.github/workflows/scrape.yml` | GitHub Actions workflow |
| `public/subtitles.json` | Output file with subtitle URLs |

## API Usage

Your Cloudflare Worker can read the scraped data:

```javascript
// Fetch the pre-scraped subtitle data
const res = await fetch('https://raw.githubusercontent.com/YOUR_USERNAME/subtitle-scraper/main/public/subtitles.json');
const data = await res.json();
```
