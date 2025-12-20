# Research Data Export Setup Guide

This document explains how to set up automatic export of chat data to Google Sheets and Excel for the Q-Turing research study.

## Overview

The system now supports **two export methods** for compliance with Indiana University research guidelines:

1. **Google Sheets** - Real-time, cloud-based automatic export (optional)
2. **Excel (.xlsx)** - Local file export that runs automatically (always enabled)

Both methods export:
- Individual messages as they are sent (real-time)
- Session summaries when sessions end
- All participant/moderator interactions with timestamps

## Excel Export (Always Enabled)

Excel export requires **no configuration**. The system automatically:

1. Creates a `research_data_master.xlsx` file in the `/exports` directory
2. Appends each message to the "Messages" sheet as it's sent
3. Records session summaries to the "Sessions" sheet when each session ends
4. Maintains aggregate statistics in the "Summary" sheet

### Excel File Location
```
/exports/research_data_master.xlsx
```

### Excel Sheet Structure

**Messages Sheet:**
- Session ID | Message ID | Sender | Content | Timestamp | Partner Type

**Sessions Sheet:**
- Session ID | Participant ID | Partner Type | Status | Total Messages | Participant Messages | Moderator Messages | Duration (minutes) | Start Time | End Time | Moderator ID

**Summary Sheet:**
- Export Date | Total Sessions | Total Messages | Human Partner Sessions | LLM Partner Sessions

### Download Research Data
Simply download the `research_data_master.xlsx` file from the `/exports` folder to analyze session data.

---

## Google Sheets Export (Optional)

For cloud-based, real-time backup, set up Google Sheets integration:

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: "Q-Turing Research Study"
3. Enable the Google Sheets API:
   - Go to APIs & Services > Library
   - Search for "Google Sheets API"
   - Click "Enable"

### Step 2: Create a Service Account

1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "Service Account"
3. Fill in the details:
   - Service account name: `q-turing-research`
   - Click "Create and Continue"
4. Grant roles (optional, not needed for Sheets):
   - Skip or assign "Editor" role
   - Click "Continue"
5. Click "Done"

### Step 3: Create and Download Service Account Key

1. In the Service Accounts list, click on the service account you created
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose "JSON" format
5. Click "Create" - the JSON file will download

**Example JSON structure:**
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "q-turing-research@your-project-id.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

### Step 4: Create Google Sheet for Research Data

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet: "Q-Turing Research Data"
3. Create three sheets (tabs):
   - **Messages** - with headers: `Session ID | Message ID | Sender | Content | Timestamp | Partner Type`
   - **Sessions** - with headers: `Session ID | Participant ID | Partner Type | Status | Total Messages | Participant Messages | Moderator Messages | Duration (minutes) | Start Time | End Time | Moderator ID`
   - **Summary** - Leave empty, the system will populate it

4. Share the spreadsheet with the service account email (found in the JSON key file)
   - Get the email: `service-account-email@project-id.iam.gserviceaccount.com`
   - Add it as an Editor to the Google Sheet

### Step 5: Configure Environment Variables

Create or update `.env.local` in the project root:

```bash
# Google Sheets Configuration (Optional)
# Only needed if using Google Sheets export

# 1. Service account email from JSON key
GOOGLE_SERVICE_ACCOUNT_EMAIL=q-turing-research@your-project-id.iam.gserviceaccount.com

# 2. Base64-encoded private key from JSON file
# Convert the entire JSON key to base64:
GOOGLE_SERVICE_ACCOUNT_KEY=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6InlvdXItcHJvamVjdC1pZCIsInByaXZhdGVfa2V5X2lkIjoiLi4uIn0=

# 3. Google Sheet ID (from the URL)
# Sheet URL: https://docs.google.com/spreadsheets/d/1abc123XYZ/edit#gid=0
# The ID is: 1abc123XYZ
GOOGLE_SHEETS_ID=1abc123XYZ
```

### How to Convert JSON Key to Base64

