package com.scanit.config;

import com.scanit.websocket.TicketStatsWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final TicketStatsWebSocketHandler ticketStatsWebSocketHandler;

    public WebSocketConfig(TicketStatsWebSocketHandler ticketStatsWebSocketHandler) {
        this.ticketStatsWebSocketHandler = ticketStatsWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(ticketStatsWebSocketHandler, "/ws/tickets/stats")
            .setAllowedOrigins(
                "http://localhost:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:5174",
                "https://scanit.app"
            );
    }
}
