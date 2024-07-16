#%%
import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
SCOPES = ["https://docs.google.com/spreadsheets/d/1Iz6G0vnUSogAjWMwnSJ1aJbNRr3VoqU3c-BaC1xSWVo/edit?gid=0#gid=0"]

# The ID and range of a sample spreadsheet.
# SAMPLE_SPREADSHEET_ID = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
SAMPLE_SPREADSHEET_ID = "1Iz6G0vnUSogAjWMwnSJ1aJbNRr3VoqU3c-BaC1xSWVo"
SAMPLE_RANGE_NAME = "Class Data!A2:E"

def main():
    """Shows basic usage of the Sheets API.
    Prints values from a sample spreadsheet.
    """
    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "credentials.json", SCOPES
            )
            creds = flow.run_local_server(port=0)
    # Save the credentials for the next run
    with open("token.json", "w") as token:
        token.write(creds.to_json())

    try:
        service = build("sheets", "v4", credentials=creds)

        # Call the Sheets API
        sheet = service.spreadsheets()
        result = (
            sheet.values()
            .get(spreadsheetId=SAMPLE_SPREADSHEET_ID, range=SAMPLE_RANGE_NAME)
            .execute()
        )
        values = result.get("values", [])

        if not values:
            print("No data found.")
            return

        print("Name, Major:")
        for row in values:
            # Print columns A and E, which correspond to indices 0 and 4.
            print(f"{row[0]}, {row[4]}")
    except HttpError as err:
        print(err)

# if __name__ == "__main__":
    # main()

#%%
creds = {
'access_token': '183422236832-14cfekqm45hvo71uu1rhev5geo68h1l0',
# 'token_uri': '(link unavailable)',
'client_id': '183422236832-14cfekqm45hvo71uu1rhev5geo68h1l0.apps.googleusercontent.com',
'client_secret': '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'
}
service = build("sheets", "v4", credentials=creds)
service

#%%
sheet = service.spreadsheets()
result = (
    sheet.values()
    .get(spreadsheetId=SAMPLE_SPREADSHEET_ID, range=SAMPLE_RANGE_NAME)
    .execute()
)
values = result.get("values", [])

values
# %%

