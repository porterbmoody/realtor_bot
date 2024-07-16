const { GoogleSpreadsheet } = require('google-spreadsheet');
const fs = require('fs');
const { exec } = require('child_process');
const { JWT } = require('google-auth-library');
const puppeteer = require('puppeteer');
const { parse } = require('json2csv');

class HouseBot {
    constructor() {
        this.url = 'https://www.redfin.com/city/6208/FL/Fort-Myers';
        this.keyField = 'property_url';
        this.sheetUrl = 'https://docs.google.com/spreadsheets/d/1Iz6G0vnUSogAjWMwnSJ1aJbNRr3VoqU3c-BaC1xSWVo/edit?fbclid=IwZXh0bgNhZW0CMTEAAR1Wu_u_d5yRlZbBKxJ2ndxb7AHpsEOxjqH0k7vRCs3F6vo1f5ZhLpAb0rs_aem_-jf0aobbjchuCTbOYFsOug&pli=1&gid=0#gid=0';
        this.spreadsheetId = this.sheetUrl.split('/d/')[1].split('/edit')[0];
        this.data = [];
        this.page = null;
        this.browser = null;
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

    async saveData() {
        try {
            const fields = ['property_url', 'price', 'square_footage'];
            const csv = parse(this.data, { fields });
            fs.writeFileSync("data.csv", csv);
            console.log('CSV file saved successfully.');
        } catch (error) {
            console.error('Error saving CSV file:', error);
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
        console.log(`total homes listed in the area: ${totalHomes}`);
    
        const property_elements = await this.page.$$('[data-rf-test-name="mapHomeCard"]');
        const number_of_homes_to_srape = property_elements.length;
        console.log(`number_of_homes_to_srape: ${number_of_homes_to_srape}`);
    
        for (let i = 0; i < Math.min(2, property_elements.length); i++) {
            await this.page.goto(this.url); // Go back to the main page for each iteration
            await this.page.waitForSelector('[data-rf-test-name="mapHomeCard"]');
            
            const property_elements = await this.page.$$('[data-rf-test-name="mapHomeCard"]');
            const property_element = property_elements[i];
    
            const propertyUrl = await property_element.$eval('a', a => a.href);
            const price = await property_element.$eval('[class="bp-Homecard__Price--value"]', el => el.textContent);
    
            await this.page.goto(propertyUrl);
            await this.page.waitForSelector('[class="stat-block sqft-section"]');
    
            const squareFootageText = await this.page.$eval('[class="stat-block sqft-section"]', el => el.textContent);
            const squareFootage = this.parseNumber(squareFootageText);
            
            console.log(squareFootage);
            this.data.push({ propertyUrl, price, squareFootage });
            
            await this.randomDelay();
        }
        console.log(this.data);
        // await this.saveData();
        await this.saveToJson()
    }
}

(async () => {
    const bot = new HouseBot();
    await bot.runBot();
})();
