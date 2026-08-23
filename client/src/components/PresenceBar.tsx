import type { PeerState } from '../types';
import type { ConnectionStatus } from '../yjsProvider';

interface Props {
  peers: PeerState[];
  status: ConnectionStatus;
  room: string;
}

export function PresenceBar({ peers, status, room }: Props) {
  return (
    <header className="presence-bar">
      <div className="brand">
        <strong>Realtime Kanban</strong>
        <span className={`status status-${status}`}>{status}</span>
      </div>
      <div className="room-label">room: {room}</div>
      <div className="peers">
        {peers.map((p, i) => (
          <span key={i} className="peer-avatar" style={{ backgroundColor: p.color }} title={p.name}>
            {p.name.slice(0, 1)}
          </span>
        ))}
      </div>
    </header>
  );
}
