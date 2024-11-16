# X Mentions Scraper/Reply

An alternative to the overexpensive X API that uses Puppeteer to scrape and reply to mentions on X.com to build reply bots like Pikaso.

- 🤖 Automated Twitter login and session management
- 📊 Scrapes mentions including metrics (replies, retweets, likes)
- 🔄 Tracks replied tweets to avoid duplicates
- 💾 Local storage of scraped data posts

## Installation

1. Clone the repository:
```bash
git clone https://github.com/TicodeVinci/x-mentions-scraper.git
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   Create a `.env` file in the root directory with your Twitter credentials:
```env
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
```

## Usage

```bash
npm run dev
```


## Project Structure

```
├── src/
│   ├── get-xmentions.ts    # Main scraper logic
│   └── post-xreply.ts      # Reply posting functionality

```

## Data Storage

The application stores several types of data locally:
- `twitter-cookies.json`: Stores session cookies for authentication
- `tweets.json`: Contains scraped mentions data
- `replied-tweets.json`: Tracks which tweets have been replied to

## Disclaimer

This tool is for educational purposes only. Make sure to comply with Twitter's Terms of Service and rate limits when using this scraper.

