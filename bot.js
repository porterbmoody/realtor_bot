const csv = require('csv-parser');
const { stringify } = require('csv-stringify');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;

// git add .; git commit -m 'changes';git pull;git push;
class HouseBot {
    constructor() {
        this.url = 'https://www.redfin.com/city/6208/FL/Fort-Myers';
        this.keyField = 'property_url';
        this.sheetUrl = 'https://docs.google.com/spreadsheets/d/1Iz6G0vnUSogAjWMwnSJ1aJbNRr3VoqU3c-BaC1xSWVo/edit?fbclid=IwZXh0bgNhZW0CMTEAAR1Wu_u_d5yRlZbBKxJ2ndxb7AHpsEOxjqH0k7vRCs3F6vo1f5ZhLpAb0rs_aem_-jf0aobbjchuCTbOYFsOug&pli=1&gid=0#gid=0';
        this.spreadsheetId = this.sheetUrl.split('/d/')[1].split('/edit')[0];
        this.property_card_selector = '[class="bp-Homecard bp-InteractiveHomecard MapHomecardWrapper MapHomecardWrapper--selected MapHomecardWrapper--photosLoading bp-InteractiveHomecard--hideNumIndicator clickable"]';
        this.property_url_element_selector = '[class="link-and-anchor visuallyHidden"]';
        this.price_selector = '[data-rf-test-id="abp-price"]';
        this.tab_selector = '[class="TabBarItem__label"]';
        this.row_selector = '[class="tableRow"]';
        this.data = [];
        this.page = null;
        this.browser = null;
        this.filePath = 'data.csv';
    }

    async autoScroll() {
        await this.page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight - window.innerHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    }

