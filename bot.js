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
            const csv = parse(this.data);
            await fs.writeFile('data.csv', csv);
            console.log('CSV file saved successfully.');
        } catch (error) {
            console.error('Error saving CSV file:', error);
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
        await this.saveData();
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
        const prices = [];
        const squareFootages = [];
        const propertyUrls = [];

        await this.page.goto(this.url);
        // await this.autoScroll();

        const properties = await this.page.$$('[data-rf-test-name="mapHomeCard"]');
        for (const property of properties.slice(0, 1)) {
            const propertyUrl = await property.$eval('a', a => a.href);
            const priceText = await property.$eval('[class="bp-Homecard__Price--value"]', el => el.textContent);
            propertyUrls.push(propertyUrl);
            prices.push(this.parseNumber(priceText));
        }

        for (const propertyUrl of propertyUrls) {
            await this.page.goto(propertyUrl);
            await this.sleep(2000);

            const squareFootageText = await this.page.$eval('[class="stat-block sqft-section"]', el => el.textContent);
            squareFootages.push(this.parseNumber(squareFootageText));
            await this.randomDelay();
        }

        this.data = propertyUrls.map((url, index) => ({
            price: prices[index],
            square_footage: squareFootages[index],
            property_url: url
        }));
    }
    
    async authenticate() {
        const serviceAccountAuth = new JWT({
            email: 'porterbmoody@gmail.com',
            key: 'porterbmoody@serene-courier-402114.iam.gserviceaccount.com',
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        
        const creds = JSON.parse(await fs.readFile('client_secret.json'));
        this.doc = new GoogleSpreadsheet(this.spreadsheetId, serviceAccountAuth);
        await this.doc.loadInfo();
        this.sheet = this.doc.sheetsByIndex[0];
    }
    
    async getExistingData() {
        const rows = await this.sheet.getRows();
        return rows.map(row => row._rawData);
    }
    
    checkForDuplicates(existingData, newRow, keyField) {
        return existingData.some(row => row[keyField] === newRow[keyField]);
    }
    
    async uploadToGoogleSheets(data) {
        const existingData = await this.getExistingData();
        const uniqueData = data.filter(row => !this.checkForDuplicates(existingData, row, this.keyField));
        for (const row of uniqueData) {
            await this.sheet.addRow(row);
        }
    }
}

(async () => {
    const bot = new HouseBot();
    await bot.runBot();
})();
