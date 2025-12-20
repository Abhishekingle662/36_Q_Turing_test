import 'dotenv/config';
import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import { initRealtime } from './realtime.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
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
