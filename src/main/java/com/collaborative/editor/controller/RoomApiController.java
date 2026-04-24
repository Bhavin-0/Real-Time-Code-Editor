package com.collaborative.editor.controller;

import com.collaborative.editor.model.dto.RoomEventKind;
import com.collaborative.editor.model.dto.RoomEventPayload;
import com.collaborative.editor.service.RoomRegistryService;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP API for room lifecycle when the UI is not connected via STOMP (e.g. deleting from sidebar).
 * Broadcasts {@link RoomEventKind#ROOM_DELETED} so connected clients exit cleanly.
 */
@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(originPatterns = "*")
@Validated
public class RoomApiController {

    private final RoomRegistryService roomRegistryService;
    private final SimpMessagingTemplate messagingTemplate;

    public RoomApiController(RoomRegistryService roomRegistryService, SimpMessagingTemplate messagingTemplate) {
        this.roomRegistryService = roomRegistryService;
        this.messagingTemplate = messagingTemplate;
    }

    @GetMapping("/{roomId}/exists")
    public Map<String, Boolean> roomExists(@PathVariable String roomId) {
        return Map.of("exists", roomRegistryService.roomExists(roomId));
    }

    @PostMapping("/{roomId}")
    public ResponseEntity<Void> createRoom(@PathVariable String roomId) {
        roomRegistryService.createRoom(roomId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{roomId}")
    public ResponseEntity<Void> deleteRoom(
            @PathVariable String roomId,
            @RequestParam @NotBlank String userId) {
        if (!roomRegistryService.roomExists(roomId)) {
            return ResponseEntity.notFound().build();
        }
        if (!roomRegistryService.isRoomOwner(roomId, userId)) {
            return ResponseEntity.status(403).build();
        }
        roomRegistryService.deleteRoom(roomId);
        messagingTemplate.convertAndSend(
                CollaborationWebSocketController.ROOM_TOPIC_PREFIX + roomId,
            new RoomEventPayload(RoomEventKind.ROOM_DELETED, roomId, userId, null, null, null, null, null));
        return ResponseEntity.noContent().build();
    }
}
