package com.scanny.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.entity.AuditEvent;
import com.scanny.repository.AuditEventRepository;
import com.scanny.security.MerchantAccessService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.util.Map;

@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditEventRepository auditEventRepository;
    private final MerchantAccessService merchantAccessService;
    private final ObjectMapper objectMapper;

    public AuditService(
            AuditEventRepository auditEventRepository,
            MerchantAccessService merchantAccessService,
            ObjectMapper objectMapper
    ) {
        this.auditEventRepository = auditEventRepository;
        this.merchantAccessService = merchantAccessService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void record(String action, String resourceType, String resourceId, String outcome, Map<String, ?> metadata) {
        AuditEvent event = new AuditEvent();
        event.setOccurredAt(Instant.now());
        event.setActorId(merchantAccessService.actorId());
        event.setActorEmail(merchantAccessService.actorEmail());
        event.setAction(action);
        event.setResourceType(resourceType);
        event.setResourceId(resourceId);
        event.setOutcome(outcome != null ? outcome : "SUCCESS");
        event.setCorrelationId(merchantAccessService.correlationId());
        event.setClientIp(resolveClientIp());
        event.setMetadata(sanitizeMetadata(metadata));
        auditEventRepository.save(event);
        log.info("audit action={} resourceType={} resourceId={} outcome={} actor={}",
                action, resourceType, resourceId, event.getOutcome(), event.getActorEmail());
    }

    @Transactional
    public void success(String action, String resourceType, String resourceId, Map<String, ?> metadata) {
        record(action, resourceType, resourceId, "SUCCESS", metadata);
    }

    @Transactional(readOnly = true)
    public Page<AuditEvent> list(int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 200);
        return auditEventRepository.findAllByOrderByOccurredAtDesc(PageRequest.of(safePage, safeSize));
    }

    private String sanitizeMetadata(Map<String, ?> metadata) {
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException e) {
            return "{\"note\":\"metadata_serialization_failed\"}";
        }
    }

    private String resolveClientIp() {
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) {
                return null;
            }
            HttpServletRequest request = attrs.getRequest();
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.split(",")[0].trim();
            }
            return request.getRemoteAddr();
        } catch (Exception ex) {
            return null;
        }
    }
}
