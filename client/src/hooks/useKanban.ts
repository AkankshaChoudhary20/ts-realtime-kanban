import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { KanbanProvider, type ConnectionStatus } from '../yjsProvider';
import { COLUMNS, type CardData, type ColumnId, type PeerState } from '../types';

const CARD_COLORS = ['#f4a259', '#5b8c85', '#8785a2', '#e07a5f', '#3d5a80', '#bc6c25'];

function randomColor(): string {
  return CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const ADJECTIVES = ['Swift', 'Calm', 'Bright', 'Quiet', 'Bold', 'Keen', 'Amber', 'Lucky'];
const ANIMALS = ['Otter', 'Falcon', 'Lynx', 'Heron', 'Fox', 'Panda', 'Wren', 'Mole'];

function randomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

export interface KanbanApi {
  cardsByColumn: Record<ColumnId, CardData[]>;
  peers: PeerState[];
  status: ConnectionStatus;
  addCard: (column: ColumnId, text: string) => void;
  deleteCard: (cardId: string) => void;
  editCard: (cardId: string, text: string) => void;
  moveCard: (cardId: string, fromColumn: ColumnId, toColumn: ColumnId, toIndex: number) => void;
}

export function useKanban(room: string): KanbanApi {
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<KanbanProvider | null>(null);
  if (!docRef.current) {
    docRef.current = new Y.Doc();
  }

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [, forceRender] = useState(0);
  const [peers, setPeers] = useState<PeerState[]>([]);

  useEffect(() => {
    const doc = docRef.current!;
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const serverUrl = (import.meta.env.VITE_SYNC_URL as string | undefined) ?? `${wsProtocol}://${window.location.hostname}:1234`;
    const provider = new KanbanProvider(`${serverUrl}/${room}`, doc);
    providerRef.current = provider;

    const localState: PeerState = { name: randomName(), color: randomColor() };
    provider.setLocalAwarenessState(localState);

    const cardsMap = doc.getMap<Y.Map<unknown>>('cards');
    const columnsMap = doc.getMap<Y.Array<string>>('columns');
    // Seed columns on first-ever connect so a brand new room starts with three lists.
    doc.transact(() => {
      for (const col of COLUMNS) {
        if (!columnsMap.has(col.id)) columnsMap.set(col.id, new Y.Array<string>());
      }
    });

    const rerender = () => forceRender((n) => n + 1);
    cardsMap.observeDeep(rerender);
    columnsMap.observeDeep(rerender);

    const unsubStatus = provider.onStatus(setStatus);

    const updatePeers = () => {
      const states = Array.from(provider.awareness.getStates().values()) as (PeerState | null)[];
      setPeers(states.filter((s): s is PeerState => !!s && typeof s.name === 'string'));
    };
    provider.awareness.on('change', updatePeers);
    updatePeers();

    return () => {
      unsubStatus();
      provider.awareness.off('change', updatePeers);
      cardsMap.unobserveDeep(rerender);
      columnsMap.unobserveDeep(rerender);
      provider.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // Recomputed every render; observeDeep above triggers a render on any change,
  // and the maps are small enough that a memo isn't worth the staleness risk.
  const cardsByColumn = (() => {
    const doc = docRef.current!;
    const cardsMap = doc.getMap<Y.Map<unknown>>('cards');
    const columnsMap = doc.getMap<Y.Array<string>>('columns');
    const result: Record<ColumnId, CardData[]> = { todo: [], doing: [], done: [] };
    for (const col of COLUMNS) {
      const ids = columnsMap.get(col.id);
      if (!ids) continue;
      for (const id of ids.toArray()) {
        const card = cardsMap.get(id);
        if (!card) continue;
        result[col.id].push({
          id,
          text: (card.get('text') as string) ?? '',
          color: (card.get('color') as string) ?? '#888',
        });
      }
    }
    return result;
  })();

  const addCard = (column: ColumnId, text: string) => {
    const doc = docRef.current!;
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = randomId();
    doc.transact(() => {
      const card = new Y.Map<unknown>();
      card.set('id', id);
      card.set('text', trimmed);
      card.set('color', randomColor());
      doc.getMap<Y.Map<unknown>>('cards').set(id, card);
      doc.getMap<Y.Array<string>>('columns').get(column)?.push([id]);
    });
  };

  const deleteCard = (cardId: string) => {
    const doc = docRef.current!;
    doc.transact(() => {
      const columnsMap = doc.getMap<Y.Array<string>>('columns');
      for (const col of COLUMNS) {
        const arr = columnsMap.get(col.id);
        if (!arr) continue;
        const idx = arr.toArray().indexOf(cardId);
        if (idx !== -1) arr.delete(idx, 1);
      }
      doc.getMap<Y.Map<unknown>>('cards').delete(cardId);
    });
  };

  const editCard = (cardId: string, text: string) => {
    const doc = docRef.current!;
    const card = doc.getMap<Y.Map<unknown>>('cards').get(cardId);
    if (!card) return;
    doc.transact(() => card.set('text', text));
  };

  const moveCard = (cardId: string, fromColumn: ColumnId, toColumn: ColumnId, toIndex: number) => {
    const doc = docRef.current!;
    doc.transact(() => {
      const columnsMap = doc.getMap<Y.Array<string>>('columns');
      const fromArr = columnsMap.get(fromColumn);
      const toArr = columnsMap.get(toColumn);
      if (!fromArr || !toArr) return;
      const fromIdx = fromArr.toArray().indexOf(cardId);
      if (fromIdx === -1) return;
      fromArr.delete(fromIdx, 1);
      // Same-array reorder: removing the source shifts later indices left by one.
      const adjustedIndex = fromColumn === toColumn && fromIdx < toIndex ? toIndex - 1 : toIndex;
      const clampedIndex = Math.max(0, Math.min(adjustedIndex, toArr.length));
      toArr.insert(clampedIndex, [cardId]);
    });
  };

  return { cardsByColumn, peers, status, addCard, deleteCard, editCard, moveCard };
}
