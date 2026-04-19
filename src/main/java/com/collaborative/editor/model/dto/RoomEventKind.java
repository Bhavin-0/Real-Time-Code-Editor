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
    ROOM_DELETED
}
