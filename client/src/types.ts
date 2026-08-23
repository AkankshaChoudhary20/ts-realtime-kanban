export interface CardData {
  id: string;
  text: string;
  color: string;
}

export type ColumnId = 'todo' | 'doing' | 'done';

export const COLUMNS: { id: ColumnId; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'doing', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];

export interface PeerState {
  name: string;
  color: string;
  [key: string]: unknown;
}
