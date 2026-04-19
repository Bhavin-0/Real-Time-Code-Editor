export type Collaborator = {
  userId: string;
  userName: string;
  isSelf: boolean;
};

export type ActivityItem = {
  id: string;
  time: number;
  label: string;
};

type UsersPanelProps = {
  collaborators: Collaborator[];
  activity: ActivityItem[];
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function colorByUserId(userId: string): string {
  const palette = [
    'bg-sky-500/20 text-sky-600 ring-sky-500/30',
    'bg-emerald-500/20 text-emerald-600 ring-emerald-500/30',
    'bg-amber-500/20 text-amber-600 ring-amber-500/30',
    'bg-rose-500/20 text-rose-600 ring-rose-500/30',
    'bg-cyan-500/20 text-cyan-600 ring-cyan-500/30',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) hash = (hash + userId.charCodeAt(i) * (i + 1)) % 997;
  return palette[hash % palette.length];
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function UsersPanel({ collaborators, activity }: UsersPanelProps) {
  return (
    <aside
      className="flex w-full shrink-0 flex-col border-l border-outline bg-elevated shadow-soft xl:w-80"
      aria-label="Collaboration"
    >
      <div className="border-b border-outline px-4 py-4">
        <h2 className="text-sm font-semibold text-foreground">Active collaborators</h2>
        <p className="mt-1 text-xs text-muted">Live presence from room join/leave events</p>
      </div>

      <ul className="max-h-48 space-y-2 overflow-y-auto px-4 py-4">
        {collaborators.length === 0 ? (
          <li className="text-sm text-muted">No activity yet — join a room and start typing.</li>
        ) : (
          collaborators.map((c) => (
            <li
              key={c.userId}
              className="flex items-center gap-3 rounded-lg border border-outline bg-canvas px-3 py-2 transition-colors duration-200"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ${
                  c.isSelf
                    ? 'bg-accent/20 text-accent ring-accent/30'
                    : colorByUserId(c.userId)
                }`}
                aria-hidden
              >
                {initials(c.userName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {c.isSelf ? 'You' : c.userName}
                </p>
                <p className="truncate font-mono text-xs text-muted">{c.userId.slice(0, 12)}...</p>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="flex min-h-0 flex-1 flex-col border-t border-outline">
        <div className="px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Activity</h3>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
          {activity.length === 0 ? (
            <li className="text-sm text-muted">Edits from others will appear here.</li>
          ) : (
            activity.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-transparent bg-canvas/80 px-3 py-2 text-sm text-muted transition-colors duration-200"
              >
                <span className="font-mono text-xs text-muted">{formatTime(a.time)}</span>
                <p className="mt-1 text-foreground">{a.label}</p>
              </li>
            ))
          )}
        </ul>
      </div>
    </aside>
  );
}
