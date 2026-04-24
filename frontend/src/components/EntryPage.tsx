import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { createRoomApi, roomExistsApi } from '../services/roomApi';

const STORAGE_USER_NAME = 'collab-user-name';
const STORAGE_LAST_ROOM = 'collab-last-room-id';

function isValidRoomId(value: string): boolean {
  return /^[a-zA-Z0-9-]{3,80}$/.test(value);
}

export default function EntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState(() => localStorage.getItem(STORAGE_USER_NAME) ?? '');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const locationError = useMemo(() => {
    const state = location.state as { error?: string } | null;
    return state?.error ?? null;
  }, [location.state]);

  useEffect(() => {
    if (locationError) {
      setError(locationError);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, locationError, navigate]);

  const validateName = (candidate: string): boolean => {
    if (!candidate.trim()) {
      setError('Name is required.');
      return false;
    }
    return true;
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const nextName = name.trim();
    const nextRoom = roomId.trim();

    if (!validateName(nextName)) return;
    if (!nextRoom) {
      setError('Room ID is required.');
      return;
    }
    if (!isValidRoomId(nextRoom)) {
      setError('Room ID must be 3-80 chars: letters, numbers, dashes.');
      return;
    }

    setBusy(true);
    try {
      const exists = await roomExistsApi(nextRoom);
      if (!exists) {
        setError('Room not found. Ask for a valid Room ID or create a new room.');
        return;
      }

      localStorage.setItem(STORAGE_USER_NAME, nextName);
      localStorage.setItem(STORAGE_LAST_ROOM, nextRoom);
      navigate(`/room/${encodeURIComponent(nextRoom)}`);
    } catch {
      setError('Unable to verify room. Check backend connection.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRoom = async () => {
    setError(null);
    const nextName = name.trim();
    if (!validateName(nextName)) return;

    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `room-${Date.now()}`;

    setBusy(true);
    try {
      await createRoomApi(id);
      localStorage.setItem(STORAGE_USER_NAME, nextName);
      localStorage.setItem(STORAGE_LAST_ROOM, id);
      navigate(`/room/${encodeURIComponent(id)}`);
    } catch {
      setError('Unable to create room. Check backend connection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-4">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -right-24 bottom-16 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl rounded-2xl border border-outline bg-elevated p-6 shadow-soft md:p-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Real-time editor</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground md:text-3xl">Enter your session</h1>
            <p className="mt-2 text-sm text-muted">Use your name and room ID. No password required.</p>
          </div>
          <ThemeToggle />
        </div>

        <form onSubmit={handleJoin} className="space-y-5">
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium text-foreground">
              Your name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nora"
              className="w-full rounded-lg border border-outline bg-canvas px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="room-id" className="mb-2 block text-sm font-medium text-foreground">
              Room ID
            </label>
            <input
              id="room-id"
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Paste existing room ID"
              className="w-full rounded-lg border border-outline bg-canvas px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            />
          </div>

          {error && <p className="rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {busy ? 'Please wait...' : 'Join Room'}
            </button>
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={busy}
              className="rounded-lg border border-outline bg-canvas px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-accent"
            >
              Create New Room
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
