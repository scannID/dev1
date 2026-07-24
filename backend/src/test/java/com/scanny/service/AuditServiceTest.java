package com.scanny.service;

import com.scanny.entity.AuditEvent;
import com.scanny.repository.AuditEventRepository;
import com.scanny.security.ClientIpResolver;
import com.scanny.security.MerchantAccessService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuditServiceTest {

    @Test
    void recordsSanitizedEvent() {
        AuditEventRepository repo = mock(AuditEventRepository.class);
        MerchantAccessService access = mock(MerchantAccessService.class);
        when(access.actorId()).thenReturn("user-1");
        when(access.actorEmail()).thenReturn("merchant@scanny.app");
        when(access.correlationId()).thenReturn("corr-1");

        AuditService service = new AuditService(repo, access, new ClientIpResolver(false, ""), new ObjectMapper());
        service.success("ORDER_STATUS_UPDATE", "order", "ORD-1", Map.of("status", "Ready"));

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(repo).save(captor.capture());
        AuditEvent event = captor.getValue();
        assertEquals("ORDER_STATUS_UPDATE", event.getAction());
        assertEquals("order", event.getResourceType());
        assertEquals("ORD-1", event.getResourceId());
        assertEquals("SUCCESS", event.getOutcome());
        assertEquals("merchant@scanny.app", event.getActorEmail());
    }
}
