package com.collaborative.editor.controller;

import com.collaborative.editor.model.dto.CodeUpdatePayload;
import com.collaborative.editor.model.dto.ChatMessageSendPayload;
import com.collaborative.editor.model.dto.JoinRoomPayload;
import com.collaborative.editor.model.dto.LeaveRoomPayload;
import com.collaborative.editor.model.dto.RemoveMemberPayload;
import com.collaborative.editor.model.dto.RoomEventKind;
import com.collaborative.editor.model.dto.RoomEventPayload;
import com.collaborative.editor.model.dto.TransferOwnershipPayload;
import com.collaborative.editor.service.RoomRegistryService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

/**
 * STOMP handlers: {@code /app/join-room}, {@code /app/code-sync}, {@code /app/leave-room}.
 * Broadcasts use {@link RoomEventPayload} on {@code /topic/room/{roomId}}.
 */
@Controller
public class CollaborationWebSocketController {

    public static final String ROOM_TOPIC_PREFIX = "/topic/room/";

    private final SimpMessagingTemplate messagingTemplate;
    private final RoomRegistryService roomRegistryService;

    public CollaborationWebSocketController(
            SimpMessagingTemplate messagingTemplate,
            RoomRegistryService roomRegistryService) {
        this.messagingTemplate = messagingTemplate;
        this.roomRegistryService = roomRegistryService;
    }

    @MessageMapping("/join-room")
    public void joinRoom(@Valid @Payload JoinRoomPayload payload) {
        RoomRegistryService.JoinResult result = roomRegistryService.joinRoom(
            payload.roomId(),
            payload.userId(),
            payload.userName());

        if (result == null) {
            messagingTemplate.convertAndSend(
                topicForRoom(payload.roomId()),
                new RoomEventPayload(
                    RoomEventKind.ROOM_NOT_FOUND,
                    payload.roomId(),
                    payload.userId(),
                    payload.userName(),
                    null,
                    null,
                    null,
                    null));
            return;
        }

        messagingTemplate.convertAndSend(
                topicForRoom(payload.roomId()),
            new RoomEventPayload(
                RoomEventKind.SNAPSHOT,
                payload.roomId(),
                payload.userId(),
                payload.userName(),
                result.code(),
                result.users(),
                null,
                result.roomOwnerId()));

        if (result.firstJoin()) {
            messagingTemplate.convertAndSend(
                topicForRoom(payload.roomId()),
                new RoomEventPayload(
                    RoomEventKind.USER_JOINED,
                    payload.roomId(),
                    payload.userId(),
                    payload.userName(),
                    null,
                    result.users(),
                    null,
                    result.roomOwnerId()));
        }

        messagingTemplate.convertAndSend(
            topicForRoom(payload.roomId()),
            new RoomEventPayload(
                RoomEventKind.USER_LIST,
                payload.roomId(),
                payload.userId(),
                payload.userName(),
                null,
                result.users(),
                null,
                result.roomOwnerId()));

        messagingTemplate.convertAndSend(
            topicForRoom(payload.roomId()),
            new RoomEventPayload(
                RoomEventKind.CHAT_HISTORY,
                payload.roomId(),
                payload.userId(),
                payload.userName(),
                null,
                null,
                roomRegistryService.getChatMessages(payload.roomId()),
                result.roomOwnerId()));
    }

    @MessageMapping("/code-sync")
    public void onCodeChange(@Valid @Payload CodeUpdatePayload payload) {
        roomRegistryService.saveDocument(payload.roomId(), payload.content());
        messagingTemplate.convertAndSend(
                topicForRoom(payload.roomId()),
            new RoomEventPayload(
                RoomEventKind.CODE_SYNC,
                payload.roomId(),
                payload.userId(),
                null,
                payload.content(),
                null,
                null,
                roomRegistryService.getOwnerId(payload.roomId())));
        }

