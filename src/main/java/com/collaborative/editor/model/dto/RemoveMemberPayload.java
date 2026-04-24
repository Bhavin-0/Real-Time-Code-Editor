package com.collaborative.editor.model.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Owner removes a member from a room.
 */
public record RemoveMemberPayload(
        @NotBlank String roomId,
        @NotBlank String ownerUserId,
        @NotBlank String targetUserId
) {
}
