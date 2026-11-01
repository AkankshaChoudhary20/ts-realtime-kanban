import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import * as decoding from 'lib0/decoding.js';
import { Awareness, applyAwarenessUpdate } from 'y-protocols/awareness.js';
import { KanbanProvider } from '../../client/src/yjsProvider.ts';

test('local presence is sent immediately on every connection and reconnect', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previousWindow = globalThis.window;
  const previousWebSocket = globalThis.WebSocket;
  const sockets: Socket[] = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    binaryType = '';
    sent: Uint8Array[] = [];
    onopen?: () => void;
    onclose?: () => void;
    constructor(_url: string) { sockets.push(this); }
    send(message: Uint8Array) { this.sent.push(message); }
    close() { this.readyState = 3; }
  }
  globalThis.window = { addEventListener() {} } as unknown as Window & typeof globalThis;
  globalThis.WebSocket = Socket as unknown as typeof WebSocket;
  const doc = new Y.Doc();
  const remoteDoc = new Y.Doc();
  const remote = new Awareness(remoteDoc);
  const provider = new KanbanProvider('ws://test', doc);
  try {
    provider.setLocalAwarenessState({ name: 'Otter' });
    sockets[0].sent = []; // discard updates sent before the socket opens
    sockets[0].onopen!();
    assert.equal(sockets[0].sent.length, 1);
    const decoder = decoding.createDecoder(sockets[0].sent[0]);
    assert.equal(decoding.readVarUint(decoder), 1);
    applyAwarenessUpdate(remote, decoding.readVarUint8Array(decoder), null);
    assert.deepEqual(remote.getStates().get(doc.clientID), { name: 'Otter' });
    sockets[0].onclose!();
    t.mock.timers.tick(500);
    assert.equal(sockets.length, 2);
    sockets[1].onopen!();
    assert.equal(sockets[1].sent.length, 1);
  } finally {
    provider.destroy(); remote.destroy(); remoteDoc.destroy(); doc.destroy();
    globalThis.window = previousWindow; globalThis.WebSocket = previousWebSocket;
  }
});
