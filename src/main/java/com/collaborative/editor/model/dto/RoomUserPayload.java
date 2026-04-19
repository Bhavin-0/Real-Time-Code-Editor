package com.collaborative.editor.model.dto;

/**
 * Public user model sent to room subscribers.
 */
public record RoomUserPayload(
        String userId,
        String userName
) {
}
