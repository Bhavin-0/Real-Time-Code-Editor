package com.collaborative.editor.model.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Client sends this when leaving or disconnecting from a room.
 */
public record LeaveRoomPayload(
        @NotBlank String roomId,
        @NotBlank String userId
) {
}
