package com.collaborative.editor;

import com.collaborative.editor.model.dto.CodeUpdatePayload;
import com.collaborative.editor.model.dto.JoinRoomPayload;
import com.collaborative.editor.model.dto.RoomEventKind;
import com.collaborative.editor.model.dto.RoomEventPayload;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CollaborationWebSocketIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void joinBroadcastsSnapshotAndCodeSyncBroadcastsUpdate() throws Exception {
        WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new MappingJackson2MessageConverter());

        String wsUrl = "ws://127.0.0.1:" + port + "/ws";
        StompSession session = stompClient
                .connectAsync(wsUrl, new StompSessionHandlerAdapter() {})
                .get(10, TimeUnit.SECONDS);

        BlockingQueue<RoomEventPayload> messages = new LinkedBlockingQueue<>();
        session.subscribe("/topic/room/demo-room", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return RoomEventPayload.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                messages.offer((RoomEventPayload) payload);
            }
        });

        ResponseEntity<Void> createResp = restTemplate.postForEntity(
            "http://127.0.0.1:" + port + "/api/rooms/demo-room",
            null,
            Void.class);
        assertThat(createResp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        session.send("/app/join-room", new JoinRoomPayload("demo-room", "alice-1", "alice"));

        RoomEventPayload afterJoin = awaitKind(messages, RoomEventKind.SNAPSHOT, 5);
        assertThat(afterJoin).isNotNull();
        assertThat(afterJoin.kind()).isEqualTo(RoomEventKind.SNAPSHOT);
        assertThat(afterJoin.roomId()).isEqualTo("demo-room");
        assertThat(afterJoin.userId()).isEqualTo("alice-1");
        assertThat(afterJoin.content()).isEmpty();
        assertThat(afterJoin.users()).isNotNull();
        assertThat(afterJoin.users()).hasSize(1);
        assertThat(afterJoin.users().get(0).userName()).isEqualTo("alice");

        awaitKind(messages, RoomEventKind.USER_LIST, 5);
        awaitKind(messages, RoomEventKind.CHAT_HISTORY, 5);

        session.send("/app/code-sync", new CodeUpdatePayload("demo-room", "public class Demo {}", "alice-1"));

        RoomEventPayload afterEdit = awaitKind(messages, RoomEventKind.CODE_SYNC, 5);
        assertThat(afterEdit).isNotNull();
        assertThat(afterEdit.kind()).isEqualTo(RoomEventKind.CODE_SYNC);
        assertThat(afterEdit.content()).isEqualTo("public class Demo {}");

        session.disconnect();
    }

    @Test
    void apiDeleteRoomBroadcastsDeletionEventToTopic() throws Exception {
        WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new MappingJackson2MessageConverter());

        String wsUrl = "ws://127.0.0.1:" + port + "/ws";
        StompSession session = stompClient
                .connectAsync(wsUrl, new StompSessionHandlerAdapter() {})
                .get(10, TimeUnit.SECONDS);

        BlockingQueue<RoomEventPayload> messages = new LinkedBlockingQueue<>();
        session.subscribe("/topic/room/delete-me", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return RoomEventPayload.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                messages.offer((RoomEventPayload) payload);
            }
        });

        ResponseEntity<Void> createResp = restTemplate.postForEntity(
            "http://127.0.0.1:" + port + "/api/rooms/delete-me",
            null,
            Void.class);
        assertThat(createResp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        session.send("/app/join-room", new JoinRoomPayload("delete-me", "bob-1", "bob"));

        RoomEventPayload joinEv = awaitKind(messages, RoomEventKind.SNAPSHOT, 5);
        assertThat(joinEv).isNotNull();
        assertThat(joinEv.kind()).isEqualTo(RoomEventKind.SNAPSHOT);

        ResponseEntity<Void> resp = restTemplate.exchange(
                "http://127.0.0.1:" + port + "/api/rooms/delete-me?userId=bob-1",
                HttpMethod.DELETE,
                null,
                Void.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        awaitKind(messages, RoomEventKind.USER_LIST, 5);
        awaitKind(messages, RoomEventKind.CHAT_HISTORY, 5);

        RoomEventPayload deleted = awaitKind(messages, RoomEventKind.ROOM_DELETED, 5);
        assertThat(deleted).isNotNull();
        assertThat(deleted.kind()).isEqualTo(RoomEventKind.ROOM_DELETED);
        assertThat(deleted.roomId()).isEqualTo("delete-me");

        session.disconnect();
    }

    @Test
    void secondJoinerReceivesExistingCodeInSnapshot() throws Exception {
        WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new MappingJackson2MessageConverter());

        String wsUrl = "ws://127.0.0.1:" + port + "/ws";

        StompSession firstSession = stompClient
                .connectAsync(wsUrl, new StompSessionHandlerAdapter() {})
                .get(10, TimeUnit.SECONDS);

        BlockingQueue<RoomEventPayload> firstMessages = new LinkedBlockingQueue<>();
        firstSession.subscribe("/topic/room/snapshot-room", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return RoomEventPayload.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                firstMessages.offer((RoomEventPayload) payload);
            }
        });

        ResponseEntity<Void> createResp = restTemplate.postForEntity(
                "http://127.0.0.1:" + port + "/api/rooms/snapshot-room",
                null,
                Void.class);
        assertThat(createResp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        firstSession.send("/app/join-room", new JoinRoomPayload("snapshot-room", "alice-1", "alice"));

        awaitKind(firstMessages, RoomEventKind.SNAPSHOT, 5);
        awaitKind(firstMessages, RoomEventKind.USER_LIST, 5);
        awaitKind(firstMessages, RoomEventKind.CHAT_HISTORY, 5);

        String existingCode = "function greet(){ return 'hello'; }";
        firstSession.send("/app/code-sync", new CodeUpdatePayload("snapshot-room", existingCode, "alice-1"));

        RoomEventPayload afterEdit = awaitKind(firstMessages, RoomEventKind.CODE_SYNC, 5);
        assertThat(afterEdit).isNotNull();
        assertThat(afterEdit.content()).isEqualTo(existingCode);

        StompSession secondSession = stompClient
                .connectAsync(wsUrl, new StompSessionHandlerAdapter() {})
                .get(10, TimeUnit.SECONDS);

        BlockingQueue<RoomEventPayload> secondMessages = new LinkedBlockingQueue<>();
        secondSession.subscribe("/topic/room/snapshot-room", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return RoomEventPayload.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                secondMessages.offer((RoomEventPayload) payload);
            }
        });

        secondSession.send("/app/join-room", new JoinRoomPayload("snapshot-room", "bob-1", "bob"));

        RoomEventPayload secondSnapshot = awaitKind(secondMessages, RoomEventKind.SNAPSHOT, 5);
        assertThat(secondSnapshot).isNotNull();
        assertThat(secondSnapshot.content()).isEqualTo(existingCode);
        assertThat(secondSnapshot.users()).isNotNull();
        assertThat(secondSnapshot.users()).extracting("userName").contains("alice", "bob");

        secondSession.disconnect();
        firstSession.disconnect();
    }

    private static RoomEventPayload awaitKind(
            BlockingQueue<RoomEventPayload> messages,
            RoomEventKind kind,
            int timeoutSeconds) throws InterruptedException {
        long deadlineNanos = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeoutSeconds);
        while (System.nanoTime() < deadlineNanos) {
            long remainingMillis = TimeUnit.NANOSECONDS.toMillis(deadlineNanos - System.nanoTime());
            if (remainingMillis <= 0) {
                break;
            }

            RoomEventPayload payload = messages.poll(remainingMillis, TimeUnit.MILLISECONDS);
            if (payload == null) {
                break;
            }
            if (payload.kind() == kind) {
                return payload;
            }
        }
        return null;
    }
}
