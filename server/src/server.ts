import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { getRoom } from './room.js';

const PORT = Number(process.env.PORT ?? 1234);

const httpServer = createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (conn: WebSocket, req) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const room = url.pathname.replace(/^\//, '') || 'default';
  getRoom(room).join(conn);
});

httpServer.listen(PORT, () => {
  console.log(`kanban sync server listening on :${PORT}`);
});
