import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync.js';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness.js';
import * as encoding from 'lib0/encoding.js';
import * as decoding from 'lib0/decoding.js';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 5000;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export class KanbanProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldConnect = true;
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  status: ConnectionStatus = 'connecting';

  constructor(url: string, doc: Y.Doc) {
    this.url = url;
    this.doc = doc;
    this.awareness = new Awareness(doc);

    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === this) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.send(encoding.toUint8Array(encoder));
    });

    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin === this) return;
      const changed = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(this.awareness, changed));
      this.send(encoding.toUint8Array(encoder));
    });

    window.addEventListener('beforeunload', () => {
      removeAwarenessStates(this.awareness, [this.doc.clientID], 'window unload');
    });

    this.connect();
  }

  onStatus(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }

  private connect(): void {
    if (!this.shouldConnect) return;
    this.setStatus('connecting');
    const ws = new WebSocket(this.url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      const message = new Uint8Array(event.data as ArrayBuffer);
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);
      switch (messageType) {
        case MESSAGE_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
          if (encoding.length(encoder) > 1) this.send(encoding.toUint8Array(encoder));
          break;
        }
        case MESSAGE_AWARENESS: {
          applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this);
          break;
        }
      }
    };

    ws.onclose = () => {
      this.ws = null;
      this.setStatus('disconnected');
      removeAwarenessStates(this.awareness, Array.from(this.awareness.getStates().keys()).filter((id) => id !== this.doc.clientID), this);
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  private scheduleReconnect(): void {
    if (!this.shouldConnect || this.reconnectTimer) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(message: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }

  setLocalAwarenessState(state: Record<string, unknown> | null): void {
    this.awareness.setLocalState(state);
  }

  destroy(): void {
    this.shouldConnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.awareness.destroy();
  }
}
