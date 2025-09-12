# Real-time Chat System

This system provides real-time communication between participants and moderators using Socket.IO.

## Architecture

### Components:
1. **Main Chat Page** (`/src/app/chat/page.tsx`) - Primary participant interface
2. **Moderator Dashboard** (`/src/app/moderator/page.tsx`) - Shows active sessions
3. **Moderator Chat** (`/src/app/moderator/chat/page.tsx`) - Real-time chat interface for moderators
4. **Socket Server** (`/server/socket-server.ts`) - Handles real-time communication
5. **Socket Service** (`/src/lib/socket.ts`) - Client-side socket management

## How It Works

### For Participants:
1. Navigate to `/chat` 
2. Automatically connects to socket server
3. Gets assigned a unique session ID
4. Can chat in real-time with assigned moderator
5. Falls back to AI responses if no moderator is available

### For Moderators:
1. Navigate to `/moderator` to see dashboard
2. View all active participant sessions
3. Click "Join Chat" to moderate a session
4. Real-time bidirectional communication with participant
5. Typing indicators and connection status

### Real-time Features:
- ✅ Instant message delivery
- ✅ Typing indicators (both ways)
- ✅ Connection status monitoring
- ✅ Session management
- ✅ Chat history preservation
- ✅ Multiple concurrent sessions

## Running the System

### Development Mode:
```bash
# Run both Next.js and Socket server
npm run dev:full

# Or run separately:
npm run dev          # Next.js on port 3001
npm run dev:socket   # Socket.IO server on port 3002
```

### Production Setup:
1. Deploy Next.js app to your preferred platform
2. Deploy Socket.IO server to a separate instance
3. Update socket connection URL in `/src/lib/socket.ts`

## Ports:
- **Next.js App**: 3001
- **Socket.IO Server**: 3002

## Database Integration

The current implementation uses in-memory storage. For production:

1. Replace `chatSessions` Map with database (MongoDB, PostgreSQL, etc.)
2. Store participant information in database
3. Implement user authentication
4. Add message persistence
5. Add session analytics

## Environment Variables

Create `.env.local` for configuration:
```
SOCKET_SERVER_URL=http://localhost:3002
NEXT_PUBLIC_SOCKET_URL=http://localhost:3002
```

## Security Considerations

For production deployment:
- Implement proper CORS settings
- Add authentication/authorization
- Rate limiting for messages
- Input sanitization
- Session validation
- SSL/TLS encryption
