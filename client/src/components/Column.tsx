import { useState } from 'react';
import type { CardData, ColumnId } from '../types';
import { Card } from './Card';

interface Props {
  id: ColumnId;
  title: string;
  cards: CardData[];
  onAdd: (column: ColumnId, text: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDragStart: (e: React.DragEvent, cardId: string, column: ColumnId) => void;
  onDrop: (column: ColumnId, index: number) => void;
}

export function Column({ id, title, cards, onAdd, onDelete, onEdit, onDragStart, onDrop }: Props) {
  const [draft, setDraft] = useState('');
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const submit = () => {
    if (!draft.trim()) return;
    onAdd(id, draft);
    setDraft('');
  };

  return (
    <div
      className="column"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOverIndex(cards.length);
      }}
      onDragLeave={() => setDragOverIndex(null)}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(id, dragOverIndex ?? cards.length);
        setDragOverIndex(null);
      }}
    >
      <h2>
        {title} <span className="count">{cards.length}</span>
      </h2>
      <div className="card-list">
        {cards.map((card, index) => (
          <div
            key={card.id}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverIndex(index);
            }}
          >
            {dragOverIndex === index && <div className="drop-indicator" />}
            <Card card={card} column={id} onDelete={onDelete} onEdit={onEdit} onDragStart={onDragStart} />
          </div>
        ))}
        {dragOverIndex === cards.length && <div className="drop-indicator" />}
      </div>
      <div className="add-card">
        <input
          value={draft}
          placeholder="Add a card…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button onClick={submit}>Add</button>
      </div>
    </div>
  );
}
