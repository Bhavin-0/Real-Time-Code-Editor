import { getWsBaseUrl } from './collaborationStomp';

/** Deletes the room on the server and triggers {@code ROOM_DELETED} broadcast for subscribers. */
export async function deleteRoomApi(roomId: string, userId: string): Promise<boolean> {
  const res = await fetch(
    `${getWsBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}?userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  );
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Failed to delete room (${res.status})`);
  return true;
}
