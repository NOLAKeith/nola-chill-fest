# Connect the Registration Form (about 10 minutes)

## 1. Create the Google Sheet

1. Create a blank Google Sheet named **NOLA Chill Fest Tournament Control**.
2. Open **Extensions → Apps Script**.
3. Delete the sample code and paste the contents of `Code.gs`.
4. Click **Save**.
5. Select the `setup` function and click **Run** once.
6. Approve Google's permission prompts. This creates and formats the `Registrations` tab.

## 2. Deploy the web app

1. In Apps Script, click **Deploy → New deployment**.
2. Choose **Web app**.
3. Description: `NOLA Chill Fest Registration`.
4. Execute as: **Me**.
5. Who has access: **Anyone**.
6. Click **Deploy** and approve permissions if prompted.
7. Copy the Web App URL ending in `/exec`.

## 3. Connect the website

Open `assets/config.js` and replace:

`PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE`

with the `/exec` URL. Keep the quotation marks.

## 4. Test before launch

1. Deploy the website to Cloudflare Pages.
2. Submit one test registration.
3. Confirm a new row appears in the `Registrations` sheet.
4. Confirm Patrick and the test coach receive emails.
5. Delete the test row if desired.

## Email option

The default sends one email to Patrick and one confirmation to the coach. With about 30 teams, this is approximately 60 recipients total and is comfortably within a normal personal Google account's daily quota.

To disable coach confirmations, change this line in `Code.gs`:

`sendCoachConfirmation: true`

to:

`sendCoachConfirmation: false`

After any Apps Script code change, use **Deploy → Manage deployments → Edit → New version → Deploy**.
