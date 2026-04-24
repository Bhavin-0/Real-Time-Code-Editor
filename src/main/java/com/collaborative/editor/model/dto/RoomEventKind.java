package com.collaborative.editor.model.dto;

/**
 * Discriminant for broadcasts on {@code /topic/room/{roomId}} (code snapshot vs lifecycle).
 */
public enum RoomEventKind {
    SNAPSHOT,
    CODE_SYNC,
    USER_LIST,
    USER_JOINED,
    USER_LEFT,
    USER_REMOVED,
    ROOM_NOT_FOUND,
    ROOM_DELETED,
    CHAT_HISTORY,
    CHAT_MESSAGE
}
