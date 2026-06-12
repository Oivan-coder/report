# Google Sheets integration

## 1. Apps Script

1. Open the Atlas Finance Google Sheet.
2. Go to `Extensions` -> `Apps Script`.
3. Replace `Code.gs` with `apps-script/Code.gs` from this repository.
4. Save the script.

The script is expected to be bound to the spreadsheet. If it is created as a standalone Apps Script project, set Script Property:

```text
SPREADSHEET_ID=1A-TdwAhphMALINfkqvYJPzPhl8Uw787BnP3TcRe-eVA
```

## 2. Deploy as Web App

1. Click `Deploy` -> `New deployment`.
2. Type: `Web app`.
3. Execute as: `Me`.
4. Who has access: `Anyone with the link`.
5. Copy the Web App URL ending with `/exec`.

## 3. Local app config

Create `.env`:

```text
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/PASTE_DEPLOYMENT_ID_HERE/exec
```

Restart Vite after changing `.env`.

## 4. Smoke tests

Open these URLs in the browser after deploy:

```text
https://script.google.com/macros/s/PASTE_DEPLOYMENT_ID_HERE/exec?action=health
https://script.google.com/macros/s/PASTE_DEPLOYMENT_ID_HERE/exec?action=schema
https://script.google.com/macros/s/PASTE_DEPLOYMENT_ID_HERE/exec?action=bootstrap
```

Expected:

- `health` returns `ok: true`.
- `schema` returns the v3 sheet headers.
- `bootstrap` returns `settings`, `transactions`, and `tables`.

If the response is an HTML page with `Moved Temporarily` and a link to `accounts.google.com/ServiceLogin`, the Web App is not public enough for the PWA. Open the Apps Script deployment settings and set:

```text
Execute as: Me
Who has access: Anyone
```

Then redeploy or create a new deployment and use the new `/exec` URL.

## 5. API actions

```text
GET  ?action=health
GET  ?action=schema
GET  ?action=bootstrap
GET  ?action=transactions
POST action=appendTransaction
POST action=updateTransaction
POST action=updateAccount
POST action=answerMonthlyReview
POST action=syncBatch
```
