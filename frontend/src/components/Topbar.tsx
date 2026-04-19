import ThemeToggle from './ThemeToggle';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

type TopbarProps = {
  roomDisplayName: string | null;
  currentUserName: string;
  connectionStatus: ConnectionStatus;
  onCopyRoomLink: () => void;
  onDeleteRoom: () => void;
};

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
      className="flex items-center gap-2 rounded-lg border border-outline bg-elevated px-3 py-2 shadow-soft"
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
  onCopyRoomLink,
  onDeleteRoom,
}: TopbarProps) {
  return (
    <header className="flex min-h-[56px] shrink-0 flex-wrap items-center gap-4 border-b border-outline bg-elevated px-4 py-3 shadow-soft md:px-6 md:py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-baseline md:gap-4">
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
        <p className="text-sm text-muted">{currentUserName}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 md:gap-4">
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
