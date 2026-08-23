# ts-realtime-kanban

A real-time collaborative Kanban board. Multiple people can open the same
board URL and drag cards, add tasks, and see each other's cursors/presence
live — powered by [Yjs](https://yjs.dev) CRDTs over a custom WebSocket sync
server, so edits merge automatically even if two people move different cards
at the same time or briefly go offline.

## Why this exists

Most "todo app" tutorials stop at CRUD. This one is about the hard part of
collaborative software: keeping shared state consistent across clients
without a central lock, handling reconnects gracefully, and showing who else
is in the room. It's the same class of problem behind tools like Linear,
Figma, and Notion's multiplayer editing.

## Architecture

```
client/   React + TypeScript + Vite UI, binds Yjs shared types to React state
server/   Node + TypeScript WebSocket server implementing the Yjs sync +
          awareness protocol, with debounced file-based persistence per room
```

- **CRDT sync**: the server doesn't understand "cards" or "columns" — it just
  relays and persists opaque Yjs updates. All merge logic lives in the CRDT.
- **Presence**: Yjs's awareness protocol broadcasts ephemeral state (name,
  color) per connected client; the UI renders these as avatars.
- **Persistence**: each room's document state is periodically snapshotted to
  `server/data/<room>.ydoc` and reloaded on server restart.
- **Rooms**: open `?room=<name>` in the URL to get an isolated board. Share
  the link to collaborate.

## Running locally

```bash
npm run install:all
npm run dev
```

This starts the sync server on `ws://localhost:1234` and the Vite dev server
on `http://localhost:5173`. Open the client URL in two browser tabs (or send
it to a friend on the same network) to see live sync.

To point the client at a different server, set `VITE_SYNC_URL` (e.g. in a
`client/.env.local`):

```
VITE_SYNC_URL=wss://your-server-host
```

## Building for production

```bash
npm run build --prefix server
npm run build --prefix client
```

Serve `client/dist` as static files and run `node server/dist/server.js`
(reads `PORT` and `KANBAN_DATA_DIR` env vars) behind a reverse proxy that
supports WebSocket upgrades.
