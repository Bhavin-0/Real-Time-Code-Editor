package com.collaborative.editor.service;

import com.collaborative.editor.model.dto.RoomUserPayload;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory room store: roomId -> room(users + code).
 */
@Service
public class RoomRegistryService {

    private final ConcurrentHashMap<String, Room> rooms = new ConcurrentHashMap<>();

    private static final class Room {
        volatile String code = "";
        final ConcurrentHashMap<String, String> users = new ConcurrentHashMap<>();
    }

    public record JoinResult(String code, List<RoomUserPayload> users, boolean firstJoin) {
    }

    public record LeaveResult(boolean roomDeleted, String userName, List<RoomUserPayload> users) {
    }

    public JoinResult joinRoom(String roomId, String userId, String userName) {
        Room room = rooms.computeIfAbsent(roomId, id -> new Room());
        boolean firstJoin = room.users.put(userId, userName) == null;
        return new JoinResult(room.code, usersForRoom(room), firstJoin);
    }

    public void saveDocument(String roomId, String content) {
        Room room = rooms.computeIfAbsent(roomId, id -> new Room());
        room.code = content == null ? "" : content;
    }

    public String getDocument(String roomId) {
        Room room = rooms.get(roomId);
        return room == null ? "" : room.code;
    }

    public LeaveResult leaveRoom(String roomId, String userId) {
        Room room = rooms.get(roomId);
        if (room == null) {
            return new LeaveResult(false, null, List.of());
        }

        String removedName = room.users.remove(userId);
        if (room.users.isEmpty()) {
            rooms.remove(roomId, room);
            return new LeaveResult(true, removedName, List.of());
        }

        return new LeaveResult(false, removedName, usersForRoom(room));
    }

    public boolean deleteRoom(String roomId) {
        return rooms.remove(roomId) != null;
    }

    public List<RoomUserPayload> getUsers(String roomId) {
        Room room = rooms.get(roomId);
        return room == null ? List.of() : usersForRoom(room);
    }

    private static List<RoomUserPayload> usersForRoom(Room room) {
        List<RoomUserPayload> list = new ArrayList<>(room.users.size());
        room.users.forEach((id, name) -> list.add(new RoomUserPayload(id, name)));
        list.sort(Comparator.comparing(RoomUserPayload::userName, String.CASE_INSENSITIVE_ORDER));
        return list;
    }
}
