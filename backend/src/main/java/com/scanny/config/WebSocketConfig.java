package com.scanny.config;

import com.scanny.websocket.RealtimeWebSocketHandler;
import com.scanny.websocket.TicketStatsWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.Arrays;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final TicketStatsWebSocketHandler ticketStatsWebSocketHandler;
    private final RealtimeWebSocketHandler realtimeWebSocketHandler;
    private final String allowedOriginPatterns;

    public WebSocketConfig(
            TicketStatsWebSocketHandler ticketStatsWebSocketHandler,
            RealtimeWebSocketHandler realtimeWebSocketHandler,
            @Value("${scanny.cors.allowed-origin-patterns}") String allowedOriginPatterns
    ) {
        this.ticketStatsWebSocketHandler = ticketStatsWebSocketHandler;
        this.realtimeWebSocketHandler = realtimeWebSocketHandler;
        this.allowedOriginPatterns = allowedOriginPatterns;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        String[] origins = Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);

        registry.addHandler(ticketStatsWebSocketHandler, "/ws/tickets/stats")
                .setAllowedOriginPatterns(origins);
        registry.addHandler(realtimeWebSocketHandler, "/ws/realtime")
                .setAllowedOriginPatterns(origins);
    }
}
