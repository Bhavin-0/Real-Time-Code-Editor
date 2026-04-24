package com.collaborative.editor.model.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Client sends this when posting a room chat message.
 */
public record ChatMessageSendPayload(
        @NotBlank String roomId,
        @NotBlank String userId,
        @NotBlank String content
) {
}