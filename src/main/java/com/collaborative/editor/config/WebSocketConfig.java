package com.collaborative.editor.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * STOMP over WebSocket setup for the collaborative editor.
 * <p>
 * Clients connect to {@code /ws}, send messages prefixed with {@code /app}, and subscribe
 * to destinations under {@code /topic} (we use {@code /topic/room/{roomId}} per room).
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // In-memory broker for subscriptions (simple broker is fine for MVP; swap for Rabbit/Kafka relay later).
        registry.enableSimpleBroker("/topic");
        // Client @MessageMapping endpoints are reached via /app/...
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Raw WebSocket endpoint (e.g. modern browsers / native clients)
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");

        // SockJS fallback for browsers / proxies that block WebSocket upgrade
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
