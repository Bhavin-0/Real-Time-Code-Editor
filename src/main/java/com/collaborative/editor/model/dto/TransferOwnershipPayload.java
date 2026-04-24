package com.collaborative.editor.model.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Client sends this to transfer room ownership to another connected user.
 */
public record TransferOwnershipPayload(
        @NotBlank String roomId,
        @NotBlank String fromUserId,
        @NotBlank String toUserId
) {
}