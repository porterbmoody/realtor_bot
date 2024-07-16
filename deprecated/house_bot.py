#%%
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import pandas as pd
import random
import time
import os
import gspread
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
import pickle

class HouseBot():

    def __init__(self) -> None:
        pass

    def random_delay(self, min_seconds=2, max_seconds=5):
        time.sleep(random.uniform(min_seconds, max_seconds))

    def get_locator(self, html):
        return (By.CSS_SELECTOR, html)

    def get_element(self, html):
        return self.wait.until(EC.presence_of_element_located(self.get_locator(html)))

    def authenticate_google_sheets(self):
        scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
        creds = None
        if os.path.exists('token.pickle'):
            with open('token.pickle', 'rb') as token:
                creds = pickle.load(token)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file('client_secret.json', scopes)
                creds = flow.run_local_server(port=0)
            with open('token.pickle', 'wb') as token:
                pickle.dump(creds, token)
        self.client = gspread.authorize(creds)

    def get_existing_data(self, sheet):
        records = sheet.get_all_records()
        return records

    def check_for_duplicates(self, existing_data, new_row):
        for row in existing_data:
            if row[self.key_field] == new_row[self.key_field]:
                return True
        return False

    def upload_to_google_sheets(self):
        self.authenticate_google_sheets()
        sheet = self.client.open_by_key(self.spreadsheet_id).sheet1
        existing_data = self.get_existing_data(sheet)
        data = self.property_data.to_dict('records')
        unique_data = [row for row in data if not self.check_for_duplicates(existing_data, row)]
        for row in unique_data:
            sheet.append_row(list(row.values()))

    def scrape_data(self):
        os.system('taskkill /f /im chrome.exe')

        self.url = 'https://www.redfin.com/city/6208/FL/Fort-Myers'
        self.key_field = 'property_url'
        options = Options()
        options.add_argument('--user-data-dir=C:\\Users\\Owner\\AppData\\Local\\Google\\Chrome\\User Data')
        options.add_argument('--profile-directory=Default')

        self.driver = webdriver.Chrome(options=options)
        self.wait = WebDriverWait(self.driver, 10)
        self.driver.get(self.url)

        self.sheet_url = 'https://docs.google.com/spreadsheets/d/1Iz6G0vnUSogAjWMwnSJ1aJbNRr3VoqU3c-BaC1xSWVo/edit?fbclid=IwZXh0bgNhZW0CMTEAAR1Wu_u_d5yRlZbBKxJ2ndxb7AHpsEOxjqH0k7vRCs3F6vo1f5ZhLpAb0rs_aem_-jf0aobbjchuCTbOYFsOug&pli=1&gid=0#gid=0'
        self.spreadsheet_id = self.sheet_url.split("/d/")[1].split("/edit")[0]

        prices = []
        square_footages = []
        property_urls = []
        renovation_rates = []
        arvs = []

        properties = self.wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, '[data-rf-test-name="mapHomeCard"]')))
        for property in properties:
            property_url = property.find_element(By.CSS_SELECTOR, 'a').get_attribute('href')
            price = property.find_element(By.CSS_SELECTOR, '[class="bp-Homecard__Price--value"]').text
            property_urls.append(property_url)
            prices.append(price)

        for property_url in property_urls[:2]:
            self.driver.execute_script("window.open('');")
            time.sleep(3)
            print(self.driver.window_handles)
            self.driver.switch_to.window(self.driver.window_handles[-1])
            print('property_url', property_url)
            time.sleep(3)
            self.driver.get(property_url)
            print('getting square_footage')
            time.sleep(4)
            square_footage = self.get_element('[class="stat-block sqft-section"]').text
            print(square_footage)
            # price = self.get_element('[class="bp-Homecard__Price--value"]').text
            time.sleep(2)
            self.driver.close()
            self.driver.switch_to.window(self.driver.window_handles[0])
            time.sleep(2)
            square_footages.append(square_footage)
            renovation_rate = 35
            renovation_rates.append(renovation_rate)
            arv = 'idk'
            arvs.append(arv)

        data = {'property_url': property_urls, 'price': prices, 'square_footage': square_footages, 'arv' : arvs, 'renovation_rate' : renovation_rates}
        self.property_data = pd.DataFrame(data)

        self.property_data.to_csv('redfin_data.csv', index=False)

        self.upload_to_google_sheets()

        self.driver.quit()

    def run_bot(self):
        self.scrape_data()

bot = HouseBot()
bot.run_bot()
# bot.upload_to_google_sheets()

#%%
