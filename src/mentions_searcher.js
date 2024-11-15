require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function loginToTwitter() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    try {
        const page = await browser.newPage();
        
        // First check if we have saved cookies
        const cookiesPath = path.join(__dirname, 'twitter-cookies.json');
        
        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath));
            await page.setCookie(...cookies);
            await performSearch(page);
        } else {
            console.log('No cookies found, performing fresh login...');
            await performLogin(page);
            const cookies = await page.cookies();
            fs.writeFileSync(cookiesPath, JSON.stringify(cookies));
            await performSearch(page);
        }

    } catch (error) {
        console.error('An error occurred:', error.message);
        await browser.close();
    }
}

async function performLogin(page) {
    await page.goto('https://x.com/i/flow/login', {
        waitUntil: 'networkidle0'
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Wait for the input field and type email
    await page.waitForSelector('input[autocomplete="username"][name="text"]', { visible: true });
    await page.type('input[autocomplete="username"][name="text"]', process.env.TWITTER_USERNAME, { delay: 30 });

    // Click the Next button using page evaluation
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('div[class*="css-146c3p1"]'));
        const nextButton = buttons.find(button => button.textContent.includes('Next'));
        if (nextButton) nextButton.click();
    });

    // Wait for password field
    await page.waitForSelector('input[name="password"]', { visible: true });
    await page.type('input[name="password"]', process.env.TWITTER_PASSWORD, { delay: 30 });

    // Click login button using the same approach as Next button
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('div[class*="css-146c3p1"]'));
        const loginButton = buttons.find(button => button.textContent.includes('Log in'));
        if (loginButton) loginButton.click();
    });

    // Wait longer to see what happens after login
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Successfully logged in!');

    // Handle cookie acceptance
    try {
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('div[class*="css-146c3p1"]'));
            const acceptCookiesButton = buttons.find(button => 
                button.textContent.includes('Accept all cookies')
            );
            if (acceptCookiesButton) {
                acceptCookiesButton.click();
                console.log('Accepted cookies');
            }
        });
        
        // Wait for the cookie banner to disappear
        await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
        console.log('No cookie banner found or already accepted');
    }
}

async function performSearch(page) {
    await page.goto('https://x.com/search-advanced', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    await page.waitForSelector('#layers');
    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.evaluate(() => {
        const container = document.querySelector('#layers > div:nth-child(2) > div > div > div > div > div > div:nth-child(2) > div:nth-child(2) > div > div > div');
        if (container) {
            container.scrollTo(0, 400);
        }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        // Wait for the specific section and then find the input within it
        const mentioningSection = await page.waitForSelector(
            '#layers > div:nth-child(2) > div > div > div > div > div > div:nth-child(2) > div:nth-child(2) > div > div > div > div:nth-child(2) > div > div:nth-child(5) > div:nth-child(3) > div'
        );

        // Find the input field within this section
        const mentioningInput = await page.evaluateHandle(section => {
            const input = section.querySelector('input');
            if (!input) {
                throw new Error('Input field not found within section');
            }
            return input;
        }, mentioningSection);

        if (mentioningInput) {
            await mentioningInput.click();
            await page.keyboard.type('@TicodeVinci', { delay: 30 });
            console.log('Successfully entered username in mentioning field');

            await new Promise(resolve => setTimeout(resolve, 2000));

            // Scroll and wait longer
            await page.evaluate(() => {
                const container = document.querySelector('#layers > div:nth-child(2) > div > div > div > div > div > div:nth-child(2) > div:nth-child(2) > div > div > div');
                if (container) {
                    container.scrollTo(0, 2000);
                    return true;
                }
                return false;
            });

            await new Promise(resolve => setTimeout(resolve, 2000));

            // Get current date
            const today = new Date();
            const month = (today.getMonth() + 1).toString();
            const day = today.getDate().toString();
            const year = today.getFullYear().toString();

            console.log('Attempting to set dates:', { month, day, year });

            // Simplified date setting without storing unused result
            await page.evaluate(async (month, day, year) => {
                // Function to find select by label text
                function findSelectByLabel(labelText) {
                    const labels = Array.from(document.querySelectorAll('label'));
                    const label = labels.find(l => l.textContent.trim() === labelText);
                    if (label) {
                        const labelId = label.id;
                        return document.querySelector(`select[aria-labelledby="${labelId}"]`);
                    }
                    return null;
                }

                // Set Month
                const fromMonth = findSelectByLabel('Month');
                if (fromMonth) {
                    fromMonth.value = month;
                    fromMonth.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Set Day
                const fromDay = findSelectByLabel('Day');
                if (fromDay) {
                    fromDay.value = day;
                    fromDay.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Set Year
                const fromYear = findSelectByLabel('Year');
                if (fromYear) {
                    fromYear.value = year;
                    fromYear.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, month, day, year);

            // Wait before proceeding
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Click the search button
            await page.evaluate(() => {
                const searchButton = document.querySelector('#layers > div:nth-child(2) > div > div > div > div > div > div:nth-child(2) > div:nth-child(2) > div > div > div > div:nth-child(1) > div > div > div > div > div > div:nth-child(3) > button');
                if (searchButton) {
                    searchButton.click();
                    console.log('Search button clicked');
                } else {
                    throw new Error('Search button not found');
                }
            });
            console.log('Successfully clicked search button');

            // Add wait for search results to load
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Start scraping tweets
            await scrapeTweets(page);
        }
    } catch (error) {
        console.error('Error in date selection:', error.message);
    }
}

async function scrapeTweets(page) {
    console.log('Starting to scrape tweets...');
    
    const tweets = await page.evaluate(() => {
        const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
        return Array.from(tweetElements).map(tweet => {
            // Get user information
            const userElement = tweet.querySelector('[data-testid="User-Name"]');
            const username = userElement ? userElement.textContent : 'Unknown';
            
            // Get tweet text
            const tweetTextElement = tweet.querySelector('[data-testid="tweetText"]');
            const tweetText = tweetTextElement ? tweetTextElement.textContent : '';
            
            // Get timestamp and URL
            const timeElement = tweet.querySelector('time').closest('a');
            const timestamp = timeElement ? timeElement.querySelector('time').getAttribute('datetime') : '';
            const tweetUrl = timeElement ? timeElement.href : '';
            // Extract tweet ID from URL
            const tweetId = tweetUrl.split('/').pop();
            
            // Get metrics
            const metrics = {
                replies: tweet.querySelector('[data-testid="reply"]')?.textContent || '0',
                retweets: tweet.querySelector('[data-testid="retweet"]')?.textContent || '0',
                likes: tweet.querySelector('[data-testid="like"]')?.textContent || '0'
            };
            
            return {
                username,
                tweetText,
                timestamp,
                tweetUrl,
                tweetId,
                metrics
            };
        });
    });
    
    // Save tweets to a JSON file
    const outputPath = path.join(__dirname, 'tweets.json');
    fs.writeFileSync(outputPath, JSON.stringify(tweets, null, 2));
    
    console.log(`Scraped ${tweets.length} tweets and saved to ${outputPath}`);
    
    return tweets;
}

// Example usage
async function main() {
    try {
        await loginToTwitter();
    } catch (error) {
        console.error('Failed to login:', error);
    }
}

main(); 