    @MessageMapping("/leave-room")
    public void leaveRoom(@Valid @Payload LeaveRoomPayload payload) {
        RoomRegistryService.LeaveResult result = roomRegistryService.leaveRoom(payload.roomId(), payload.userId());
        if (result.userName() == null) {
            return;
        }

        if (result.roomDeleted()) {
            messagingTemplate.convertAndSend(
                topicForRoom(payload.roomId()),
                new RoomEventPayload(
                    RoomEventKind.ROOM_DELETED,
                    payload.roomId(),
                    payload.userId(),
                    result.userName(),
                    null,
                    null,
                    null,
                    result.roomOwnerId()));
            return;
        }

        messagingTemplate.convertAndSend(
            topicForRoom(payload.roomId()),
            new RoomEventPayload(
                RoomEventKind.USER_LEFT,
                payload.roomId(),
                payload.userId(),
                result.userName(),
                null,
                result.users(),
                null,
                result.roomOwnerId()));

        messagingTemplate.convertAndSend(
            topicForRoom(payload.roomId()),
            new RoomEventPayload(
                RoomEventKind.USER_LIST,
                payload.roomId(),
                payload.userId(),
                result.userName(),
                null,
                result.users(),
                null,
                result.roomOwnerId()));
    }

    @MessageMapping("/chat-message")
    public void onChatMessage(@Valid @Payload ChatMessageSendPayload payload) {
        RoomRegistryService.ChatResult result = roomRegistryService.addChatMessage(
            payload.roomId(),
            payload.userId(),
            payload.content());

        if (result == null) {
            return;
        }

        messagingTemplate.convertAndSend(
            topicForRoom(payload.roomId()),
            new RoomEventPayload(
                RoomEventKind.CHAT_MESSAGE,
                payload.roomId(),
                payload.userId(),
                result.message().userName(),
                result.message().content(),
                null,
                List.of(result.message()),
                roomRegistryService.getOwnerId(payload.roomId())));
    }

    @MessageMapping("/transfer-ownership")
    public void transferOwnership(@Valid @Payload TransferOwnershipPayload payload) {
        RoomRegistryService.TransferResult result = roomRegistryService.transferOwnership(
            payload.roomId(),
            payload.fromUserId(),
            payload.toUserId());

        if (!result.transferred()) {
            return;
        }

        messagingTemplate.convertAndSend(
            topicForRoom(payload.roomId()),
            new RoomEventPayload(
                RoomEventKind.USER_LIST,
                payload.roomId(),
                payload.fromUserId(),
                null,
                null,
                result.users(),
                null,
                result.roomOwnerId()));
    }

    @MessageMapping("/remove-member")
    public void removeMember(@Valid @Payload RemoveMemberPayload payload) {
        RoomRegistryService.LeaveResult result = roomRegistryService.removeMember(
            payload.roomId(),
            payload.ownerUserId(),
            payload.targetUserId());

        if (result.userName() == null) {
            return;
        }

        messagingTemplate.convertAndSend(
            topicForRoom(payload.roomId()),
            new RoomEventPayload(
                RoomEventKind.USER_REMOVED,
                payload.roomId(),
                payload.targetUserId(),
                result.userName(),
                null,
                result.users(),
                null,
                result.roomOwnerId()));

        if (result.roomDeleted()) {
            messagingTemplate.convertAndSend(
                topicForRoom(payload.roomId()),
                new RoomEventPayload(
                    RoomEventKind.ROOM_DELETED,
                    payload.roomId(),
                    payload.ownerUserId(),
                    null,
                    null,
                    null,
                    null,
                    null));
            return;
        }

        messagingTemplate.convertAndSend(
            topicForRoom(payload.roomId()),
            new RoomEventPayload(
                RoomEventKind.USER_LIST,
                payload.roomId(),
                payload.ownerUserId(),
                null,
                null,
                result.users(),
                null,
                result.roomOwnerId()));
    }

    private static String topicForRoom(String roomId) {
        return ROOM_TOPIC_PREFIX + roomId;
    }
}
