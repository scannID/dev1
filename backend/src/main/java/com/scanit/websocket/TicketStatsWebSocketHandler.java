package com.scanit.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanit.dto.TicketDtos;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TicketStatsWebSocketHandler extends TextWebSocketHandler {

    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
    }

    public void broadcastTicketStats(List<TicketDtos.TicketEventStats> stats) {
        if (sessions.isEmpty()) {
            return;
        }

        TicketDtos.TicketStatsUpdate update = new TicketDtos.TicketStatsUpdate("TICKET_STATS_UPDATED", stats);
        try {
            String payload = objectMapper.writeValueAsString(update);
            TextMessage message = new TextMessage(payload);
            sessions.removeIf(session -> !session.isOpen());
            for (WebSocketSession session : sessions) {
                try {
                    session.sendMessage(message);
                } catch (IOException ignored) {
                    sessions.remove(session);
                }
            }
        } catch (Exception ignored) {
            // Keep WebSocket failures from affecting ticket flows.
        }
    }
}
