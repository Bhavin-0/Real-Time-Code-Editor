package com.collaborative.editor.model.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Client sends this when entering a room so the server can ensure the room exists
 * and broadcast the latest document snapshot to subscribers.
 */
public record JoinRoomPayload(
        @NotBlank String roomId,
        @NotBlank String userId,
        @NotBlank String userName
) {
}
