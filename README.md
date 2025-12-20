# Q-Turing Test Real-Time Chat System

A dual-server research study platform for human-AI interaction studies at Indiana University.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
npm install
```

### Run the System
```bash
npm run dev:full
```
This starts both servers:
- **Next.js App**: http://localhost:3005 (Participant UI & Moderator Dashboard)
- **Socket.IO Server**: ws://localhost:3006 (Real-time WebSocket)

## 📊 Automatic Data Export

**All conversations are automatically exported** - no manual work required!

### Excel Export (Default)
- ✅ Every message saved to `/exports/research_data_master.xlsx`
- ✅ No configuration needed
- ✅ Real-time updates

### Google Sheets Export (Optional)
- ✅ Cloud backup of all data
- ✅ 15-minute setup
- ✅ Team-accessible

**Start here:** `QUICK_START_EXPORT.md` (2 min read)

## 📖 Documentation

| Document | Purpose | Time |
|----------|---------|------|
| `QUICK_START_EXPORT.md` | Data export overview | 2 min |
| `IMPLEMENTATION_COMPLETE.md` | What was built | 5 min |
| `EXPORT_SETUP_GUIDE.md` | Google Sheets setup | 20 min |
| `AUTO_EXPORT_SUMMARY.md` | Detailed features | 10 min |
| `TECHNICAL_DOCUMENTATION.md` | Architecture details | Reference |
| `DOCUMENTATION_INDEX.md` | All docs index | Navigation |

## 🏗️ Architecture

### Dual-Server Design
```
┌─────────────────┐
│   Next.js App   │ (Port 3005)
│  - Chat UI      │
│  - Dashboard    │
└────────┬────────┘
         │ HTTP
         │
┌────────▼────────┐
│  Socket.IO Server│ (Port 3006)
│  - Message Relay │
│  - Session Mgmt  │
│  - Auto Export   │ ⭐ NEW
└─────────────────┘
         │ WebSocket
         │
    ┌────▼────┐
    │ Exports  │
    │ - Excel  │
    │ - Google │
    │  Sheets  │
    └──────────┘
```

### Key Components
- **`src/app/chat/page.tsx`** - Participant chat interface with Carolina profile
- **`src/app/moderator/`** - Moderator dashboard and chat interface
- **`server/socket-server.ts`** - WebSocket server with session management & auto-export
- **`server/google-sheets.ts`** - Google Sheets API integration (new)
- **`server/excel-export.ts`** - Excel workbook management (new)

## 💾 Data Storage

### In-Memory (Session Data)
- Chat sessions and messages stored in Maps
- No database required (research environment)

### Persistent (Research Data)
- **Excel**: `/exports/research_data_master.xlsx`
  - Messages sheet (all messages)
  - Sessions sheet (summaries)
  - Summary sheet (statistics)

- **Google Sheets** (optional):
  - Real-time cloud backup
  - Same structure as Excel

## 🔄 Message Flow

```
1. Participant sends message
2. Server receives and saves to memory
3. ASYNC: Export to Excel + Google Sheets
4. Broadcast to all users (instant)
5. If LLM partner: Generate AI response
6. Export LLM response (same process)
```

## ⚙️ Configuration

### Environment Variables
See `.env.example` for all options:

```bash
# OpenAI (for LLM responses)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Google Sheets (optional)
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_KEY=...
GOOGLE_SHEETS_ID=...
```

### Excel Export
- Zero configuration
- Works immediately
- Data at `/exports/research_data_master.xlsx`

### Google Sheets Export
- Follow `EXPORT_SETUP_GUIDE.md`
- 15-minute one-time setup
- Real-time cloud backup

## 👥 User Roles

### Participants
- Chat interface at `/chat`
- Paired with human or LLM partner (50/50 distribution)
- Session persistence across refreshes

### Moderators
- Dashboard at `/moderator` (view all sessions)
- Chat interface at `/moderator/chat?sessionId=X` (join sessions)
- Can send messages, trigger LLM responses, end sessions
- Can view and delete sessions

## 🤖 LLM Integration

### Partner Types
- **Human**: Responses from a moderator
- **LLM**: Auto-generated responses using OpenAI

### Distribution
- Automatically balanced 50/50 (human vs LLM)
- Tracked with session statistics

### Requirements
- OpenAI API key in `.env.local`
- `gpt-4o-mini` model (configurable)

## 📊 Research Data

### Captured Per Message
- Unique message ID
- Sender (participant/moderator)
- Full message content
- Timestamp (ISO 8601)
- Session ID
- Partner type (human/LLM)

### Captured Per Session
- Duration
- Message counts
- Participant engagement
- Partner type
- Start/end times
- Moderator ID

## 🔐 Compliance

✅ **University Research Standards**
- All conversations automatically preserved
- Audit trail with precise timestamps
- Session anonymization (participant_timestamp format)
- Data under researcher control
- Cloud backup available

✅ **Data Integrity**
- No message loss
- Unique IDs for all messages
- Session metadata preserved
- Non-blocking exports (no latency)

## 🧪 Testing

### Test the Chat
1. Open http://localhost:3005/chat (participant)
2. Open http://localhost:3005/moderator (moderator)
3. In moderator, click a session ID
4. Send messages back and forth
5. Check `/exports/research_data_master.xlsx` for exports

### Verify Exports
```bash
# Excel exports appear in:
/exports/research_data_master.xlsx

