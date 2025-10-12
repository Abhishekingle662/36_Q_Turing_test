# Q-Turing Test Real-Time Chat System

## Architecture Overview

This is a **dual-server architecture** for research studies on human-AI interaction at Indiana University:
- **Next.js app (port 3001)**: Participant UI and moderator dashboard
- **Socket.IO server (port 3002)**: Real-time WebSocket communication

Critical: This uses **Socket.IO (WebSockets), NOT WebRTC**. The separation enables independent scaling and research-specific session management.

### Component Structure
```
src/app/page.tsx              → Landing/consent page
src/app/chat/page.tsx         → Participant chat interface
src/app/moderator/page.tsx    → Moderator dashboard (session overview)
src/app/moderator/chat/page.tsx → Moderator chat interface
src/lib/socket.ts             → Socket service client (singleton)
server/socket-server.ts       → WebSocket server with session management
```

## Key Design Patterns

### Session Management
Sessions persist across page refreshes using `sessionStorage`:
```typescript
// Pattern used in src/app/chat/page.tsx
let participantId = sessionStorage.getItem('participantId');
if (!participantId) {
  participantId = `participant_${Date.now()}`;
  sessionStorage.setItem('participantId', participantId);
}
```

Sessions have two states: `'active' | 'inactive'`. Disconnection sets to 'inactive' but preserves session data. The server uses in-memory Maps (`chatSessions`, `connectedUsers`) - no database yet.

### Socket.IO Event Pattern
Events follow research-specific naming (not generic chat):
- `join-session` → user joins as participant or moderator
- `send-message` → bidirectional messages with `sender: 'participant' | 'moderator'`
- `typing-start/stop` → typing indicators with `userType` parameter
- `participant-left/rejoined` → connection state changes
- `get-active-sessions` → moderator dashboard updates

**Important**: Always emit session activity updates to moderators. See `server/socket-server.ts` lines 40-70 for the pattern of broadcasting `active-sessions` after state changes.

### Deception Layer
Participants see moderator messages as coming from 'human' participant to maintain research blind:
```typescript
// In src/app/chat/page.tsx
if (message.sender === 'moderator') {
  setMessages(prev => [...prev, {
    sender: 'human', // Masked for research purposes
    // ...
  }]);
}
```

## Development Workflow

### Running the System
**Always run both servers**: `npm run dev:full` (uses `concurrently`)
- Or separately: `npm run dev` + `npm run dev:socket`
- The app won't function without both servers running

### Module System Gotchas
- **Server uses ESM**: `"type": "module"` in package.json
- **Server tsconfig**: Uses ES2022 with `ts-node` ESM loader
- **Import paths**: Use `@/` alias for src (Next.js only), full `.ts` extensions not needed

### Common Issues
1. **Port conflicts**: Check if 3001/3002 are available. Change in `package.json` scripts and `src/lib/socket.ts` serverUrl
2. **Session not updating**: Moderator dashboard needs manual refresh events - don't rely on `clear-inactive-sessions` during refresh (see `chat-system-updates.md`)
3. **Typing indicators**: Always pass `userType` not `sender` - see `socket-server.ts` typing handlers

## Styling Approach

Uses **Tailwind CSS 4** with custom CSS variables for research-appropriate lilac theme (`src/app/globals.css`):
- Primary color: `var(--lilac)` - Indiana University branded
- Dark mode support via `prefers-color-scheme`
- Component classes: `.btn`, `.btn-primary`, `.card`, `.message-bubble`

Always use CSS variables for colors, never hardcoded hex values. The theme maintains professional research aesthetics.

## Testing Real-Time Features

1. Open moderator dashboard: `http://localhost:3001/moderator`
2. Open participant chat in incognito: `http://localhost:3001/chat`
3. Watch server terminal for connection logs
4. Test session persistence: refresh participant page, check sessionStorage in DevTools

## Future Architecture Notes

Currently in-memory storage (`Map` objects). For production:
- Replace `chatSessions` Map with PostgreSQL/Redis
- Add authentication (JWT for moderators)
- Implement message persistence for research data
- Scale Socket.IO with Redis adapter for multi-instance deployment

See `TECHNICAL_DOCUMENTATION.md` for detailed architecture diagrams and `REALTIME_CHAT_README.md` for deployment considerations.
