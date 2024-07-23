const csv = require('csv-parser');
const { stringify } = require('csv-stringify');
const puppeteer = require('puppeteer');
const fs = require('fs');
// const { promisify } = require('util');
// const readFileAsync = util.promisify(fs.readFile);

class HouseBot {
	constructor() {
		this.selectors = null;
		this.data = [];
		this.page = null;
		this.browser = null;
		this.filePath = 'data.csv';
        this.fileContent = fs.readFileSync('meta_data.json', 'utf8');
        this.selectors = JSON.parse(this.fileContent);
		this.propertyUrlsFilePath = 'propertyUrls.json';
        // this.spreadsheetId = this.sheetUrl.split('/d/')[1].split('/edit')[0];
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

			const csvStringifier = promisify(stringify);
			const csv = await csvStringifier(this.data, {
				header: true,
				columns: fields
			});

			await fs.writeFile(this.filePath, csv);
			console.log('CSV file updated successfully.');
		} catch (error) {
			console.error('Error updating CSV file:', error);
			console.log('Data attempted to save:', this.data);
		}
		await this.randomDelay();
	}

	async savePropertyUrls() {
		fs.writeFile(this.propertyUrlsFilePath, JSON.stringify(this.propertyUrls), 'utf8', function (err) {
			if (err) {
				return console.log(err);
			}
			console.log("The file was saved!");
		}); 
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
		console.log(`opening ${this.selectors['url']}`);
		// await this.page.goto(this.selectors['url']);
        await this.page.goto(this.selectors['url'], { waitUntil: 'networkidle0', timeout: 60000 });        
        console.log('page loaded.');
	}

	async clickTableTab() {
		await this.page.evaluate(() => {
			const tab = document.querySelector(this.selectors['tab_selector']);
			if (tab) {
				tab.click();
				console.log('Clicked on the tab with data-text="Table"');
			} else {
				console.error('No tab with data-text="Table" found.');
			}
		});
	}

	async collectPropertyUrls() {
		console.log('getting property urls...');
		await this.page.waitForSelector(this.selectors['propertyUrlElement'], { timeout: 10000 });
		this.propertyUrls = await this.page.$$eval(this.selectors['propertyUrlElement'], links => links.map(link => link.href));
		console.log(`Found ${this.propertyUrls.length} property URLs`);
		console.log(this.propertyUrls);
		await this.savePropertyUrls();
		// await this.saveToJson(this.propertyUrls);
		// fs.writeFileSync("data.json", JSON.stringify(this.propertyUrls));
		await this.page.waitForSelector(this.selectors['homesSummary'], { timeout: 10000 });
		const totalHomes = await this.page.$eval(this.selectors['homesSummary'], el => el.textContent);
		console.log(`Total homes listed in the area: ${totalHomes}`);
		console.log('sleep 2 secs');
		await this.sleep(2000);
	}

	// async savePropertyUrls() {
		// try {
			// console.log('Property URLs saved to file successfully.');
		// } catch (error) {
			// console.error('Error saving property URLs to file:', error);
		// }
	// }

	// async readPropertyUrls() {
	// 	try {
	// 		const fileContent = await fs.readFile(this.propertyUrlsFilePath, 'utf8');
	// 		this.propertyUrls = JSON.parse(fileContent);
	// 		console.log('Property URLs read from file successfully.');
	// 	} catch (error) {
	// 		console.error('Error reading property URLs from file:', error);
	// 		this.propertyUrls = [];
	// 	}
	// }

    async readPropertyUrls() {
	fs.readFile(this.propertyUrlsFilePath, "utf8", (error, data) => {
		if (error) {
			console.log(error);
			return;
		}
		this.propertyUrls = JSON.parse(data);
		console.log(this.propertyUrls);
		});
	}

	async collectData() {
		try {
			for (const propertyUrl of this.propertyUrls.slice(0,1)) {
				try {
					console.log(`Opening ${propertyUrl}`);
                    await this.page.goto(propertyUrl, { waitUntil: 'networkidle0', timeout: 60000 });
					console.log('Getting price');
					await this.page.waitForSelector(this.selectors['price'], { timeout: 10000 });
					// const price = await.this.page.$eval(this.selectors['price']);
					// const priceElement = await this.page.$eval(this.selectors['price']);
					// const price = await priceElement.$eval('[class="div statsValue"]', el => el.textContent.trim());
                    const price = await this.page.$eval(this.selectors['price'], el => {
                        const priceElement = el.querySelector('.statsValue');
                        return priceElement ? priceElement.textContent.trim() : null;
                    });
					// const price = await this.page.$eval(this.selectors['price'], el => {
						// const statsValueElement = el.querySelector('[class="div statsValue"]');
						// return statsValueElement ? statsValueElement.textContent.trim() : null;
					// });
					let squareFootage;
					try {
						await this.page.waitForSelector(this.selectors['squareFeet'], { timeout: 5000 });
						squareFootage = await this.page.$eval(this.selectors['squareFeet'], el => el.textContent.trim());
					} catch (error) {
						squareFootage = "Couldn't find element";
						console.log(`Error getting square footage: ${error.message}`);
					}

					console.log(`Price: ${price}`);
					console.log(`Square Footage: ${squareFootage}`);

					this.data.push({ price, squareFootage, propertyUrl });
					await this.updateData();

					await this.randomDelay();
				} catch (error) {
					console.error(`Error processing ${propertyUrl}: ${error.message}`);
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
    // await bot.launchBrowser();
    // await bot.collectPropertyUrls();
	await bot.readPropertyUrls();
    // await bot.collectData();
    // await this.authenticateGoogleSheets();
    // await this.uploadToGoogleSheets();
})();