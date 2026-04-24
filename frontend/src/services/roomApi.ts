import { getWsBaseUrl } from './collaborationStomp';

export async function roomExistsApi(roomId: string): Promise<boolean> {
  const res = await fetch(`${getWsBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}/exists`);
  if (!res.ok) throw new Error(`Failed to check room (${res.status})`);
  const data = (await res.json()) as { exists?: boolean };
  return data.exists === true;
}

export async function createRoomApi(roomId: string): Promise<void> {
  const res = await fetch(`${getWsBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to create room (${res.status})`);
}

/** Deletes the room on the server and triggers {@code ROOM_DELETED} broadcast for subscribers. */
export async function deleteRoomApi(roomId: string, userId: string): Promise<boolean> {
  const res = await fetch(
    `${getWsBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}?userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  );
  if (res.status === 404) return false;
  if (res.status === 403) throw new Error('FORBIDDEN_DELETE');
  if (!res.ok) throw new Error(`Failed to delete room (${res.status})`);
  return true;
}
