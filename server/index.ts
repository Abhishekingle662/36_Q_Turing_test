import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import { initRealtime } from './realtime.js';
import { handleAuthCallback, isGoogleDriveConfigured } from './google-drive.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Handle Google OAuth callback route before Next.js
const handleOAuthRoutes = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/auth/google/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h2>Missing code or state parameter</h2><p><a href="/moderator">Return to dashboard</a></p>');
      return true;
    }

    try {
      const { email } = await handleAuthCallback(code, state);
      // Redirect back to moderator dashboard with success indicator
      res.writeHead(302, {
        Location: `/moderator?google_connected=true&email=${encodeURIComponent(email)}`,
      });
      res.end();
    } catch (err) {
      console.error('[OAUTH] Callback error:', err);
      res.writeHead(302, { Location: '/moderator?google_connected=false' });
      res.end();
    }
    return true;
  }

  return false;
};

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    // Handle OAuth routes first
    const handled = await handleOAuthRoutes(req, res);
    if (!handled) {
      handle(req, res);
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true
    },
    maxHttpBufferSize: 1e8
  });

  initRealtime(io);

  httpServer
    .listen(port, () => {
      console.log(`🚀 Next + Socket.IO server ready on http://${hostname}:${port} (dev=${dev})`);
    })
    .on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Error: Port ${port} is already in use.`);
        console.error('Please either:');
        console.error(`  1. Stop the process using port ${port}`);
        console.error('  2. Use a different port by setting PORT environment variable');
        console.error('\nTo find and kill the process on Windows:');
        console.error(`  netstat -ano | findstr :${port}`);
        console.error('  taskkill /PID <PID> /F');
        process.exit(1);
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });
});
