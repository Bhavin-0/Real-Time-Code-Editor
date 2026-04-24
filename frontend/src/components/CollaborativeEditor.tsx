import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Topbar, { type ConnectionStatus } from './Topbar';
import EditorContainer from './EditorContainer';
import Sidebar from './Sidebar';
import UsersPanel, { type ActivityItem, type Collaborator } from './UsersPanel';
import type { MonacoEditorInstance } from './EditorContainer';
import {
  createStompCollaborationClient,
  type ChatMessage,
  type RoomUser,
} from '../services/collaborationStomp';
import { deleteRoomApi } from '../services/roomApi';

const DEBOUNCE_MS = 240;
const STORAGE_USER_NAME = 'collab-user-name';
const STORAGE_LAST_ROOM = 'collab-last-room-id';
const STORAGE_LEFT_WIDTH = 'collab-left-panel-width';
const STORAGE_RIGHT_WIDTH = 'collab-right-panel-width';
const STORAGE_USER_ID = 'collab-user-id';

function stableUserId(): string {
  const existing = (sessionStorage.getItem(STORAGE_USER_ID) ?? '').trim();
  if (existing) return existing;

  const next =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `user-${Math.random().toString(36).slice(2, 11)}`;
  sessionStorage.setItem(STORAGE_USER_ID, next);
  return next;
}

