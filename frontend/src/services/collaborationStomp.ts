import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

export type RoomUser = {
  userId: string;
  userName: string;
};

export type ChatMessage = {
  messageId: string;
  userId: string;
  userName: string;
  content: string;
  sentAt: number;
};

export type CodePayload = {
  roomId: string;
  content: string;
  userId: string;
};

/** Mirrors Java {@code RoomEventPayload} / {@code RoomEventKind}. */
export type RoomBroadcast =
  | {
      kind: 'SNAPSHOT';
      roomId: string;
      userId: string;
      userName: string | null;
      content: string;
      users: RoomUser[];
      chatMessages: ChatMessage[];
      roomOwnerId: string | null;
    }
  | {
      kind: 'CODE_SYNC';
      roomId: string;
      userId: string;
      userName: string | null;
      content: string;
      users: RoomUser[];
      chatMessages: ChatMessage[];
      roomOwnerId: string | null;
    }
  | {
    kind:
      | 'USER_LIST'
      | 'USER_JOINED'
      | 'USER_LEFT'
      | 'USER_REMOVED'
      | 'ROOM_NOT_FOUND'
      | 'ROOM_DELETED'
      | 'CHAT_HISTORY'
      | 'CHAT_MESSAGE';
      roomId: string;
      userId: string;
      userName: string | null;
      content: string;
      users: RoomUser[];
      chatMessages: ChatMessage[];
      roomOwnerId: string | null;
    };

export function getWsBaseUrl(): string {
  const base = import.meta.env.VITE_WS_BASE || 'http://localhost:8080';
  return base.replace(/\/$/, '');
}

export function roomSubscriptionTopic(roomId: string): string {
  return `/topic/room/${roomId}`;
}

function parseBroadcast(body: string): RoomBroadcast | null {
  try {
    const raw = JSON.parse(body) as Record<string, unknown>;
    const kind = raw.kind;
    if (
      kind !== 'SNAPSHOT' &&
      kind !== 'CODE_SYNC' &&
      kind !== 'USER_LIST' &&
      kind !== 'USER_JOINED' &&
      kind !== 'USER_LEFT' &&
      kind !== 'USER_REMOVED' &&
      kind !== 'ROOM_NOT_FOUND' &&
      kind !== 'ROOM_DELETED' &&
      kind !== 'CHAT_HISTORY' &&
      kind !== 'CHAT_MESSAGE'
    ) {
      return null;
    }

    const roomId = typeof raw.roomId === 'string' ? raw.roomId : null;
    const userId = typeof raw.userId === 'string' ? raw.userId : null;
    if (!roomId || !userId) return null;

    const userName = typeof raw.userName === 'string' ? raw.userName : null;
    const content = typeof raw.content === 'string' ? raw.content : '';
    const roomOwnerId = typeof raw.roomOwnerId === 'string' ? raw.roomOwnerId : null;
    const chatMessages: ChatMessage[] = Array.isArray(raw.chatMessages)
      ? raw.chatMessages
          .map((m) => {
            if (!m || typeof m !== 'object') return null;
            const record = m as Record<string, unknown>;
            const messageId = typeof record.messageId === 'string' ? record.messageId : null;
            const chatUserId = typeof record.userId === 'string' ? record.userId : null;
            const chatUserName = typeof record.userName === 'string' ? record.userName : null;
            const chatContent = typeof record.content === 'string' ? record.content : null;
            const sentAt = typeof record.sentAt === 'number' ? record.sentAt : null;
            if (!messageId || !chatUserId || !chatUserName || chatContent === null || sentAt === null) {
              return null;
            }
            return {
              messageId,
              userId: chatUserId,
              userName: chatUserName,
              content: chatContent,
              sentAt,
            };
          })
          .filter((m): m is ChatMessage => m !== null)
      : [];
    const users: RoomUser[] = Array.isArray(raw.users)
      ? raw.users
          .map((u) => {
            if (!u || typeof u !== 'object') return null;
            const record = u as Record<string, unknown>;
            const parsedId = typeof record.userId === 'string' ? record.userId : null;
            const parsedName = typeof record.userName === 'string' ? record.userName : null;
            if (!parsedId || !parsedName) return null;
            return { userId: parsedId, userName: parsedName };
          })
          .filter((u): u is RoomUser => u !== null)
      : [];

    return { kind, roomId, userId, userName, content, users, chatMessages, roomOwnerId };
  } catch {
    return null;
  }
}

export type StompCollaborationOptions = {
  roomId: string;
  userId: string;
  userName: string;
  onRoomEvent: (payload: RoomBroadcast) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
};

export function createStompCollaborationClient(options: StompCollaborationOptions) {
  const { roomId, userId, userName, onRoomEvent, onConnected, onDisconnected } = options;

  const client = new Client({
    webSocketFactory: () => new SockJS(`${getWsBaseUrl()}/ws`),
    reconnectDelay: 4000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      client.subscribe(roomSubscriptionTopic(roomId), (message) => {
        const parsed = parseBroadcast(message.body);
        if (parsed) onRoomEvent(parsed);
      });
      client.publish({
        destination: '/app/join-room',
        body: JSON.stringify({ roomId, userId, userName }),
        headers: { 'content-type': 'application/json' },
      });
      onConnected?.();
    },
    onDisconnect: () => onDisconnected?.(),
    onWebSocketClose: () => onDisconnected?.(),
    onStompError: (frame) => {
      console.error('STOMP error', frame.headers['message'], frame.body);
    },
  });

  return {
    client,
    publishCodeChange(content: string | undefined) {
      if (!client.connected) return;
      client.publish({
        destination: '/app/code-sync',
        body: JSON.stringify({
          roomId,
          content: content ?? '',
          userId,
        }),
        headers: { 'content-type': 'application/json' },
      });
    },
    sendChatMessage(content: string) {
      if (!client.connected) return;
      client.publish({
        destination: '/app/chat-message',
        body: JSON.stringify({
          roomId,
          userId,
          content,
        }),
        headers: { 'content-type': 'application/json' },
      });
    },
    leaveRoom() {
      if (!client.connected) return;
      client.publish({
        destination: '/app/leave-room',
        body: JSON.stringify({ roomId, userId }),
        headers: { 'content-type': 'application/json' },
      });
    },
    transferOwnership(toUserId: string) {
      if (!client.connected) return;
      client.publish({
        destination: '/app/transfer-ownership',
        body: JSON.stringify({ roomId, fromUserId: userId, toUserId }),
        headers: { 'content-type': 'application/json' },
      });
    },
    removeMember(targetUserId: string) {
      if (!client.connected) return;
      client.publish({
        destination: '/app/remove-member',
        body: JSON.stringify({ roomId, ownerUserId: userId, targetUserId }),
        headers: { 'content-type': 'application/json' },
      });
    },
    deactivate() {
      client.deactivate();
    },
  };
}
