import { useState } from 'react';
import { COLUMNS, type ColumnId } from './types';
import { useKanban } from './hooks/useKanban';
import { Column } from './components/Column';
import { PresenceBar } from './components/PresenceBar';

function getRoomFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') ?? 'default';
}

export default function App() {
  const [room] = useState(getRoomFromUrl);
  const { cardsByColumn, peers, status, addCard, deleteCard, editCard, moveCard } = useKanban(room);
  const [dragging, setDragging] = useState<{ cardId: string; column: ColumnId } | null>(null);

  const handleDragStart = (e: React.DragEvent, cardId: string, column: ColumnId) => {
    setDragging({ cardId, column });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (toColumn: ColumnId, index: number) => {
    if (!dragging) return;
    moveCard(dragging.cardId, dragging.column, toColumn, index);
    setDragging(null);
  };

  return (
    <div className="app">
      <PresenceBar peers={peers} status={status} room={room} />
      <main className="board">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            id={col.id}
            title={col.title}
            cards={cardsByColumn[col.id]}
            onAdd={addCard}
            onDelete={deleteCard}
            onEdit={editCard}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        ))}
      </main>
    </div>
  );
}
