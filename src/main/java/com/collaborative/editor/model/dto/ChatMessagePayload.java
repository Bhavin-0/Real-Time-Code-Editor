package com.collaborative.editor.model.dto;

/**
 * Persistent chat message broadcast to room subscribers.
 */
public record ChatMessagePayload(
        String messageId,
        String userId,
        String userName,
        String content,
        long sentAt
) {
}