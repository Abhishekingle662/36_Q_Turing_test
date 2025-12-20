# Documentation Index

## 📖 All Documentation Files

This workspace now contains comprehensive documentation for the research study platform. Start here:

### 🚀 **Getting Started**
- **`QUICK_START_EXPORT.md`** (2 min read)
  - Quick reference for data export
  - Where data is stored
  - How to access files

### 📋 **Implementation Overview**
- **`IMPLEMENTATION_COMPLETE.md`** (5 min read)
  - What was built
  - How it works
  - Feature summary
  - Compliance checklist

### 🎯 **Data Export System**
- **`AUTO_EXPORT_SUMMARY.md`** (10 min read)
  - Complete feature breakdown
  - Data structure details
  - Performance notes
  - Troubleshooting

- **`EXPORT_SETUP_GUIDE.md`** (20 min setup + read)
  - Excel export (no setup)
  - Google Sheets setup (optional, 15 min)
  - Step-by-step credentials
  - Compliance details

### 🏗️ **Architecture & Technical**
- **`TECHNICAL_DOCUMENTATION.md`** (Architecture reference)
  - System design
  - Component structure
  - Session management
  - Socket.IO events

- **`chat-system-updates.md`** (Development notes)
  - Recent changes
  - Known issues
  - Development patterns

### 🔧 **Configuration**
- **`.env.example`** (Template)
  - All environment variables
  - Configuration options
  - Base64 encoding instructions

- **`copilot-instructions.md`** (Development guidelines)
  - Code patterns
  - Session management
  - Styling approach
  - Testing procedures

---

## 📊 Data Export Files

The system automatically creates:

### Excel Files
```
/exports/research_data_master.xlsx
│
├── Messages sheet
│   └── All participant/moderator messages
│       (Session ID, Message ID, Sender, Content, Timestamp, Partner Type)
│
├── Sessions sheet
│   └── Session summaries
│       (Participant ID, Duration, Message Counts, Timestamps)
│
└── Summary sheet
    └── Auto-updating statistics
        (Total sessions, messages, human/LLM split)
```

### JSON Backups
```
/exports/session_*.json
└── Individual session backups (when session ends)
```

### Google Sheets (Optional)
- Real-time cloud backup (if configured)
- Same structure as Excel
- Team-accessible

---

## 🎯 Quick Navigation

**I want to...**

- **Start using the system right now**
  → Read `QUICK_START_EXPORT.md` (2 min)

- **Understand what was built**
  → Read `IMPLEMENTATION_COMPLETE.md` (5 min)

- **Set up Google Sheets cloud backup**
  → Follow `EXPORT_SETUP_GUIDE.md` (15 min setup)

- **Understand the architecture**
  → Read `TECHNICAL_DOCUMENTATION.md`

- **See all configuration options**
  → Check `.env.example`

- **Understand how messages are handled**
  → Read `copilot-instructions.md`

- **Troubleshoot export issues**
  → See `EXPORT_SETUP_GUIDE.md` (Troubleshooting section)

---

## 📚 File Map

```
Q-Turing Test Project
│
├── 📄 IMPLEMENTATION_COMPLETE.md ← You are here
├── 📄 QUICK_START_EXPORT.md (Quick reference)
├── 📄 AUTO_EXPORT_SUMMARY.md (Detailed overview)
├── 📄 EXPORT_SETUP_GUIDE.md (Google Sheets setup)
├── 📄 TECHNICAL_DOCUMENTATION.md (Architecture)
├── 📄 REALTIME_CHAT_README.md (Deployment notes)
├── 📄 README.md (General project info)
├── 📄 chat-system-updates.md (Recent changes)
├── 📄 copilot-instructions.md (Development guidelines)
├── 📄 .env.example (Configuration template)
│
├── 📁 src/
│   ├── app/
│   │   ├── page.tsx (Landing page)
│   │   ├── chat/page.tsx (Participant chat)
│   │   └── moderator/ (Moderator dashboard)
│   └── lib/
│       └── socket.ts (Socket client)
│
├── 📁 server/
│   ├── socket-server.ts ⭐ (Main server - NOW WITH AUTO-EXPORT)
│   ├── google-sheets.ts ⭐ (New - Google Sheets integration)
│   ├── excel-export.ts ⭐ (New - Excel export)
│   ├── llm.ts (OpenAI integration)
│   ├── db.ts (Database placeholder)
│   └── models.ts (TypeScript types)
│
├── 📁 exports/ ⭐ (AUTO-CREATED - Your data lives here!)
│   └── research_data_master.xlsx
│
└── 📁 public/
    └── Images/
```

⭐ = Recently added or modified

---

## 🔄 Development Workflow

### Start the System
```bash
npm run dev:full
```
- Starts Next.js (port 3005) and Socket.IO (port 3006)
- Initializes Excel export automatically
- Google Sheets enabled if credentials in .env.local

### Run Individual Servers
```bash
npm run dev          # Next.js only
npm run dev:socket   # Socket.IO only
```

### Development Notes
- See `copilot-instructions.md` for code patterns
- See `TECHNICAL_DOCUMENTATION.md` for architecture
- See `chat-system-updates.md` for recent changes

---

## ✅ Compliance & Safety

All documentation includes:
- ✅ University research guidelines compliance info
- ✅ Data privacy considerations
- ✅ Audit trail preservation
- ✅ Backup procedures
- ✅ Data retention notes

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Excel file not appearing | Check `/exports` directory, restart server |
| Google Sheets not syncing | Follow EXPORT_SETUP_GUIDE.md setup steps |
| Can't find credentials | See .env.example for format |
| Messages not exporting | Check server logs for [EXCEL] or [GOOGLE-SHEETS] messages |
| Forgot configuration | Copy .env.example to .env.local and fill in values |

See respective documentation files for detailed troubleshooting sections.

---

## 📞 Documentation Support

Each document includes:
- Clear step-by-step instructions
- Code examples where applicable
- Configuration templates
- Troubleshooting sections
- Links to related documentation

Start with your use case and follow the documentation path above! 🎯

---

## 🎉 You're All Set!

Your Q-Turing research study platform now has:
- ✅ Automatic chat data export to Excel
- ✅ Optional Google Sheets cloud backup
- ✅ Complete conversation history preservation
- ✅ University research compliance
- ✅ Zero-touch operation
- ✅ Comprehensive documentation

**Read `QUICK_START_EXPORT.md` to get started right now!** 🚀