function initialPanelWidth(storageKey: string, fallback: number, min: number, max: number): number {
  const raw = localStorage.getItem(storageKey);
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export default function CollaborativeEditor() {
  const navigate = useNavigate();
  const { roomId: roomRouteParam } = useParams<{ roomId?: string }>();

  const activeRoomId = useMemo(() => {
    if (!roomRouteParam?.trim()) return null;
    return decodeURIComponent(roomRouteParam.trim());
  }, [roomRouteParam]);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [roomOwnerId, setRoomOwnerId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [editorContent, setEditorContent] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);
  const [terminalHeight, setTerminalHeight] = useState(208);
  const [leftPanelWidth, setLeftPanelWidth] = useState(() =>
    initialPanelWidth(STORAGE_LEFT_WIDTH, 256, 210, 420)
  );
  const [rightPanelWidth, setRightPanelWidth] = useState(() =>
    initialPanelWidth(STORAGE_RIGHT_WIDTH, 320, 260, 520)
  );

  const userNameRef = useRef((localStorage.getItem(STORAGE_USER_NAME) ?? '').trim());
  const userIdRef = useRef(stableUserId());

  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const executionWsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<HTMLPreElement | null>(null);
  const terminalResizeStartRef = useRef<{ y: number; height: number } | null>(null);
  const leftResizeStartRef = useRef<{ x: number; width: number } | null>(null);
  const rightResizeStartRef = useRef<{ x: number; width: number } | null>(null);
  const applyingRemoteRef = useRef(false);
  const stompRef = useRef<ReturnType<typeof createStompCollaborationClient> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushActivity = useCallback((label: string) => {
    setActivity((prev) => {
      const item: ActivityItem = {
        id: crypto.randomUUID(),
        time: Date.now(),
        label,
      };
      return [item, ...prev].slice(0, 50);
    });
  }, []);

  const applyRemoteContent = useCallback((content: string | undefined) => {
    const next = content ?? '';
    setEditorContent(next);

    const ed = editorRef.current;
    if (!ed) return;
    if (ed.getValue() === next) return;

    applyingRemoteRef.current = true;
    ed.setValue(next);
    setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 0);
  }, []);

  const appendOutput = useCallback((chunk: string) => {
    setOutput((prev) => prev + chunk);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_LEFT_WIDTH, String(leftPanelWidth));
  }, [leftPanelWidth]);

  useEffect(() => {
    localStorage.setItem(STORAGE_RIGHT_WIDTH, String(rightPanelWidth));
  }, [rightPanelWidth]);

  const stopExecutionSocket = useCallback(() => {
    const ws = executionWsRef.current;
    executionWsRef.current = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  }, []);

  useEffect(() => {
    if (!activeRoomId) {
      navigate('/', { replace: true });
      return;
    }

    const userName = userNameRef.current;
    if (!userName) {
      navigate('/', {
        replace: true,
        state: { error: 'Enter your name to join a room.' },
      });
      return;
    }

    localStorage.setItem(STORAGE_LAST_ROOM, activeRoomId);

    setConnectionStatus('connecting');
    setUsers([]);
    setChatMessages([]);
    setActivity([]);

    const stomp = createStompCollaborationClient({
      roomId: activeRoomId,
      userId: userIdRef.current,
      userName,
      onRoomEvent: (ev) => {
        if (ev.roomId !== activeRoomId) return;

        if (ev.kind === 'ROOM_NOT_FOUND') {
          setConnectionStatus('disconnected');
          navigate('/', {
            replace: true,
            state: { error: 'Room not found. Create a new room or use a valid Room ID.' },
          });
          return;
        }

        if (ev.kind === 'ROOM_DELETED') {
          pushActivity('Room deleted. Returning to entry page.');
          setConnectionStatus('disconnected');
          navigate('/', { replace: true });
          return;
        }

        setRoomOwnerId(ev.roomOwnerId ?? null);

        if (ev.kind === 'SNAPSHOT') {
          setUsers(ev.users);
          applyRemoteContent(ev.content);
          return;
        }

        if (ev.kind === 'CHAT_HISTORY') {
          setChatMessages(ev.chatMessages);
          return;
        }

        if (ev.kind === 'CHAT_MESSAGE') {
          setChatMessages((prev) => [...prev, ...ev.chatMessages]);
          return;
        }

        if (ev.kind === 'CODE_SYNC') {
          applyRemoteContent(ev.content);
          if (ev.userId !== userIdRef.current) {
            pushActivity(`${ev.userName ?? 'Someone'} edited code.`);
          }
          return;
        }

        if (ev.kind === 'USER_LIST') {
          setUsers(ev.users);
          return;
        }

        if (ev.kind === 'USER_JOINED') {
          setUsers(ev.users);
          if (ev.userId !== userIdRef.current) {
            pushActivity(`${ev.userName ?? 'Someone'} joined.`);
          }
          return;
        }

        if (ev.kind === 'USER_LEFT') {
          setUsers(ev.users);
          if (ev.userId !== userIdRef.current) {
            pushActivity(`${ev.userName ?? 'Someone'} left.`);
          }
          return;
        }

        if (ev.kind === 'USER_REMOVED') {
          setUsers(ev.users);
          if (ev.userId === userIdRef.current) {
            navigate('/', {
              replace: true,
              state: { error: 'You were removed from this room by the owner.' },
            });
            return;
          }
          pushActivity(`${ev.userName ?? 'A member'} was removed by the owner.`);
        }
      },
      onConnected: () => setConnectionStatus('connected'),
      onDisconnected: () => setConnectionStatus('disconnected'),
    });

    stompRef.current = stomp;
    stomp.client.activate();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      stomp.leaveRoom();
      stomp.deactivate();
      stompRef.current = null;

      if (executionWsRef.current) {
        stopExecutionSocket();
      }
    };
  }, [activeRoomId, applyRemoteContent, navigate, pushActivity, stopExecutionSocket]);

  useEffect(() => {
    const handler = () => {
      stompRef.current?.leaveRoom();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const schedulePublish = useCallback((content: string | undefined) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      stompRef.current?.publishCodeChange(content);
    }, DEBOUNCE_MS);
  }, []);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      setEditorContent(value ?? '');
      if (applyingRemoteRef.current) return;
      if (!activeRoomId || !stompRef.current?.client.connected) return;
      schedulePublish(value);
    },
    [activeRoomId, schedulePublish]
  );

  const handleMount = useCallback((ed: MonacoEditorInstance) => {
    editorRef.current = ed;
    setEditorContent((current) => (current ? current : ed.getValue()));
    ed.focus();
  }, []);

  useEffect(() => {
    const node = terminalRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [output, isRunning]);

  const handleClearOutput = useCallback(() => {
    setOutput('');
    setLastExitCode(null);
  }, []);

  const handleRunCode = useCallback(async () => {
    setOutput('');
    setIsRunning(true);
    setLastExitCode(null);

    stopExecutionSocket();

    try {
      const response = await fetch('http://localhost:8080/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: editorContent }),
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const payload = (await response.json()) as { jobId?: string };
      if (!payload.jobId) {
        throw new Error('Missing jobId in response');
      }

      const ws = new WebSocket(`ws://localhost:3001/ws?jobId=${encodeURIComponent(payload.jobId)}`);
      executionWsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type?: string; data?: string; exitCode?: number };

          if (message.type === 'stdout' || message.type === 'stderr') {
            appendOutput(message.data ?? '');
            return;
          }

          if (message.type === 'end') {
            stopExecutionSocket();
            setIsRunning(false);
            setLastExitCode(message.exitCode ?? 0);
          }
        } catch {
          appendOutput('Invalid message from execution service\n');
        }
      };

      ws.onerror = () => {
        appendOutput('WebSocket error while receiving execution output\n');
        setIsRunning(false);
        setLastExitCode(-1);
        stopExecutionSocket();
      };

      ws.onclose = () => {
        executionWsRef.current = null;
        setIsRunning(false);
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Execution request failed';
      appendOutput(`Error: ${message}\n`);
      setIsRunning(false);
      setLastExitCode(-1);
    }
  }, [appendOutput, editorContent, stopExecutionSocket]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!isRunning) {
          handleRunCode();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleRunCode, isRunning]);

  const handleTerminalResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    terminalResizeStartRef.current = {
      y: event.clientY,
      height: terminalHeight,
    };

    const handleMove = (moveEvent: MouseEvent) => {
      const start = terminalResizeStartRef.current;
      if (!start) return;
      const delta = start.y - moveEvent.clientY;
      const nextHeight = Math.max(120, Math.min(500, start.height + delta));
      setTerminalHeight(nextHeight);
    };

    const handleUp = () => {
      terminalResizeStartRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [terminalHeight]);

  const handleLeftResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    leftResizeStartRef.current = {
      x: event.clientX,
      width: leftPanelWidth,
    };

    const handleMove = (moveEvent: MouseEvent) => {
      const start = leftResizeStartRef.current;
      if (!start) return;
      const delta = moveEvent.clientX - start.x;
      const nextWidth = Math.max(210, Math.min(420, start.width + delta));
      setLeftPanelWidth(nextWidth);
    };

    const handleUp = () => {
      leftResizeStartRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [leftPanelWidth]);

  const handleRightResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    rightResizeStartRef.current = {
      x: event.clientX,
      width: rightPanelWidth,
    };

    const handleMove = (moveEvent: MouseEvent) => {
      const start = rightResizeStartRef.current;
      if (!start) return;
      const delta = start.x - moveEvent.clientX;
      const nextWidth = Math.max(260, Math.min(520, start.width + delta));
      setRightPanelWidth(nextWidth);
    };

    const handleUp = () => {
      rightResizeStartRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [rightPanelWidth]);

  const handleCopyRoomLink = useCallback(async () => {
    if (!activeRoomId) return;
    const text = activeRoomId;
    try {
      await navigator.clipboard.writeText(text);
      pushActivity('Room ID copied.');
    } catch {
      window.prompt('Copy room ID:', text);
    }
  }, [activeRoomId, pushActivity]);

  const handleTransferOwnership = useCallback((targetUserId: string) => {
    if (!activeRoomId) return;
    if (roomOwnerId !== userIdRef.current) return;
    if (targetUserId === userIdRef.current) return;

    stompRef.current?.transferOwnership(targetUserId);
  }, [activeRoomId, roomOwnerId]);

  const handleRemoveMember = useCallback((targetUserId: string) => {
    if (!activeRoomId) return;
    if (roomOwnerId !== userIdRef.current) return;
    if (targetUserId === userIdRef.current) return;

    stompRef.current?.removeMember(targetUserId);
  }, [activeRoomId, roomOwnerId]);

  const handleSendChatMessage = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed || !activeRoomId) return;

    stompRef.current?.sendChatMessage(trimmed);
  }, [activeRoomId]);

  const handleDeleteRoom = useCallback(async () => {
    if (!activeRoomId) return;
    try {
      await deleteRoomApi(activeRoomId, userIdRef.current);
      navigate('/', { replace: true });
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message === 'FORBIDDEN_DELETE') {
        window.alert('Only the room owner can delete this room.');
        return;
      }
      window.alert('Could not delete room. Is the backend running and CORS enabled?');
    }
  }, [activeRoomId, navigate]);

  const canDeleteRoom = roomOwnerId === userIdRef.current;

  const collaborators: Collaborator[] = useMemo(
    () =>
      users.map((u) => ({
        userId: u.userId,
        userName: u.userName,
        isSelf: u.userId === userIdRef.current,
      })),
    [users]
  );

  return (
    <div className="grid h-screen min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-canvas">
      <Topbar
        roomDisplayName={activeRoomId}
        currentUserName={userNameRef.current}
        connectionStatus={connectionStatus}
        collaborators={collaborators}
        onCopyRoomLink={handleCopyRoomLink}
        onDeleteRoom={handleDeleteRoom}
        canDeleteRoom={canDeleteRoom}
      />

      <div className="flex min-h-0 flex-1">
        <div className="hidden min-h-0 lg:flex" style={{ width: leftPanelWidth }}>
          <Sidebar
            rooms={activeRoomId ? [activeRoomId] : []}
            activeRoomId={activeRoomId}
            onSelectRoom={(roomId) => navigate(`/room/${encodeURIComponent(roomId)}`)}
            onCreateRoom={() => navigate('/', { replace: true })}
            onDeleteRoom={() => {
              void handleDeleteRoom();
            }}
            currentUserShort={userNameRef.current || userIdRef.current.slice(0, 8)}
            canDeleteRoom={canDeleteRoom}
          />
        </div>

        <div
          className="hidden w-2 cursor-col-resize bg-outline/60 lg:block"
          onMouseDown={handleLeftResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize left sidebar"
          tabIndex={0}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">

        <main className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 lg:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Editor</h2>
              <p className="text-xs text-muted">JavaScript · live sync when connected</p>
            </div>
            <div className="hidden rounded-full border border-outline bg-elevated px-3 py-1 text-xs text-muted sm:block">
              Primary workspace
            </div>
          </div>

          <div className="relative z-0 flex min-h-0 flex-1 flex-col gap-4">
            <div className="relative z-10 min-h-0 flex-1">
              <EditorContainer
                onMount={handleMount}
                onChange={handleEditorChange}
                value={editorContent}
              />
            </div>

            <section
              className="relative z-0 flex min-h-0 flex-col overflow-hidden rounded-lg border border-outline bg-elevated shadow-soft"
              style={{ height: terminalHeight }}
              aria-label="Terminal output"
            >
              <div
                className="h-2 cursor-row-resize bg-outline/60"
                onMouseDown={handleTerminalResizeStart}
                aria-label="Resize terminal"
                role="separator"
                aria-orientation="horizontal"
                tabIndex={0}
              />

              <div className="flex items-center justify-between gap-3 border-b border-outline/70 px-3 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Terminal
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      isRunning
                        ? 'bg-amber-500/10 text-amber-500'
                        : lastExitCode === null
                          ? 'bg-canvas text-muted'
                          : lastExitCode === 0
                            ? 'bg-emerald-500/20 text-emerald-600'
                            : 'bg-rose-500/20 text-rose-600'
                    }`}
                  >
                    {isRunning
                      ? 'Running'
                      : lastExitCode === null
                        ? 'Idle'
                        : lastExitCode === 0
                          ? 'OK'
                          : `Exit ${lastExitCode}`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunCode}
                    disabled={isRunning}
                    title="Run (Ctrl+Enter)"
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRunning ? 'Running...' : 'Run'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearOutput}
                    className="rounded-lg border border-outline bg-canvas px-4 py-2 text-sm font-medium text-foreground shadow-soft transition hover:border-accent hover:bg-elevated"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 p-3">
                <pre
                  ref={terminalRef}
                  className="h-full min-h-0 overflow-auto rounded-md border border-outline bg-canvas p-3 font-mono text-xs text-foreground scroll-smooth"
                >
                  {output || 'No output yet.'}
                </pre>
              </div>
            </section>
          </div>
        </main>

        <div
          className="hidden w-2 cursor-col-resize bg-outline/60 xl:block"
          onMouseDown={handleRightResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize collaboration panel"
          tabIndex={0}
        />

        <div
          className="min-h-0 w-full border-t border-outline xl:w-auto xl:shrink-0 xl:border-t-0"
          style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1280 ? rightPanelWidth : undefined }}
        >
          <UsersPanel
            collaborators={collaborators}
            activity={activity}
            chatMessages={chatMessages}
            roomOwnerId={roomOwnerId}
            currentUserId={userIdRef.current}
            onTransferOwnership={handleTransferOwnership}
            onRemoveMember={handleRemoveMember}
            onSendChatMessage={handleSendChatMessage}
          />
        </div>
        </div>
      </div>
    </div>
  );
}
