import { useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { ChatMessage } from '../services/collaborationStomp';

const STORAGE_CHAT_HEIGHT = 'collab-chat-height';

type ContextMenuState = {
  x: number;
  y: number;
  targetUserId: string;
  targetUserName: string;
};

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
  chatMessages: ChatMessage[];
  roomOwnerId: string | null;
  currentUserId: string;
  onTransferOwnership: (targetUserId: string) => void;
  onRemoveMember: (targetUserId: string) => void;
  onSendChatMessage: (message: string) => void;
};

const CONTEXT_MENU_WIDTH = 180;
const CONTEXT_MENU_HEIGHT = 110;

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

function initialChatHeight(): number {
  const raw = localStorage.getItem(STORAGE_CHAT_HEIGHT);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? Math.max(180, Math.min(480, parsed)) : 280;
}

export default function UsersPanel({
  collaborators,
  activity,
  chatMessages,
  roomOwnerId,
  currentUserId,
  onTransferOwnership,
  onRemoveMember,
  onSendChatMessage,
}: UsersPanelProps) {
  const isOwner = roomOwnerId !== null && roomOwnerId === currentUserId;
  const [draft, setDraft] = useState('');
  const [chatHeight, setChatHeight] = useState(initialChatHeight);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const chatListRef = useRef<HTMLUListElement | null>(null);
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null);

  useEffect(() => {
    const node = chatListRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_CHAT_HEIGHT, String(chatHeight));
  }, [chatHeight]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', close);
    };
  }, [menu]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draft.trim();
    if (!next) return;

    onSendChatMessage(next);
    setDraft('');
  };

  const openManageMenu = (x: number, y: number, collaborator: Collaborator) => {
    const maxX = Math.max(8, window.innerWidth - CONTEXT_MENU_WIDTH - 8);
    const maxY = Math.max(8, window.innerHeight - CONTEXT_MENU_HEIGHT - 8);
    const nextX = Math.min(Math.max(8, x), maxX);
    const nextY = Math.min(Math.max(8, y), maxY);

    setMenu({
      x: nextX,
      y: nextY,
      targetUserId: collaborator.userId,
      targetUserName: collaborator.userName,
    });
  };

  const handleContextMenu = (event: ReactMouseEvent<HTMLLIElement>, collaborator: Collaborator) => {
    if (!isOwner || collaborator.isSelf) return;
    event.preventDefault();
    openManageMenu(event.clientX, event.clientY, collaborator);
  };

  const handleManageButtonClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    collaborator: Collaborator
  ) => {
    if (!isOwner || collaborator.isSelf) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    openManageMenu(rect.right - CONTEXT_MENU_WIDTH, rect.bottom + 6, collaborator);
  };

  const handleResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeStartRef.current = { y: event.clientY, height: chatHeight };

    const onMove = (moveEvent: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const delta = moveEvent.clientY - start.y;
      const next = Math.max(180, Math.min(480, start.height + delta));
      setChatHeight(next);
    };

    const onUp = () => {
      resizeStartRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <aside
      className="relative flex w-full shrink-0 flex-col border-l border-outline bg-elevated shadow-soft xl:w-full"
      aria-label="Collaboration"
    >
      <div className="border-b border-outline px-4 py-4">
        <h2 className="text-sm font-semibold text-foreground">Active collaborators</h2>
        <p className="mt-1 text-xs text-muted">Owner can right-click a member to manage</p>
      </div>

      <ul className="max-h-48 space-y-2 overflow-y-auto px-4 py-4">
        {collaborators.length === 0 ? (
          <li className="text-sm text-muted">No activity yet - join a room and start typing.</li>
        ) : (
          collaborators.map((c) => (
            <li
              key={c.userId}
              onContextMenu={(event) => handleContextMenu(event, c)}
              className={`flex items-center gap-3 rounded-lg border border-outline bg-canvas px-3 py-2 transition-colors duration-200 ${
                isOwner && !c.isSelf ? 'cursor-context-menu hover:border-accent/40' : ''
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ${
                  c.isSelf ? 'bg-accent/20 text-accent ring-accent/30' : colorByUserId(c.userId)
                }`}
                aria-hidden
              >
                {initials(c.userName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm text-foreground">{c.isSelf ? 'You' : c.userName}</p>
                  {roomOwnerId === c.userId ? (
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                      Owner
                    </span>
                  ) : null}
                </div>
                <p className="truncate font-mono text-xs text-muted">{c.userId.slice(0, 12)}...</p>
              </div>
              {isOwner && !c.isSelf ? (
                <button
                  type="button"
                  onClick={(event) => handleManageButtonClick(event, c)}
                  aria-label={`Manage ${c.userName}`}
                  title={`Manage ${c.userName}`}
                  className="rounded-md border border-outline bg-elevated px-2 py-1 text-xs text-muted transition hover:border-accent/40 hover:text-foreground"
                >
                  ...
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>

      <div className="flex min-h-0 flex-1 flex-col border-t border-outline">
        <section className="flex min-h-0 flex-col" style={{ height: chatHeight }}>
          <div className="px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Chat</h3>
            <p className="mt-1 text-xs text-muted">Room-wide messages stay here when people reconnect.</p>
          </div>

          <ul ref={chatListRef} className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {chatMessages.length === 0 ? (
              <li className="text-sm text-muted">No messages yet.</li>
            ) : (
              chatMessages.map((message) => (
                <li
                  key={message.messageId}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    message.userId === currentUserId
                      ? 'border-accent/30 bg-accent/10'
                      : 'border-outline bg-canvas/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-foreground">
                      {message.userId === currentUserId ? 'You' : message.userName}
                    </p>
                    <span className="shrink-0 font-mono text-[10px] text-muted">
                      {formatTime(message.sentAt)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                    {message.content}
                  </p>
                </li>
              ))
            )}
          </ul>

          <form onSubmit={handleSubmit} className="border-t border-outline px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type a message"
                className="min-w-0 flex-1 rounded-lg border border-outline bg-canvas px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
              />
              <button
                type="submit"
                className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                disabled={!draft.trim()}
              >
                Send
              </button>
            </div>
          </form>
        </section>

        <div
          className="h-2 cursor-row-resize bg-outline/60"
          onMouseDown={handleResizeStart}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize chat and activity"
          tabIndex={0}
        />

        <section className="flex min-h-0 flex-1 flex-col border-t border-outline">
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
        </section>
      </div>

      {menu ? (
        <div
          className="fixed z-50 min-w-[180px] rounded-lg border border-outline bg-elevated p-1 shadow-soft"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="px-3 py-1 text-xs text-muted">{menu.targetUserName}</p>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onTransferOwnership(menu.targetUserId);
              setMenu(null);
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-canvas"
          >
            Transfer ownership
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onRemoveMember(menu.targetUserId);
              setMenu(null);
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-500/10"
          >
            Remove member
          </button>
        </div>
      ) : null}
    </aside>
  );
}