# Google Sheets updates (if configured):
Check your Google Sheet in real-time
```

## 📦 Dependencies

### Frontend
- Next.js 15.5.2
- React 19.1.0
- Socket.IO Client 4.8.1
- Tailwind CSS 4

### Backend
- Socket.IO 4.8.1
- OpenAI 4.104.0
- Google APIs (googleapis 167.0.0)
- ExcelJS 4.4.0

### Development
- TypeScript 5
- ESLint 9
- ts-node with ESM support

## 🚨 Troubleshooting

### Excel file not appearing?
```bash
# Check the exports folder exists
ls -la /exports/
# Restart the server
npm run dev:full
```

### Google Sheets not syncing?
1. Verify credentials in `.env.local`
2. Check server logs for `[GOOGLE-SHEETS]` messages
3. Follow troubleshooting in `EXPORT_SETUP_GUIDE.md`

### LLM responses not working?
1. Check `OPENAI_API_KEY` in `.env.local`
2. Verify session has `partnerType: 'llm'`
3. Check server logs for LLM errors

### Messages not exporting?
1. Check `/exports` directory exists and is writable
2. Look for `[EXCEL]` logs in server output
3. Verify `.env.local` loaded (restart server)

## 📚 Additional Resources

- `TECHNICAL_DOCUMENTATION.md` - Architecture & design patterns
- `copilot-instructions.md` - Development guidelines
- `chat-system-updates.md` - Recent changes & known issues
- `REALTIME_CHAT_README.md` - Deployment considerations

## 🎯 Next Steps

### Immediate
1. Start the system: `npm run dev:full`
2. Test a chat session
3. Check `/exports/research_data_master.xlsx`
4. Read `QUICK_START_EXPORT.md`

### Optional: Google Sheets
1. Follow `EXPORT_SETUP_GUIDE.md`
2. Set up Google Cloud credentials
3. Add credentials to `.env.local`
4. Restart server for cloud backup

### Research Analysis
1. Download Excel files from `/exports`
2. Import to Python/R/SPSS
3. Analyze conversation patterns
4. Track human vs LLM interaction quality

## 📄 License

Research study platform for Indiana University. See project repository for license information.

---

**All conversations are automatically preserved in Excel and optionally Google Sheets for compliance with university research guidelines.** 📊✨

For detailed information, start with `QUICK_START_EXPORT.md` or see `DOCUMENTATION_INDEX.md` for complete navigation.
