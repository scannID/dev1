package com.scanny.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.security.MerchantAccessService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RealtimeWebSocketHandlerTest {

    private static final UUID SUBJECT = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final String OWNED_BUSINESS = "biz-owned";
    private static final String OTHER_BUSINESS = "biz-other";

    private Jwt merchantJwt() {
        return Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(SUBJECT.toString())
                .claim("realm_access", Map.of("roles", List.of("MERCHANT")))
                .build();
    }

    private WebSocketSession openSession(String id) throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        return session;
    }

    @Test
    void merchantMaySubscribeToOwnedBusinessButNotOthers() throws Exception {
        JwtDecoder decoder = mock(JwtDecoder.class);
        when(decoder.decode(any())).thenReturn(merchantJwt());

        MerchantAccessService access = mock(MerchantAccessService.class);
        when(access.ownsBusinessBySubject(eq(SUBJECT), eq(OWNED_BUSINESS))).thenReturn(true);
        when(access.ownsBusinessBySubject(eq(SUBJECT), eq(OTHER_BUSINESS))).thenReturn(false);

        RealtimeWebSocketHandler handler =
                new RealtimeWebSocketHandler(new ObjectMapper(), decoder, access, 5000);

        WebSocketSession session = openSession("s1");
        handler.afterConnectionEstablished(session);

        handler.handleTextMessage(session, new TextMessage("{\"type\":\"AUTH\",\"token\":\"t\"}"));
        handler.handleTextMessage(session,
                new TextMessage("{\"type\":\"SUBSCRIBE\",\"channel\":\"orders:" + OWNED_BUSINESS + "\"}"));
        handler.handleTextMessage(session,
                new TextMessage("{\"type\":\"SUBSCRIBE\",\"channel\":\"orders:" + OTHER_BUSINESS + "\"}"));

        ArgumentCaptor<TextMessage> sent = ArgumentCaptor.forClass(TextMessage.class);
        verify(session, org.mockito.Mockito.atLeastOnce()).sendMessage(sent.capture());

        List<String> payloads = sent.getAllValues().stream().map(TextMessage::getPayload).toList();
        assertTrue(payloads.stream().anyMatch(p -> p.contains("AUTH_OK")), "should acknowledge auth");
        assertTrue(payloads.stream().anyMatch(p -> p.contains("SUBSCRIBED") && p.contains(OWNED_BUSINESS)),
                "owned business subscription should be accepted");
        assertTrue(payloads.stream().anyMatch(p -> p.contains("ERROR") && p.contains("Forbidden")),
                "non-owned business subscription should be rejected");
    }
}
