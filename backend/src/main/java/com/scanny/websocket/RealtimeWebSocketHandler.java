package com.scanny.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.security.MerchantAccessService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RealtimeWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(RealtimeWebSocketHandler.class);

    private final ObjectMapper objectMapper;
    private final JwtDecoder jwtDecoder;
    private final MerchantAccessService merchantAccessService;
    private final long authTimeoutMs;
    private final Map<String, SessionState> sessions = new ConcurrentHashMap<>();

    public RealtimeWebSocketHandler(
            ObjectMapper objectMapper,
            JwtDecoder jwtDecoder,
            MerchantAccessService merchantAccessService,
            @Value("${scanny.websocket.auth-timeout-ms:5000}") long authTimeoutMs
    ) {
        this.objectMapper = objectMapper;
        this.jwtDecoder = jwtDecoder;
        this.merchantAccessService = merchantAccessService;
        this.authTimeoutMs = authTimeoutMs;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), new SessionState(session, System.currentTimeMillis()));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        SessionState state = sessions.get(session.getId());
        if (state == null) {
            return;
        }
        JsonNode node = objectMapper.readTree(message.getPayload());
        String type = node.path("type").asText("");
        if ("AUTH".equalsIgnoreCase(type)) {
            String token = node.path("token").asText(null);
            if (token == null || token.isBlank()) {
                session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Missing token"));
                return;
            }
            try {
                Jwt jwt = jwtDecoder.decode(token);
                state.authenticated = true;
                state.subject = jwt.getSubject();
                @SuppressWarnings("unchecked")
                Map<String, Object> realmAccess = jwt.getClaim("realm_access");
                if (realmAccess != null && realmAccess.get("roles") instanceof Iterable<?> roles) {
                    for (Object role : roles) {
                        state.roles.add(String.valueOf(role).toUpperCase());
                    }
                }
                session.sendMessage(new TextMessage("{\"type\":\"AUTH_OK\"}"));
            } catch (Exception ex) {
                session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid token"));
            }
            return;
        }
        if (!state.authenticated) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Authenticate first"));
            return;
        }
        if ("SUBSCRIBE".equalsIgnoreCase(type)) {
            String channel = node.path("channel").asText("");
            if (!canSubscribe(state, channel)) {
                session.sendMessage(new TextMessage("{\"type\":\"ERROR\",\"message\":\"Forbidden channel\"}"));
                return;
            }
            state.channels.add(channel);
            session.sendMessage(new TextMessage("{\"type\":\"SUBSCRIBED\",\"channel\":\"" + channel + "\"}"));
        }
    }

    public void fanOutLocal(String json) {
        try {
            JsonNode node = objectMapper.readTree(json);
            String channel = node.path("channel").asText("");
            TextMessage message = new TextMessage(json);
            long now = System.currentTimeMillis();
            sessions.values().removeIf(state -> {
                if (!state.session.isOpen()) {
                    return true;
                }
                if (!state.authenticated && now - state.connectedAt > authTimeoutMs) {
                    try {
                        state.session.close(CloseStatus.POLICY_VIOLATION.withReason("Auth timeout"));
                    } catch (IOException ignored) {
                    }
                    return true;
                }
                if (state.channels.contains(channel) || state.channels.contains("*")) {
                    try {
                        state.session.sendMessage(message);
                    } catch (IOException ex) {
                        return true;
                    }
                }
                return false;
            });
        } catch (Exception ex) {
            log.debug("fanOut failed", ex);
        }
    }

    private boolean canSubscribe(SessionState state, String channel) {
        if (channel == null || channel.isBlank()) {
            return false;
        }
        // Admins may observe any channel.
        if (state.roles.contains("ADMIN")) {
            return true;
        }
        if ("tickets:stats".equals(channel)) {
            return state.roles.contains("MERCHANT");
        }
        if (channel.startsWith("orders:") || channel.startsWith("catalog:") || channel.startsWith("metrics:")) {
            if (!state.roles.contains("MERCHANT")) {
                return false;
            }
            String businessId = channel.substring(channel.indexOf(':') + 1);
            UUID subject = parseSubject(state.subject);
            if (subject == null) {
                return false;
            }
            // A merchant may only subscribe to channels for businesses they own.
            return merchantAccessService.ownsBusinessBySubject(subject, businessId);
        }
        return false;
    }

    private UUID parseSubject(String subject) {
        if (subject == null || subject.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(subject);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static final class SessionState {
        private final WebSocketSession session;
        private final long connectedAt;
        private boolean authenticated;
        private String subject;
        private final Set<String> roles = ConcurrentHashMap.newKeySet();
        private final Set<String> channels = ConcurrentHashMap.newKeySet();

        private SessionState(WebSocketSession session, long connectedAt) {
            this.session = session;
            this.connectedAt = connectedAt;
        }
    }
}
