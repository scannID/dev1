package com.scanny.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class PlatformBroadcastDtos {

    private PlatformBroadcastDtos() {}

    public record PublishBroadcastRequest(
            String title,
            String body,
            String severity,
            Instant expiresAt
    ) {}

    public record AdminBroadcastItem(
            UUID id,
            String title,
            String body,
            String severity,
            String status,
            String createdBy,
            String createdByEmail,
            Instant createdAt,
            Instant publishedAt,
            Instant expiresAt
    ) {}

    public record AdminBroadcastListResponse(
            List<AdminBroadcastItem> broadcasts
    ) {}

    public record MerchantBroadcastItem(
            UUID id,
            String title,
            String body,
            String severity,
            Instant publishedAt,
            Instant expiresAt,
            boolean unread,
            boolean dismissed
    ) {}

    public record MerchantBroadcastListResponse(
            List<MerchantBroadcastItem> broadcasts,
            int unread
    ) {}
}
