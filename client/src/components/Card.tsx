import { useState } from 'react';
import type { CardData, ColumnId } from '../types';

interface Props {
  card: CardData;
  column: ColumnId;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDragStart: (e: React.DragEvent, cardId: string, column: ColumnId) => void;
}

export function Card({ card, column, onDelete, onEdit, onDragStart }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.text);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== card.text) onEdit(card.id, draft.trim());
    else setDraft(card.text);
  };

  return (
    <div
      className="card"
      style={{ borderLeftColor: card.color }}
      draggable={!editing}
      onDragStart={(e) => onDragStart(e, card.id, column)}
    >
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
          }}
        />
      ) : (
        <p onDoubleClick={() => setEditing(true)}>{card.text}</p>
      )}
      <button className="card-delete" onClick={() => onDelete(card.id)} aria-label="Delete card">
        ×
      </button>
    </div>
  );
}