    async updateData() {
        const fields = ['property_url', 'price', 'square_footage'];
        try {
            if (!this.data || this.data.length === 0) {
                console.log('No data to save. Skipping CSV write operation.');
                return;
            }
    
            const csv = stringify(this.data, {
                header: true,
                columns: fields
            });
    
            await fs.writeFile(this.filePath, csv);
            console.log('CSV file saved successfully.');
        } catch (error) {
            console.error('Error saving CSV file:', error);
            console.log('Data attempted to save:', this.data);
        }
    }
    async saveToJson() {
        try {
            fs.writeFileSync("data.json", JSON.stringify(this.data));
            console.log('Data saved to JSON file successfully.');
        } catch (error) {
            console.error('Error saving data to JSON file:', error);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async randomDelay(minSeconds = 2, maxSeconds = 5) {
        const delay = Math.random() * (maxSeconds - minSeconds) + minSeconds;
        return new Promise(resolve => setTimeout(resolve, delay * 1000));
    }

    async closeChrome() {
        return new Promise((resolve, reject) => {
            exec('taskkill /F /IM chrome.exe', (error, stdout, stderr) => {
                if (error) {
                    console.log('Error closing Chrome:', error);
                    resolve();
                } else {
                    console.log('Chrome has been closed.');
                    resolve();
                }
            });
        });
    }

    parseNumber(value) {
        return parseFloat(value.replace(/[^0-9.]/g, ''));
    }

    async runBot() {
        await this.launchBrowser();
        await this.collectData();
        // await this.authenticateGoogleSheets();
        // await this.uploadToGoogleSheets();
    }

    async launchBrowser() {
        this.browser = await puppeteer.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-notifications',
                '--disable-extensions',
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage'
            ]
        });
        this.page = await this.browser.newPage();
        console.log(`opening ${this.url}`);
        await this.page.goto(this.url, { waitUntil: 'networkidle2' });
    }

    async clickTableTab() {
        await page.evaluate(() => {
            const tab = document.querySelector('.TabBarItem__label[data-text="Table"]');
            
            // Check if the element exists and click it
            if (tab) {
                tab.click();
                console.log('Clicked on the tab with data-text="Table"');
            } else {
                console.error('No tab with data-text="Table" found.');
            }
        });
    }
    
    async collectData() {
        try {
            await this.page.waitForSelector('[class="homes summary"]', { timeout: 10000 });
            const totalHomes = await this.page.$eval('[class="homes summary"]', el => el.textContent);
            console.log(`Total homes listed in the area: ${totalHomes}`);
    
            await clickTableTab();
    
            console.log('sleep 120 secs');
            await this.sleep(120000);
    
            await this.page.waitForSelector(this.property_url_element_selector, { timeout: 10000 });
            const property_urls = await this.page.$$eval(this.property_url_element_selector, links => links.map(link => link.href));
            console.log(`Found ${property_urls.length} property URLs`);
    
            for (const property_url of property_urls) {
                try {
                    console.log(`Opening ${property_url}`);
                    await this.page.goto(property_url, { waitUntil: 'networkidle0', timeout: 30000 });
    
                    console.log('Getting price');
                    await this.page.waitForSelector(this.price_selector, { timeout: 10000 });
                    const price = await this.page.$eval(this.price_selector, el => {
                        const statsValueElement = el.querySelector('div.statsValue');
                        return statsValueElement ? statsValueElement.textContent.trim() : null;
                    });
    
                    let square_footage;
                    try {
                        await this.page.waitForSelector('[class="stat-block sqft-section"]', { timeout: 5000 });
                        square_footage = await this.page.$eval('[class="stat-block sqft-section"]', el => el.textContent.trim());
                    } catch (error) {
                        square_footage = "Couldn't find element";
                        console.log(`Error getting square footage: ${error.message}`);
                    }
    
                    console.log(`Price: ${price}`);
                    console.log(`Square Footage: ${square_footage}`);
    
                    this.data.push({ price, square_footage, property_url });
                    await this.updateData();
    
                    await this.randomDelay();
                } catch (error) {
                    console.error(`Error processing ${property_url}: ${error.message}`);
                }
            }
        } catch (error) {
            console.error(`An error occurred in collectData: ${error.message}`);
        } finally {
            await this.browser.close();
        }
    }
    

    async collectData() {
        try {
            await this.page.waitForSelector('[class="homes summary"]', { timeout: 10000 });
            const totalHomes = await this.page.$eval('[class="homes summary"]', el => el.textContent);
            console.log(`Total homes listed in the area: ${totalHomes}`);
            // Find and click the tab with text including "Table"
            await this.page.waitForSelector(this.tab_selector, { timeout: 10000 });
            const tabs = await this.page.$$(this.tab_selector);
            let tableTabFound = false;
            for (let tab of tabs) {
                const tabText = await this.page.evaluate(el => el.textContent, tab);
                if (tabText.includes('Table')) {
                    console.log(`Found tab with "Table": ${tabText}`);
                    await tab.click();
                    tableTabFound = true;
                    break;
                }
            }
            if (!tableTabFound) {
                console.error('No tab with "Table" found.');
                return;
            }
    
            console.log('sleep 120 secs')
            await this.sleep(120000);
    
            await this.page.waitForSelector(this.property_url_element_selector, { timeout: 10000 });
            const property_urls = await this.page.$$eval(this.property_url_element_selector, links => links.map(link => link.href));
            console.log(`Found ${property_urls.length} property URLs`);
    
            for (const property_url of property_urls) {
                try {
                    console.log(`Opening ${property_url}`);
                    await this.page.goto(property_url, { waitUntil: 'networkidle0', timeout: 30000 });
                    
                    console.log('Getting price');
                    await this.page.waitForSelector(this.price_selector, { timeout: 10000 });
                    const price = await this.page.$eval(this.price_selector, el => {
                        const statsValueElement = el.querySelector('div.statsValue');
                        return statsValueElement ? statsValueElement.textContent.trim() : null;
                    });
                    let square_footage;
                    try {
                        await this.page.waitForSelector('[class="stat-block sqft-section"]', { timeout: 5000 });
                        square_footage = await this.page.$eval('[class="stat-block sqft-section"]', el => el.textContent.trim());
                    } catch (error) {
                        square_footage = "Couldn't find element";
                        console.log(`Error getting square footage: ${error.message}`);
                    }
    
                    console.log(`Price: ${price}`);
                    console.log(`Square Footage: ${square_footage}`);
    
                    this.data.push({ price, square_footage, property_url });
                    await this.updateData();
    
                    await this.randomDelay();
                } catch (error) {
                    console.error(`Error processing ${property_url}: ${error.message}`);
                }
            }
        } catch (error) {
            console.error(`An error occurred in collectData: ${error.message}`);
        } finally {
            await this.browser.close();
        }
    }

    }
(async () => {
    const bot = new HouseBot();
    await bot.runBot();
})();
