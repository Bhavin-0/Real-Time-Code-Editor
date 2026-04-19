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

        session.send("/app/join-room", new JoinRoomPayload("demo-room", "alice-1", "alice"));

        RoomEventPayload afterJoin = messages.poll(5, TimeUnit.SECONDS);
        assertThat(afterJoin).isNotNull();
        assertThat(afterJoin.kind()).isEqualTo(RoomEventKind.SNAPSHOT);
        assertThat(afterJoin.roomId()).isEqualTo("demo-room");
        assertThat(afterJoin.userId()).isEqualTo("alice-1");
        assertThat(afterJoin.content()).isEmpty();
        assertThat(afterJoin.users()).isNotNull();
        assertThat(afterJoin.users()).hasSize(1);
        assertThat(afterJoin.users().get(0).userName()).isEqualTo("alice");

        // Consume USER_JOINED and USER_LIST emitted after snapshot.
        messages.poll(5, TimeUnit.SECONDS);
        messages.poll(5, TimeUnit.SECONDS);

        session.send("/app/code-sync", new CodeUpdatePayload("demo-room", "public class Demo {}", "alice-1"));

        RoomEventPayload afterEdit = messages.poll(5, TimeUnit.SECONDS);
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

        session.send("/app/join-room", new JoinRoomPayload("delete-me", "bob-1", "bob"));

        RoomEventPayload joinEv = messages.poll(5, TimeUnit.SECONDS);
        assertThat(joinEv).isNotNull();
        assertThat(joinEv.kind()).isEqualTo(RoomEventKind.SNAPSHOT);

        ResponseEntity<Void> resp = restTemplate.exchange(
                "http://127.0.0.1:" + port + "/api/rooms/delete-me?userId=bob-1",
                HttpMethod.DELETE,
                null,
                Void.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

            // Consume USER_JOINED and USER_LIST emitted after snapshot.
            messages.poll(5, TimeUnit.SECONDS);
            messages.poll(5, TimeUnit.SECONDS);

        RoomEventPayload deleted = messages.poll(5, TimeUnit.SECONDS);
        assertThat(deleted).isNotNull();
        assertThat(deleted.kind()).isEqualTo(RoomEventKind.ROOM_DELETED);
        assertThat(deleted.roomId()).isEqualTo("delete-me");

        session.disconnect();
    }
}
