import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Topbar, { type ConnectionStatus } from './Topbar';
import EditorContainer from './EditorContainer';
import UsersPanel, { type ActivityItem, type Collaborator } from './UsersPanel';
import type { MonacoEditorInstance } from './EditorContainer';
import { createStompCollaborationClient, type RoomUser } from '../services/collaborationStomp';
import { deleteRoomApi } from '../services/roomApi';

const DEBOUNCE_MS = 240;
const STORAGE_USER_NAME = 'collab-user-name';
const STORAGE_LAST_ROOM = 'collab-last-room-id';

export default function CollaborativeEditor() {
  const navigate = useNavigate();
  const { roomId: roomRouteParam } = useParams<{ roomId?: string }>();

  const activeRoomId = useMemo(() => {
    if (!roomRouteParam?.trim()) return null;
    return decodeURIComponent(roomRouteParam.trim());
  }, [roomRouteParam]);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const userNameRef = useRef((localStorage.getItem(STORAGE_USER_NAME) ?? '').trim());
  const userIdRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `user-${Math.random().toString(36).slice(2, 11)}`
  );

  const editorRef = useRef<MonacoEditorInstance | null>(null);
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
    const ed = editorRef.current;
    if (!ed) return;
    const next = content ?? '';
    if (ed.getValue() === next) return;

    applyingRemoteRef.current = true;
    ed.setValue(next);
    setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 0);
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
    setActivity([]);

    const stomp = createStompCollaborationClient({
      roomId: activeRoomId,
      userId: userIdRef.current,
      userName,
      onRoomEvent: (ev) => {
        if (ev.roomId !== activeRoomId) return;

        if (ev.kind === 'ROOM_DELETED') {
          pushActivity('Room deleted. Returning to entry page.');
          setConnectionStatus('disconnected');
          navigate('/', { replace: true });
          return;
        }

        if (ev.kind === 'SNAPSHOT') {
          setUsers(ev.users);
          applyRemoteContent(ev.content);
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
    };
  }, [activeRoomId, applyRemoteContent, navigate, pushActivity]);

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
      if (applyingRemoteRef.current) return;
      if (!activeRoomId || !stompRef.current?.client.connected) return;
      schedulePublish(value);
    },
    [activeRoomId, schedulePublish]
  );

  const handleMount = useCallback((ed: MonacoEditorInstance) => {
    editorRef.current = ed;
  }, []);

  const handleCopyRoomLink = useCallback(async () => {
    if (!activeRoomId) return;
    const text = `${window.location.origin}/room/${encodeURIComponent(activeRoomId)}`;
    try {
      await navigator.clipboard.writeText(text);
      pushActivity('Room link copied.');
    } catch {
      window.prompt('Copy room link:', text);
    }
  }, [activeRoomId, pushActivity]);

  const handleDeleteRoom = useCallback(async () => {
    if (!activeRoomId) return;
    try {
      await deleteRoomApi(activeRoomId, userIdRef.current);
      navigate('/', { replace: true });
    } catch (e) {
      console.error(e);
      window.alert('Could not delete room. Is the backend running and CORS enabled?');
    }
  }, [activeRoomId, navigate]);

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
    <div className="flex h-screen min-h-0 flex-col bg-canvas">
      <Topbar
        roomDisplayName={activeRoomId}
        currentUserName={userNameRef.current}
        connectionStatus={connectionStatus}
        onCopyRoomLink={handleCopyRoomLink}
        onDeleteRoom={handleDeleteRoom}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-4 lg:p-6">
          <EditorContainer onMount={handleMount} onChange={handleEditorChange} />
        </main>

        <div className="min-h-0 border-t border-outline xl:flex xl:w-80 xl:shrink-0 xl:border-l xl:border-t-0">
          <UsersPanel collaborators={collaborators} activity={activity} />
        </div>
      </div>
    </div>
  );
}
