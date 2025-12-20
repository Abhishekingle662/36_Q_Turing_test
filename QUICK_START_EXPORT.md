# Quick Reference: Data Export

## What You Get

✅ **Automatic Excel Export**
- Every message saved to: `/exports/research_data_master.xlsx`
- No setup required
- Download anytime from `/exports` folder

✅ **Optional Google Sheets Export** 
- Real-time cloud backup
- Requires 15-minute setup (see EXPORT_SETUP_GUIDE.md)
- All researchers can access from anywhere

## Data Stored

Each message captures:
- Session ID | Message ID | Sender | Message Text | Timestamp | Partner Type

Each session captures:
- Participant ID | Duration | Message Count | Start/End Time | Human/LLM Partner

## How to Access Data

### Excel (Default)
```
/exports/research_data_master.xlsx
```
- Open in Excel, Google Sheets, Numbers, or LibreOffice
- 3 sheets: Messages, Sessions, Summary
- 3 tabs continuously updated

### Google Sheets (Optional)
- Real-time updates as messages are sent
- Share with research team
- Setup: 15 minutes (follow EXPORT_SETUP_GUIDE.md)

## Setup Time

- **Excel Export**: 0 minutes (automatic)
- **Google Sheets Export**: 15 minutes (one-time)

## Configuration Required

### Excel
None - works automatically

### Google Sheets (Optional)
```bash
# In .env.local:
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-email@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY=base64-encoded-json-key
GOOGLE_SHEETS_ID=your-sheet-id
```

See EXPORT_SETUP_GUIDE.md for step-by-step instructions.

## Verification

**To test:**
1. Send a message in chat
2. Check `/exports/research_data_master.xlsx` 
3. New row should appear immediately

**If using Google Sheets:**
1. Check your Google Sheet
2. New row should appear in "Messages" tab within seconds

## Your Data Structure

```
research_data_master.xlsx
├── Messages (all participant/moderator messages)
│   ├── Session ID
│   ├── Message ID
│   ├── Sender
│   ├── Content
│   ├── Timestamp
│   └── Partner Type
├── Sessions (summary when session ends)
│   ├── Session ID
│   ├── Participant ID
│   ├── Partner Type
│   ├── Status
│   ├── Message Counts
│   ├── Duration
│   ├── Start/End Time
│   └── Moderator ID
└── Summary (auto-updating statistics)
    ├── Export Date
    ├── Total Sessions
    ├── Total Messages
    ├── Human Sessions Count
    └── LLM Sessions Count
```

## Compliance Checklist

✅ All conversations stored  
✅ Timestamps preserved  
✅ Audit trail complete  
✅ No manual export needed  
✅ Data under researcher control  
✅ University guidelines compliant  

## Questions?

- **Where is my data?** → `/exports/research_data_master.xlsx`
- **How do I download it?** → Copy from `/exports` folder
- **Can I share it?** → Yes, download files or use Google Sheets
- **Will it auto-backup?** → Yes, Excel + optional Google Sheets
- **What if it crashes?** → Data saved to that point in Excel
