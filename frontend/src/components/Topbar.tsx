import ThemeToggle from './ThemeToggle';
import type { Collaborator } from './UsersPanel';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

type TopbarProps = {
  roomDisplayName: string | null;
  currentUserName: string;
  connectionStatus: ConnectionStatus;
  collaborators: Collaborator[];
  onCopyRoomLink: () => void;
  onDeleteRoom: () => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function StatusPill({ status }: { status: ConnectionStatus }) {
  const config = {
    disconnected: {
      label: 'Disconnected',
      dot: 'bg-muted',
      ring: 'ring-muted/40',
    },
    connecting: {
      label: 'Connecting',
      dot: 'bg-amber-400',
      ring: 'ring-amber-400/50',
    },
    connected: {
      label: 'Connected',
      dot: 'bg-emerald-500',
      ring: 'ring-emerald-500/40',
    },
  }[status];

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-outline/80 bg-canvas/70 px-3 py-2 shadow-soft"
      role="status"
      aria-live="polite"
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${config.dot} ring-2 ${config.ring} transition-colors duration-200`}
        aria-hidden
      />
      <span className="text-sm font-medium text-foreground">{config.label}</span>
    </div>
  );
}

export default function Topbar({
  roomDisplayName,
  currentUserName,
  connectionStatus,
  collaborators,
  onCopyRoomLink,
  onDeleteRoom,
}: TopbarProps) {
  return (
    <header className="flex min-h-[56px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-outline bg-elevated px-4 py-3 shadow-soft md:px-6 md:py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
            {roomDisplayName ? (
              <>
                <span className="text-muted">Room · </span>
                <span className="font-mono text-base text-foreground">{roomDisplayName}</span>
              </>
            ) : (
              <span className="text-muted">Select or create a room</span>
            )}
          </h1>
          <p className="text-xs text-muted md:text-sm">{currentUserName}</p>
        </div>

        {collaborators.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted">Live</span>
            <div className="flex items-center -space-x-2">
              {collaborators.slice(0, 4).map((collaborator) => (
                <div
                  key={collaborator.userId}
                  title={collaborator.isSelf ? `${collaborator.userName} (you)` : collaborator.userName}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-elevated text-[11px] font-semibold shadow-soft ${
                    collaborator.isSelf ? 'bg-accent text-white' : 'bg-canvas text-foreground'
                  }`}
                  aria-hidden
                >
                  {initials(collaborator.userName)}
                </div>
              ))}
              {collaborators.length > 4 ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-elevated bg-canvas text-[11px] font-semibold text-muted shadow-soft">
                  +{collaborators.length - 4}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
        <StatusPill status={connectionStatus} />

        <button
          type="button"
          onClick={onCopyRoomLink}
          className="rounded-lg border border-outline bg-canvas px-4 py-2 text-sm font-medium text-foreground shadow-soft transition-all duration-200 hover:border-accent hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40"
        >
          Copy room link
        </button>

        <button
          type="button"
          onClick={onDeleteRoom}
          className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-500/15"
        >
          Delete room
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
}