**On Mac/Linux:**
```bash
cat path/to/your/key.json | base64 | tr -d '\n' > encoded_key.txt
# Then copy the contents of encoded_key.txt to GOOGLE_SERVICE_ACCOUNT_KEY
```

**On Windows PowerShell:**
```powershell
$content = Get-Content "path\to\your\key.json" -Raw
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content)) | Set-Clipboard
# The base64 string is now in your clipboard, paste into .env.local
```

**Online:** Use [base64encode.org](https://www.base64encode.org/) to paste your JSON file

### Step 6: Verify Google Sheets Integration

1. Start the application: `npm run dev:full`
2. Send a message in a chat session
3. Check the Google Sheet - new rows should appear in the "Messages" sheet within seconds
4. Server logs will show `[GOOGLE-SHEETS] Message exported...` when successful

---

## Data Export Workflow

### Real-time Export
- **Every message** sent by participant or moderator is automatically exported to:
  - Excel (immediately to `research_data_master.xlsx`)
  - Google Sheets (if configured)

### Session End Export
- **Session summary** is exported when moderator ends session:
  - Message count, duration, timestamps
  - Participant vs moderator message breakdown
  - Session metadata (partner type, status, etc.)

### Complete History
- All historical data is preserved in:
  - `/exports/research_data_master.xlsx` (permanent local backup)
  - Google Sheet (if configured, permanent cloud backup)

---

## Compliance with Research Guidelines

✅ **Indiana University Research Compliance:**
- All data exports to university-compliant storage
- No PII stored in exports (only message content and timestamps)
- Session identifiers are anonymized (participant_timestamp)
- Audit trail of all messages with exact timestamps
- Data retention controlled by researcher

✅ **Data Security:**
- Excel stored locally in `/exports` (researchers' control)
- Google Sheets uses OAuth2 service account (no password exposure)
- All exports include session/message IDs for traceability

---

## Troubleshooting

### "Service account credentials not configured. Skipping Google Sheets export."
- **Solution:** Check that `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_KEY`, and `GOOGLE_SHEETS_ID` are set in `.env.local`
- The system will still export to Excel automatically

### Google Sheets: "Permission denied"
- **Solution:** Verify you shared the Google Sheet with the service account email
- Check email is spelled correctly in both `.env.local` and Google Sheet sharing settings

### Excel file is locked/read-only
- **Solution:** Close any other applications that have the file open
- The system needs write access to the `/exports` directory

### Base64 encoding error
- **Solution:** Ensure no line breaks in the base64 string in `.env.local`
- Test with: `echo $GOOGLE_SERVICE_ACCOUNT_KEY | base64 -d` (Mac/Linux) or PowerShell equivalent

---

## Architecture Notes

### Message Flow
```
Participant sends message
    ↓
Server receives & saves to memory
    ↓
Export to Excel (async) + Export to Google Sheets (if enabled, async)
    ↓
Broadcast to all users in session
    ↓
If LLM partner: Generate response
    ↓
Export response to Excel + Google Sheets
```

### Performance Considerations
- Exports are **non-blocking** (async operations)
- Excel writes are buffered in-memory during active sessions
- Google Sheets API calls are async and don't delay message sending
- For high-volume sessions, consider setting longer intervals or using database

---

## Next Steps (Future Enhancement)

For production deployment with high volume:

1. **Database Integration** (PostgreSQL/MongoDB)
   - Replace in-memory Maps with persistent database
   - Automatic backup of all sessions
   - Query interface for analytics

2. **Export Scheduling**
   - Batch exports at end of day
   - Periodic snapshots for data recovery

3. **Analytics Dashboard**
   - Real-time statistics on active sessions
   - Message volume tracking
   - Partner type distribution monitoring

---

## Support

For questions or issues with the export setup:
1. Check server logs: `npm run dev:full` and look for `[EXCEL]` or `[GOOGLE-SHEETS]` messages
2. Verify `.env.local` configuration matches this guide
3. Test with Excel export first (no configuration needed)
4. Then add Google Sheets if cloud backup is desired
