package com.collaborative.editor.model.dto;

import java.util.List;

/**
 * Unified broadcast envelope for room topic subscribers.
 * Client code updates use {@link #CODE}; deleting a room sends {@link #ROOM_DELETED}.
 */
public record RoomEventPayload(
        RoomEventKind kind,
        String roomId,
        String userId,
        String userName,
        /** Present for {@code SNAPSHOT} and {@code CODE_SYNC}. */
        String content,
        /** Present for {@code USER_LIST}/{@code SNAPSHOT} and some lifecycle events. */
        List<RoomUserPayload> users,
        /** Present for {@code CHAT_HISTORY} and {@code CHAT_MESSAGE}. */
        List<ChatMessagePayload> chatMessages,
        String roomOwnerId
) {
}
