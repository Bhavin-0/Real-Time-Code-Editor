type SidebarProps = {
  rooms: string[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: () => void;
  onDeleteRoom: (roomId: string) => void;
  currentUserShort: string;
};

function initialsFromId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2);
  return clean.length >= 2 ? clean.toUpperCase() : id.slice(0, 2).toUpperCase();
}

export default function Sidebar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onCreateRoom,
  onDeleteRoom,
  currentUserShort,
}: SidebarProps) {
  return (
    <aside className="flex shrink-0 flex-col border-outline bg-elevated shadow-soft lg:w-64 lg:border-r">
      <div className="flex max-lg:flex-row max-lg:overflow-x-auto max-lg:border-b max-lg:border-outline lg:flex-col lg:gap-0 lg:p-0">
        <div className="flex items-center justify-between gap-2 border-b border-outline px-4 py-4 lg:block lg:px-4 lg:py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Rooms</p>
          <button
            type="button"
            onClick={onCreateRoom}
            className="whitespace-nowrap rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white shadow-soft transition-opacity duration-200 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Create room
          </button>
        </div>

        <nav
          className="flex min-h-0 flex-1 flex-row gap-2 overflow-x-auto px-4 py-3 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:px-3 lg:py-4"
          aria-label="Rooms"
        >
          {rooms.length === 0 && (
            <p className="text-sm text-muted lg:px-1">No rooms yet — create one.</p>
          )}
          {rooms.map((id) => {
            const active = activeRoomId === id;
            return (
              <div
                key={id}
                className={`flex min-w-[140px] items-stretch gap-1 rounded-lg border lg:min-w-0 ${
                  active
                    ? 'border-accent bg-canvas shadow-soft ring-1 ring-accent/30'
                    : 'border-transparent bg-canvas/50 hover:border-outline hover:bg-canvas'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectRoom(id)}
                  className={`min-w-0 flex-1 truncate px-3 py-2 text-left font-mono text-sm transition-colors duration-200 ${
                    active ? 'text-foreground' : 'text-muted hover:text-foreground'
                  }`}
                >
                  {id}
                </button>
                <button
                  type="button"
                  aria-label={`Delete room ${id}`}
                  title="Delete room"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete room "${id}" for everyone?`)) {
                      onDeleteRoom(id);
                    }
                  }}
                  className="shrink-0 rounded-md px-2 text-muted transition-colors duration-200 hover:bg-canvas hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  ×
                </button>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-outline px-4 py-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">You</p>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent ring-2 ring-accent/25"
            aria-hidden
          >
            {initialsFromId(currentUserShort)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-muted" title={currentUserShort}>
              {currentUserShort}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
