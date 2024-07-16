const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const fs = require('fs');
// const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { JWT } = require('google-auth-library');
const axios = require('axios');

class HouseBot {
    constructor() {
        this.url = 'https://www.redfin.com/city/6208/FL/Fort-Myers';
        this.keyField = 'property_url';
        this.sheetUrl = 'https://docs.google.com/spreadsheets/d/1Iz6G0vnUSogAjWMwnSJ1aJbNRr3VoqU3c-BaC1xSWVo/edit?fbclid=IwZXh0bgNhZW0CMTEAAR1Wu_u_d5yRlZbBKxJ2ndxb7AHpsEOxjqH0k7vRCs3F6vo1f5ZhLpAb0rs_aem_-jf0aobbjchuCTbOYFsOug&pli=1&gid=0#gid=0';
        this.spreadsheetId = this.sheetUrl.split('/d/')[1].split('/edit')[0];
        this.propertyData = [];
    }

    async init() {
        const options = new chrome.Options();
        options.addArguments('--user-data-dir=C:\\Users\\Owner\\AppData\\Local\\Google\\Chrome\\User Data');
        options.addArguments('--profile-directory=Default');
        options.addArguments('--disable-blink-features=AutomationControlled');
        options.addArguments('start-maximized');
        options.addArguments('--disable-infobars');
        options.addArguments('--disable-extensions');
        options.addArguments('--disable-gpu');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');

        this.driver = new Builder().forBrowser('chrome').setChromeOptions(options).build();
        await this.driver.get(this.url);
    }

    async autoScroll() {
        await this.page.evaluate(async () => {
            await new Promise((resolve) => {
                var totalHeight = 0;
                var distance = 100;
                var timer = setInterval(() => {
                    var scrollHeight = document.body.scrollHeight;
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

    async saveToCsv(data) {
        try {
            const csv = parse(data);
            await fs.writeFile('profile_data.csv', csv);
            console.log('CSV file saved successfully.');
        } catch (error) {
            console.error('Error saving CSV file:', error);
        }
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

    async authenticateGoogleSheets() {
        const serviceAccountAuth = new JWT({
            email: 'porterbmoody@gmail.com', 
            key: 'porterbmoody@serene-courier-402114.iam.gserviceaccount.com',
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
            ],
        });

        const creds = JSON.parse(await fs.readFile('client_secret.json'));
        this.doc = new GoogleSpreadsheet(this.spreadsheetId, serviceAccountAuth);
        // await this.doc.useServiceAccountAuth(creds);
        // this.doc = new GoogleSpreadsheet('<the sheet ID from the url>', serviceAccountAuth);
        await this.doc.loadInfo();
        this.sheet = this.doc.sheetsByIndex[0];
    }

    async getExistingData() {
        const rows = await this.sheet.getRows();
        return rows.map(row => row._rawData);
    }

    checkForDuplicates(existingData, newRow) {
        return existingData.some(row => row[this.keyField] === newRow[this.keyField]);
    }

    async uploadToGoogleSheets() {
        const existingData = await this.getExistingData();
        const uniqueData = this.propertyData.filter(row => !this.checkForDuplicates(existingData, row));
        for (const row of uniqueData) {
            await this.sheet.addRow(row);
        }
    }

    parseNumber(value) {
        return parseFloat(value.replace(/[^0-9.]/g, ''));
    }

    async scrapeData() {
        const prices = [];
        const squareFootages = [];
        const propertyUrls = [];

        const properties = await this.driver.wait(until.elementsLocated(By.css('[data-rf-test-name="mapHomeCard"]')), 10000);
        for (const property of properties.slice(0, 1)) {
            const propertyUrl = await property.findElement(By.css('a')).getAttribute('href');
            const priceText = await property.findElement(By.css('[class="bp-Homecard__Price--value"]')).getText();
            console.log(propertyUrl);
            console.log(priceText);
            propertyUrls.push(propertyUrl);
            prices.push(this.parseNumber(priceText));
        }

        for (const propertyUrl of propertyUrls) {
            await this.driver.executeScript("window.open('');");
            const handles = await this.driver.getAllWindowHandles();
            console.log(`Switching to new tab`);
            await this.driver.switchTo().window(handles[1]);
            await this.driver.sleep(2000);
            await this.driver.get(propertyUrl);
            await this.driver.sleep(2000);

            const squareFootageText = await this.driver.wait(until.elementLocated(By.css('[class="stat-block sqft-section"]')), 10000).getText();
            squareFootages.push(this.parseNumber(squareFootageText));
    
            await this.driver.close();
            await this.randomDelay();
            await this.driver.switchTo().window(handles[0]);
            await this.randomDelay();
        }

        this.propertyData = propertyUrls.map((url, index) => ({
            price: prices[index],
            square_footage: squareFootages[index],
            property_url: url
        }));
        console.log('submitting data');
        console.log(this.propertyData);
        await this.authenticateGoogleSheets();
        await this.uploadToGoogleSheets();
        // fs.writeFileSync('propertyData.json', JSON.stringify(this.propertyData, null, 2), 'utf-8');

        await this.driver.quit();
    }

    async runBot() {
        // await this.closeChrome();
        await this.init();
        await this.scrapeData();
    }
}

(async () => {
    const bot = new HouseBot();
    await bot.closeChrome();
    await bot.runBot();
})();
