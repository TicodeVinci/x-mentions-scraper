import { config } from 'dotenv';
import puppeteer, { Page, Browser } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { markTweetAsReplied } from './get-xmentions';

config();

async function cleanupOldTweetFiles(): Promise<void> {
    const tweetsFiles = fs.readdirSync(__dirname)
        .filter(file => file.startsWith('tweets-') && file.endsWith('.json'))
        .sort()
        .reverse();

    // Keep the most recent file, delete the rest
    if (tweetsFiles.length > 1) {
        console.log('Cleaning up old tweet files...');
        for (let i = 1; i < tweetsFiles.length; i++) {
            const filePath = path.join(__dirname, tweetsFiles[i]);
            fs.unlinkSync(filePath);
            console.log(`Deleted: ${tweetsFiles[i]}`);
        }
    }
}

async function replyToTweet(tweetUrl: string, replyText: string = "Let's goo"): Promise<void> {
    const browser: Browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    try {
        const page: Page = await browser.newPage();
        const cookiesPath: string = path.join(__dirname, 'twitter-cookies.json');

        // Load cookies if they exist
        if (fs.existsSync(cookiesPath)) {
            const cookiesJson = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
            await page.setCookie(...cookiesJson);
        } else {
            throw new Error('No cookies found. Please run get-xmentions first to authenticate.');
        }

        // Navigate to tweet (reduced timeout)
        await page.goto(tweetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Wait for the contenteditable div (reduced timeout)
        await page.waitForSelector('[data-testid="tweetTextarea_0"]', {
            visible: true,
            timeout: 10000
        });

        // Reduced initial delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Click and focus on the contenteditable div
        await page.evaluate(() => {
            const editor = document.querySelector('[data-testid="tweetTextarea_0"]');
            if (editor) {
                (editor as HTMLElement).click();
                (editor as HTMLElement).focus();
            }
        });

        // Reduced second delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Type the reply text (reduced typing delay)
        await page.keyboard.type(replyText, { delay: 30 });

        // Click the reply button to submit
        await page.waitForSelector('[data-testid="tweetButtonInline"]');
        await page.click('[data-testid="tweetButtonInline"]');

        // Wait for the reply to be posted
        await page.waitForFunction(() => {
            const replyButton = document.querySelector('[data-testid="tweetButtonInline"]');
            return !replyButton || (replyButton as HTMLButtonElement).disabled;
        }, { timeout: 5000 });

        // Extract tweet ID from URL
        const tweetId = tweetUrl.split('/').pop() || '';
        await markTweetAsReplied(tweetId);

        console.log(`Successfully replied to tweet: ${tweetUrl}`);

    } catch (error) {
        console.error('Error replying to tweet:', error instanceof Error ? error.message : String(error));
        throw error;
    } finally {
        await browser.close();
    }
}

async function processNewTweets(): Promise<void> {
    try {
        // Reduced wait time for tweet search completion
        console.log('Waiting for tweet search to complete...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Clean up old tweet files first
        await cleanupOldTweetFiles();

        // Get the most recent tweets file
        const tweetsFiles = fs.readdirSync(__dirname)
            .filter(file => file.startsWith('tweets-') && file.endsWith('.json'))
            .sort()
            .reverse();

        if (tweetsFiles.length === 0) {
            console.log('No tweet files found');
            return;
        }

        const latestTweetsFile = tweetsFiles[0];
        const tweetsPath = path.join(__dirname, latestTweetsFile);
        const tweets = JSON.parse(fs.readFileSync(tweetsPath, 'utf-8'));

        // Get replied tweets
        const repliedTweetsPath = path.join(__dirname, 'replied-tweets.json');
        const repliedTweets = JSON.parse(fs.readFileSync(repliedTweetsPath, 'utf-8'));

        // Process each tweet that hasn't been replied to
        for (const tweet of tweets) {
            if (!repliedTweets.repliedIds.includes(tweet.tweetId)) {
                console.log(`Processing tweet: ${tweet.tweetUrl}`);
                await replyToTweet(tweet.tweetUrl);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Reduced wait time between replies
            }
        }

    } catch (error) {
        console.error('Error processing tweets:', error instanceof Error ? error.message : String(error));
    }
}

// Modify the execution to be more robust
async function main(): Promise<void> {
    try {
        // Start the tweet search process
        const searchProcess = import('./get-xmentions').then(module => module.main());
        
        // Wait a moment and then process new tweets
        await processNewTweets();
        
        // Keep the script running
        console.log('Waiting for all processes to complete...');
        await searchProcess;
    } catch (error) {
        console.error('Error in main process:', error instanceof Error ? error.message : String(error));
    }
}

// Run the main function instead of processNewTweets directly
main(); 