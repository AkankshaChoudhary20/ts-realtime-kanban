import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import * as Y from 'yjs';

const DATA_DIR = process.env.KANBAN_DATA_DIR ?? join(process.cwd(), 'data');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

function roomFile(room: string): string {
  const safe = room.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(DATA_DIR, `${safe}.ydoc`);
}

export function loadRoom(room: string, doc: Y.Doc): void {
  const file = roomFile(room);
  if (existsSync(file)) {
    const update = readFileSync(file);
    Y.applyUpdate(doc, update);
  }
}

// Debounced per-room persistence so rapid edits coalesce into a single disk write.
const pending = new Map<string, ReturnType<typeof setTimeout>>();
const SAVE_DELAY_MS = 500;

export function scheduleSave(room: string, doc: Y.Doc): void {
  const existing = pending.get(room);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    pending.delete(room);
    const update = Y.encodeStateAsUpdate(doc);
    const file = roomFile(room);
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, update);
    renameSync(tmp, file);
  }, SAVE_DELAY_MS);
  pending.set(room, timer);
}
