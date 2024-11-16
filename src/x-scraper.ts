import { config } from 'dotenv';
import puppeteer, { Page, Browser, CookieParam } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

config();

// Interfaces
interface Tweet {
    username: string;
    tweetText: string;
    timestamp: string;
    tweetUrl: string;
    tweetId: string;
    metrics: {
        replies: string;
        retweets: string;
        likes: string;
    };
}

interface XCookie extends CookieParam {
    size?: number;
    priority?: 'Low' | 'Medium' | 'High';
    sameParty?: boolean;
}

// Functions
async function loginToX(): Promise<void> {
    const browser: Browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    try {
        const page: Page = await browser.newPage();
        const cookiesPath: string = path.join(__dirname, 'twitter-cookies.json');
        
        if (fs.existsSync(cookiesPath)) {
            const cookiesJson = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
            const cookies = cookiesJson as CookieParam[];
            await page.setCookie(...cookies);
            await performSearch(page);
        } else {
            console.log('No cookies found, performing fresh login...');
            await performLogin(page);
            const cookies = await page.cookies();
            fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            await performSearch(page);
        }

        console.log('Search completed. Browser will remain open.');
        await new Promise(() => {});

    } catch (error) {
        console.error('An error occurred:', error instanceof Error ? error.message : String(error));
        await browser.close();
    }
}

async function performLogin(page: Page): Promise<void> {
    if (!process.env.TWITTER_USERNAME || !process.env.TWITTER_PASSWORD) {
        throw new Error('Twitter credentials not found in environment variables');
    }

    await page.goto('https://x.com/i/flow/login', {
        waitUntil: 'networkidle0'
    });

    // Login form
    await page.waitForSelector('input[autocomplete="username"]');
    await page.type('input[autocomplete="username"]', process.env.TWITTER_USERNAME);
    await page.keyboard.press('Enter');

    // Password form
    await page.waitForSelector('input[name="password"]');
    await page.type('input[name="password"]', process.env.TWITTER_PASSWORD);
    await page.keyboard.press('Enter');

    // Wait for login to complete
    await page.waitForNavigation({ 
        waitUntil: 'networkidle0',
        timeout: 60000
    });
}

async function performSearch(page: Page): Promise<void> {
    console.log('Navigating to advanced search...');
    await page.goto('https://x.com/search-advanced', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    // Wait for the layers container and scroll
    await page.waitForSelector('#layers');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Scroll the container
    await page.evaluate(() => {
        const container = document.querySelector('#layers > div:nth-child(2) > div > div > div > div > div > div:nth-child(2) > div:nth-child(2) > div > div > div');
        if (container) {
            container.scrollTo(0, 400);
        }
    });

    try {
        // Wait for the mentioning section
        const mentioningSection = await page.waitForSelector(
            '#layers > div:nth-child(2) > div > div > div > div > div > div:nth-child(2) > div:nth-child(2) > div > div > div > div:nth-child(2) > div > div:nth-child(5) > div:nth-child(3) > div'
        );

        if (!mentioningSection) {
            throw new Error('Mentioning section not found');
        }

        // Find and interact with the input field
        const mentioningInput = await page.evaluateHandle((section): HTMLInputElement => {
            const input = section.querySelector('input');
            if (!input) {
                throw new Error('Input field not found within section');
            }
            return input as HTMLInputElement;
        }, mentioningSection);

        if (mentioningInput) {
            await mentioningInput.click();
            const searchQuery = '@TicodeVinci';
            await page.keyboard.type(searchQuery, { delay: 20 });

            // Scroll and wait
            await page.evaluate(() => {
                const container = document.querySelector('#layers > div:nth-child(2) > div > div > div > div > div > div:nth-child(2) > div:nth-child(2) > div > div > div');
                if (container) {
                    container.scrollTo(0, 2000);
                    return true;
                }
                return false;
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get current date
            const today = new Date();
            const month = (today.getMonth() + 1).toString();
            const day = today.getDate().toString();
            const year = today.getFullYear().toString();

            // Set the dates
            await page.evaluate((month: string, day: string, year: string) => {
                function findSelectByLabel(labelText: string): HTMLSelectElement | null {
                    const labels = Array.from(document.querySelectorAll('label'));
                    const label = labels.find(l => l.textContent?.trim() === labelText);
                    if (label) {
                        const labelId = label.id;
                        return document.querySelector(`select[aria-labelledby="${labelId}"]`) as HTMLSelectElement;
                    }
                    return null;
                }

                // Set Month, Day, Year
                ['Month', 'Day', 'Year'].forEach((label, index) => {
                    const select = findSelectByLabel(label);
                    if (select) {
                        select.value = [month, day, year][index];
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            }, month, day, year);

            await new Promise(resolve => setTimeout(resolve, 1000));

            // Click the search button
            await page.evaluate(() => {
                const searchButton = document.querySelector('#layers > div:nth-child(2) > div > div > div > div > div > div:nth-child(2) > div:nth-child(2) > div > div > div > div:nth-child(1) > div > div > div > div > div > div:nth-child(3) > button') as HTMLButtonElement;
                if (searchButton) {
                    searchButton.click();
                } else {
                    throw new Error('Search button not found');
                }
            });

            // Wait for tweets to load
            await page.waitForSelector('[data-testid="tweet"]', {
                visible: true,
                timeout: 10000
            });

            // Scrape and save tweets
            const tweets = await scrapeTweets(page);
            console.log(`Found ${tweets.length} tweets`);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputPath = path.join(__dirname, `tweets-${timestamp}.json`);
            fs.writeFileSync(outputPath, JSON.stringify(tweets, null, 2));
            console.log(`Tweets saved to ${outputPath}`);
        }
    } catch (error) {
        console.error('Error during search:', error instanceof Error ? error.message : String(error));
        throw error;
    }
}

async function scrapeTweets(page: Page): Promise<Tweet[]> {
    return await page.evaluate(() => {
        const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
        return Array.from(tweetElements).map(tweet => {
            const username = tweet.querySelector('[data-testid="User-Name"]')?.textContent || '';
            const tweetText = tweet.querySelector('[data-testid="tweetText"]')?.textContent || '';
            const tweetUrl = (tweet.querySelector('a[href*="/status/"]') as HTMLAnchorElement)?.href || '';
            const tweetId = tweetUrl.split('/').pop() || '';

            return {
                username,
                tweetText,
                timestamp: new Date().toISOString(), // You might want to extract actual timestamp
                tweetUrl,
                tweetId,
                metrics: {
                    replies: '0',
                    retweets: '0',
                    likes: '0'
                }
            };
        });
    });
}

async function main(): Promise<void> {
    try {
        await loginToX();
    } catch (error) {
        console.error('Failed to login:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

main(); 