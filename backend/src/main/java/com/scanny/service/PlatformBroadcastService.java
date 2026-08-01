package com.scanny.service;

import com.scanny.dto.PlatformBroadcastDtos;
import com.scanny.entity.PlatformBroadcast;
import com.scanny.entity.PlatformBroadcastAck;
import com.scanny.exception.ApiException;
import com.scanny.repository.PlatformBroadcastAckRepository;
import com.scanny.repository.PlatformBroadcastRepository;
import com.scanny.security.MerchantAccessService;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformBroadcastService {

    private static final Set<String> SEVERITIES = Set.of("INFO", "WARNING", "CRITICAL");

    private final PlatformBroadcastRepository broadcastRepository;
    private final PlatformBroadcastAckRepository ackRepository;
    private final MerchantAccessService merchantAccessService;
    private final AuditService auditService;

    public PlatformBroadcastService(
            PlatformBroadcastRepository broadcastRepository,
            PlatformBroadcastAckRepository ackRepository,
            MerchantAccessService merchantAccessService,
            AuditService auditService
    ) {
        this.broadcastRepository = broadcastRepository;
        this.ackRepository = ackRepository;
        this.merchantAccessService = merchantAccessService;
        this.auditService = auditService;
    }

    @Transactional
    public PlatformBroadcastDtos.AdminBroadcastItem publish(PlatformBroadcastDtos.PublishBroadcastRequest request) {
        String title = request.title() == null ? "" : request.title().trim();
        String body = request.body() == null ? "" : request.body().trim();
        if (title.isBlank()) {
            throw new ApiException(400, "Title is required.");
        }
        if (title.length() > 120) {
            throw new ApiException(400, "Title must be 120 characters or fewer.");
        }
        if (body.isBlank()) {
            throw new ApiException(400, "Message body is required.");
        }
        String severity = normalizeSeverity(request.severity());
        Instant expiresAt = request.expiresAt();
        if (expiresAt != null && !expiresAt.isAfter(Instant.now())) {
            throw new ApiException(400, "Expiry must be in the future.");
        }

        PlatformBroadcast broadcast = new PlatformBroadcast();
        broadcast.setTitle(title);
        broadcast.setBody(body);
        broadcast.setSeverity(severity);
        broadcast.setStatus("PUBLISHED");
        broadcast.setCreatedBy(merchantAccessService.actorId());
        broadcast.setCreatedByEmail(merchantAccessService.actorEmail());
        broadcast.setCreatedAt(Instant.now());
        broadcast.setPublishedAt(Instant.now());
        broadcast.setExpiresAt(expiresAt);

        PlatformBroadcast saved = broadcastRepository.save(broadcast);
        auditService.success(
                "BROADCAST_PUBLISH",
                "broadcast",
                saved.getId().toString(),
                Map.of("severity", severity, "title", title)
        );
        return toAdminItem(saved);
    }

    @Transactional(readOnly = true)
    public PlatformBroadcastDtos.AdminBroadcastListResponse listAdmin() {
        List<PlatformBroadcastDtos.AdminBroadcastItem> items = broadcastRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toAdminItem)
                .toList();
        return new PlatformBroadcastDtos.AdminBroadcastListResponse(items);
    }

    @Transactional
    public PlatformBroadcastDtos.AdminBroadcastItem revoke(UUID id) {
        PlatformBroadcast broadcast = broadcastRepository.findById(id)
                .orElseThrow(() -> new ApiException(404, "Broadcast was not found."));
        if (!"PUBLISHED".equals(broadcast.getStatus())) {
            throw new ApiException(400, "Only published broadcasts can be revoked.");
        }
        broadcast.setStatus("REVOKED");
        PlatformBroadcast saved = broadcastRepository.save(broadcast);
        auditService.success(
                "BROADCAST_REVOKE",
                "broadcast",
                saved.getId().toString(),
                Map.of("title", saved.getTitle())
        );
        return toAdminItem(saved);
    }

    @Transactional(readOnly = true)
    public PlatformBroadcastDtos.MerchantBroadcastListResponse listForMerchant() {
        String userId = requireMerchantUserId();
        Instant now = Instant.now();
        List<PlatformBroadcast> active = broadcastRepository.findActivePublished(now);
        Set<UUID> ids = active.stream().map(PlatformBroadcast::getId).collect(Collectors.toCollection(HashSet::new));
        Map<UUID, PlatformBroadcastAck> acks = ids.isEmpty()
                ? Map.of()
                : ackRepository.findByUserIdAndBroadcastIdIn(userId, ids).stream()
                        .collect(Collectors.toMap(PlatformBroadcastAck::getBroadcastId, a -> a, (a, b) -> a));

        List<PlatformBroadcastDtos.MerchantBroadcastItem> items = active.stream()
                .map(b -> {
                    PlatformBroadcastAck ack = acks.get(b.getId());
                    boolean dismissed = ack != null && ack.getDismissedAt() != null;
                    boolean unread = ack == null || ack.getReadAt() == null;
                    return new PlatformBroadcastDtos.MerchantBroadcastItem(
                            b.getId(),
                            b.getTitle(),
                            b.getBody(),
                            b.getSeverity(),
                            b.getPublishedAt(),
                            b.getExpiresAt(),
                            unread,
                            dismissed
                    );
                })
                .toList();

        int unread = (int) items.stream().filter(i -> i.unread() && !i.dismissed()).count();
        return new PlatformBroadcastDtos.MerchantBroadcastListResponse(items, unread);
    }

    @Transactional
    public void markRead(UUID broadcastId) {
        String userId = requireMerchantUserId();
        requireActivePublished(broadcastId);
        PlatformBroadcastAck ack = ackRepository.findByBroadcastIdAndUserId(broadcastId, userId)
                .orElseGet(() -> {
                    PlatformBroadcastAck created = new PlatformBroadcastAck();
                    created.setBroadcastId(broadcastId);
                    created.setUserId(userId);
                    return created;
                });
        if (ack.getReadAt() == null) {
            ack.setReadAt(Instant.now());
        }
        ackRepository.save(ack);
    }

    @Transactional
    public void dismiss(UUID broadcastId) {
        String userId = requireMerchantUserId();
        requireActivePublished(broadcastId);
        PlatformBroadcastAck ack = ackRepository.findByBroadcastIdAndUserId(broadcastId, userId)
                .orElseGet(() -> {
                    PlatformBroadcastAck created = new PlatformBroadcastAck();
                    created.setBroadcastId(broadcastId);
                    created.setUserId(userId);
                    return created;
                });
        Instant now = Instant.now();
        if (ack.getReadAt() == null) {
            ack.setReadAt(now);
        }
        ack.setDismissedAt(now);
        ackRepository.save(ack);
    }

    private PlatformBroadcast requireActivePublished(UUID broadcastId) {
        PlatformBroadcast broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new ApiException(404, "Broadcast was not found."));
        if (!"PUBLISHED".equals(broadcast.getStatus())) {
            throw new ApiException(404, "Broadcast was not found.");
        }
        if (broadcast.getExpiresAt() != null && !broadcast.getExpiresAt().isAfter(Instant.now())) {
            throw new ApiException(404, "Broadcast has expired.");
        }
        return broadcast;
    }

    private String requireMerchantUserId() {
        merchantAccessService.requireCurrentMerchant();
        String actorId = merchantAccessService.actorId();
        if (actorId == null || actorId.isBlank() || "anonymous".equals(actorId)) {
            throw new ApiException(401, "Authentication required.");
        }
        return actorId;
    }

    private String normalizeSeverity(String raw) {
        String severity = raw == null || raw.isBlank() ? "INFO" : raw.trim().toUpperCase(Locale.ROOT);
        if (!SEVERITIES.contains(severity)) {
            throw new ApiException(400, "Severity must be INFO, WARNING, or CRITICAL.");
        }
        return severity;
    }

    private PlatformBroadcastDtos.AdminBroadcastItem toAdminItem(PlatformBroadcast b) {
        return new PlatformBroadcastDtos.AdminBroadcastItem(
                b.getId(),
                b.getTitle(),
                b.getBody(),
                b.getSeverity(),
                b.getStatus(),
                b.getCreatedBy(),
                b.getCreatedByEmail(),
                b.getCreatedAt(),
                b.getPublishedAt(),
                b.getExpiresAt()
        );
    }
}
