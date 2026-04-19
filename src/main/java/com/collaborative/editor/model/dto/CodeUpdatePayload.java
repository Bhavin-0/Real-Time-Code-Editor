package com.collaborative.editor.model.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Full-document sync payload (MVP). Same shape is reused for broadcasts so clients
 * can render editor state uniformly.
 */
public record CodeUpdatePayload(
        @NotBlank String roomId,
        /** Full editor text for the room (replace-all on clients). */
        String content,
        @NotBlank String userId
) {
}
