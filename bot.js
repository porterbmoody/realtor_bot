const csv = require('csv-parser');
const { stringify } = require('csv-stringify');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const { createReadStream } = require('fs');

// git add .; git commit -m 'changes';git pull;git push;
class HouseBot {
    constructor() {
        this.url = 'https://www.redfin.com/city/6208/FL/Fort-Myers';
        this.keyField = 'property_url';
        this.sheetUrl = 'https://docs.google.com/spreadsheets/d/1Iz6G0vnUSogAjWMwnSJ1aJbNRr3VoqU3c-BaC1xSWVo/edit?fbclid=IwZXh0bgNhZW0CMTEAAR1Wu_u_d5yRlZbBKxJ2ndxb7AHpsEOxjqH0k7vRCs3F6vo1f5ZhLpAb0rs_aem_-jf0aobbjchuCTbOYFsOug&pli=1&gid=0#gid=0';
        this.spreadsheetId = this.sheetUrl.split('/d/')[1].split('/edit')[0];
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
        const fields = ['propertyUrl', 'price', 'squareFootage'];
    
        try {
            if (!this.data || this.data.length === 0) {
                console.log('No data to save. Skipping CSV write operation.');
                return;
            }
    
            // Convert JSON data to CSV
            const csv = stringify(this.data, {
                header: true,
                columns: fields
            });
    
            // Write the CSV to file
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
        await this.browser.close();
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
    }
    async collectData() {
        await this.page.goto(this.url);
        const totalHomes = await this.page.$eval('[class="homes summary"]', el => el.textContent);
        console.log(`Total homes listed in the area: ${totalHomes}`);
    
        const property_elements = await this.page.$$('[data-rf-test-name="mapHomeCard"]');
        // const number_of_properties_to_scrape = property_elements.length;
        const number_of_properties_to_scrape = 100;
        console.log(`Number of homes to scrape: ${number_of_properties_to_scrape}`);

        for (let i = 0; i < Math.min(number_of_properties_to_scrape, property_elements.length); i++) {
            console.log(i);
            await this.page.goto(this.url);
            await this.page.waitForSelector('[data-rf-test-name="mapHomeCard"]');
            
            const property_elements = await this.page.$$('[data-rf-test-name="mapHomeCard"]');
            const property_element = property_elements[i];
    
            const propertyUrl = await property_element.$eval('a', a => a.href);
            const price = await property_element.$eval('[class="bp-Homecard__Price--value"]', el => el.textContent);
            console.log(`Opening ${propertyUrl}`);
            await this.page.goto(propertyUrl);
    
            let squareFootage;
            try {
                await this.page.waitForSelector('[class="stat-block sqft-section"]', { timeout: 5000 });
                squareFootage = await this.page.$eval('[class="stat-block sqft-section"]', el => el.textContent);
            } catch (error) {
                squareFootage = "Couldn't find element";
            }
    
            console.log(`Price: ${price}`);
            console.log(`Square Footage: ${squareFootage}`);
    
            // const parsedSquareFootage = this.parseNumber(squareFootage);
    
            this.data.push({ price, squareFootage, propertyUrl });
            console.log(this.data);
            await this.updateData();
    
            await this.randomDelay();
        }
    
        await this.browser.close();
    }
    
    
    }
(async () => {
    const bot = new HouseBot();
    await bot.runBot();
})();
