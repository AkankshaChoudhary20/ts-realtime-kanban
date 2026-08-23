import type { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync.js';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness.js';
import * as encoding from 'lib0/encoding.js';
import * as decoding from 'lib0/decoding.js';
import { loadRoom, scheduleSave } from './persistence.js';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

export class Room {
  readonly name: string;
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly conns = new Map<WebSocket, Set<number>>(); // conn -> awareness client ids it owns

  constructor(name: string) {
    this.name = name;
    this.doc = new Y.Doc();
    loadRoom(name, this.doc);
    this.awareness = new Awareness(this.doc);
    this.awareness.setLocalState(null);

    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);
      for (const conn of this.conns.keys()) {
        if (origin !== conn) send(conn, message);
      }
      scheduleSave(this.name, this.doc);
    });

    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      // Track which awareness client ids belong to which connection, so we can
      // clear the right ones when that connection closes.
      const originConn = origin as WebSocket | null;
      if (originConn !== null) {
        const owned = this.conns.get(originConn);
        if (owned) {
          for (const clientId of added) owned.add(clientId);
          for (const clientId of removed) owned.delete(clientId);
        }
      }

      const changed = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(this.awareness, changed));
      const message = encoding.toUint8Array(encoder);
      for (const conn of this.conns.keys()) {
        if (origin !== conn) send(conn, message);
      }
    });
  }

  join(conn: WebSocket): void {
    this.conns.set(conn, new Set());

    conn.on('message', (data: Buffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const messageType = decoding.readVarUint(decoder);
      switch (messageType) {
        case MESSAGE_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, this.doc, conn);
          if (encoding.length(encoder) > 1) send(conn, encoding.toUint8Array(encoder));
          break;
        }
        case MESSAGE_AWARENESS: {
          const update = decoding.readVarUint8Array(decoder);
          applyAwarenessUpdate(this.awareness, update, conn);
          break;
        }
      }
    });

    conn.on('close', () => {
      const ownedClientIds = this.conns.get(conn);
      this.conns.delete(conn);
      if (ownedClientIds && ownedClientIds.size > 0) {
        removeAwarenessStates(this.awareness, Array.from(ownedClientIds), null);
      }
    });

    // Initial sync step 1 + current awareness snapshot.
    const syncEncoder = encoding.createEncoder();
    encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(syncEncoder, this.doc);
    send(conn, encoding.toUint8Array(syncEncoder));

    const states = this.awareness.getStates();
    if (states.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(this.awareness, Array.from(states.keys())));
      send(conn, encoding.toUint8Array(encoder));
    }
  }
}

function send(conn: WebSocket, message: Uint8Array): void {
  if (conn.readyState !== 1 /* OPEN */) return;
  try {
    conn.send(message);
  } catch {
    // connection is closing; ignore
  }
}

const rooms = new Map<string, Room>();

export function getRoom(name: string): Room {
  let room = rooms.get(name);
  if (!room) {
    room = new Room(name);
    rooms.set(name, room);
  }
  return room;
}
