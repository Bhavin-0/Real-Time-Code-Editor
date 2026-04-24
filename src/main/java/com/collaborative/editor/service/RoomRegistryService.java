package com.collaborative.editor.service;

import com.collaborative.editor.model.dto.RoomUserPayload;
import com.collaborative.editor.model.dto.ChatMessagePayload;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory room store: roomId -> room(users + code).
 */
@Service
public class RoomRegistryService {

    private static final int MAX_CHAT_MESSAGES = 100;

    private final ConcurrentHashMap<String, Room> rooms = new ConcurrentHashMap<>();

    private static final class Room {
        volatile String code = "";
        volatile String ownerUserId;
        final LinkedHashMap<String, String> users = new LinkedHashMap<>();
        final ArrayList<ChatMessagePayload> chatMessages = new ArrayList<>();
    }

    public record JoinResult(String code, List<RoomUserPayload> users, boolean firstJoin, String roomOwnerId) {
    }

    public record LeaveResult(boolean roomDeleted, String userName, List<RoomUserPayload> users, String roomOwnerId) {
    }

    public record TransferResult(boolean transferred, String roomOwnerId, List<RoomUserPayload> users) {
    }

    public record ChatResult(ChatMessagePayload message, List<ChatMessagePayload> chatMessages) {
    }

    public JoinResult joinRoom(String roomId, String userId, String userName) {
        Room room = rooms.get(roomId);
        if (room == null) {
            return null;
        }

        synchronized (room) {
            boolean firstJoin = !room.users.containsKey(userId);
            room.users.put(userId, userName);
            if (room.ownerUserId == null) {
                room.ownerUserId = userId;
            }
            return new JoinResult(room.code, usersForRoom(room), firstJoin, room.ownerUserId);
        }
    }

    public boolean createRoom(String roomId) {
        return rooms.putIfAbsent(roomId, new Room()) == null;
    }

    public boolean roomExists(String roomId) {
        return rooms.containsKey(roomId);
    }

    public void saveDocument(String roomId, String content) {
        Room room = rooms.get(roomId);
        if (room == null) {
            return;
        }
        synchronized (room) {
            room.code = content == null ? "" : content;
        }
    }

    public String getDocument(String roomId) {
        Room room = rooms.get(roomId);
        return room == null ? "" : room.code;
    }

    public String getOwnerId(String roomId) {
        Room room = rooms.get(roomId);
        return room == null ? null : room.ownerUserId;
    }

    public LeaveResult leaveRoom(String roomId, String userId) {
        Room room = rooms.get(roomId);
        if (room == null) {
            return new LeaveResult(false, null, List.of(), null);
        }

        synchronized (room) {
            String removedName = room.users.remove(userId);
            if (removedName == null) {
                return new LeaveResult(false, null, usersForRoom(room), room.ownerUserId);
            }

            if (room.users.isEmpty()) {
                rooms.remove(roomId, room);
                return new LeaveResult(true, removedName, List.of(), null);
            }

            if (userId.equals(room.ownerUserId)) {
                room.ownerUserId = room.users.keySet().iterator().next();
            }

            return new LeaveResult(false, removedName, usersForRoom(room), room.ownerUserId);
        }
    }

    public TransferResult transferOwnership(String roomId, String fromUserId, String toUserId) {
        Room room = rooms.get(roomId);
        if (room == null) {
            return new TransferResult(false, null, List.of());
        }

        synchronized (room) {
            if (!fromUserId.equals(room.ownerUserId) || !room.users.containsKey(toUserId)) {
                return new TransferResult(false, room.ownerUserId, usersForRoom(room));
            }

            room.ownerUserId = toUserId;
            return new TransferResult(true, room.ownerUserId, usersForRoom(room));
        }
    }

    public LeaveResult removeMember(String roomId, String ownerUserId, String targetUserId) {
        Room room = rooms.get(roomId);
        if (room == null) {
            return new LeaveResult(false, null, List.of(), null);
        }

        synchronized (room) {
            if (!ownerUserId.equals(room.ownerUserId)) {
                return new LeaveResult(false, null, usersForRoom(room), room.ownerUserId);
            }

            String removedName = room.users.remove(targetUserId);
            if (removedName == null) {
                return new LeaveResult(false, null, usersForRoom(room), room.ownerUserId);
            }

            if (room.users.isEmpty()) {
                rooms.remove(roomId, room);
                return new LeaveResult(true, removedName, List.of(), null);
            }

            if (targetUserId.equals(room.ownerUserId)) {
                room.ownerUserId = room.users.keySet().iterator().next();
            }

            return new LeaveResult(false, removedName, usersForRoom(room), room.ownerUserId);
        }
    }

    public boolean isRoomOwner(String roomId, String userId) {
        Room room = rooms.get(roomId);
        return room != null && userId.equals(room.ownerUserId);
    }

    public boolean deleteRoom(String roomId) {
        return rooms.remove(roomId) != null;
    }

    public List<RoomUserPayload> getUsers(String roomId) {
        Room room = rooms.get(roomId);
        return room == null ? List.of() : usersForRoom(room);
    }

    public List<ChatMessagePayload> getChatMessages(String roomId) {
        Room room = rooms.get(roomId);
        if (room == null) {
            return List.of();
        }

        synchronized (room) {
            return List.copyOf(room.chatMessages);
        }
    }

    public ChatResult addChatMessage(String roomId, String userId, String content) {
        Room room = rooms.get(roomId);
        if (room == null) {
            return null;
        }

        synchronized (room) {
            String userName = room.users.get(userId);
            if (userName == null) {
                return null;
            }

            ChatMessagePayload message = new ChatMessagePayload(
                    UUID.randomUUID().toString(),
                    userId,
                    userName,
                    content == null ? "" : content.trim(),
                    System.currentTimeMillis());

            if (message.content().isEmpty()) {
                return null;
            }

            room.chatMessages.add(message);
            if (room.chatMessages.size() > MAX_CHAT_MESSAGES) {
                room.chatMessages.remove(0);
            }

            return new ChatResult(message, List.copyOf(room.chatMessages));
        }
    }

    private static List<RoomUserPayload> usersForRoom(Room room) {
        List<RoomUserPayload> list = new ArrayList<>(room.users.size());
        room.users.forEach((id, name) -> list.add(new RoomUserPayload(id, name)));
        return list;
    }
}
