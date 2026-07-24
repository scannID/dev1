package com.scanny.payment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.scanny.dto.PaymentDtos;
import com.scanny.entity.PaymentIntent;
import com.scanny.payment.PaymentContext;
import com.scanny.payment.PaymentIntentStatus;
import com.scanny.payment.PaymentProvider;
import com.scanny.payment.PaymentProviderRegistry;
import com.scanny.payment.config.PaymentProperties;
import com.scanny.payment.model.PaymentCommand;
import com.scanny.payment.model.PaymentProviderResult;
import com.scanny.repository.PaymentIntentRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PaymentGatewayServiceIdempotencyTest {

    @Mock
    private PaymentProviderRegistry registry;
    @Mock
    private PaymentIntentService paymentIntentService;
    @Mock
    private PaymentProperties properties;
    @Mock
    private PaymentProvider provider;
    @Mock
    private PaymentIntentRepository paymentIntentRepository;

    private PaymentGatewayService service;

    @BeforeEach
    void setUp() {
        service = new PaymentGatewayService(registry, paymentIntentService, properties, paymentIntentRepository);
    }

    @Test
    void initiateReturnsExistingIntentForIdempotencyKey() {
        PaymentIntent existing = sampleIntent(PaymentIntentStatus.Processing);
        existing.setIdempotencyKey("key-1");
        when(paymentIntentService.findByIdempotencyKey("key-1")).thenReturn(Optional.of(existing));
        when(paymentIntentService.toInitiateResponse(existing)).thenReturn(
                new PaymentDtos.InitiateResponse(existing.getId(), "stub", "", PaymentIntentStatus.Processing, "ok")
        );

        PaymentDtos.InitiateResponse response = service.initiate(sampleRequest(), "key-1");

        assertThat(response.paymentId()).isEqualTo(existing.getId());
        verify(registry, never()).resolve(any());
        verify(paymentIntentService, never()).createIntent(any(), any(), any());
    }

    @Test
    void initiateReusesActiveIntentForSameReference() {
        PaymentIntent existing = sampleIntent(PaymentIntentStatus.Pending);
        when(paymentIntentService.findReusableIntent(PaymentContext.ORDER, "ORD-1"))
                .thenReturn(Optional.of(existing));
        when(paymentIntentService.toInitiateResponse(existing)).thenReturn(
                new PaymentDtos.InitiateResponse(existing.getId(), "stub", "", PaymentIntentStatus.Pending, "ok")
        );

        PaymentDtos.InitiateResponse response = service.initiate(sampleRequest(), null);

        assertThat(response.paymentId()).isEqualTo(existing.getId());
        verify(registry, never()).resolve(any());
        verify(provider, never()).initiate(any());
    }

    @Test
    void initiateCreatesWhenNoReusableIntent() {
        PaymentIntent created = sampleIntent(PaymentIntentStatus.Pending);
        when(paymentIntentService.findByIdempotencyKey("key-2")).thenReturn(Optional.empty());
        when(paymentIntentService.findReusableIntent(PaymentContext.ORDER, "ORD-1"))
                .thenReturn(Optional.empty());
        when(registry.resolve("stub")).thenReturn(provider);
        when(provider.id()).thenReturn("stub");
        when(paymentIntentService.createIntent(eq("stub"), any(), eq("key-2"))).thenReturn(created);
        when(paymentIntentService.toCommand(created)).thenReturn(
                new PaymentCommand(
                        created.getId(), PaymentContext.ORDER, "ORD-1", 1000, "UGX", "0700", "", null, null, Instant.now(),
                        300, 700, 210, 490, 300, "+256700000000", "SCANNY-FEE"
                )
        );
        when(provider.initiate(any())).thenReturn(
                new PaymentProviderResult(PaymentIntentStatus.Processing, "PRV-1", "Approve on phone")
        );
        when(paymentIntentService.applyProviderResult(eq(created), any())).thenReturn(created);
        when(paymentIntentService.toInitiateResponse(created)).thenReturn(
                new PaymentDtos.InitiateResponse(created.getId(), "stub", "PRV-1", PaymentIntentStatus.Processing, "Approve on phone")
        );

        PaymentDtos.InitiateResponse response = service.initiate(sampleRequest(), "key-2");

        assertThat(response.paymentId()).isEqualTo(created.getId());
        verify(provider).initiate(any());
    }

    private static PaymentDtos.InitiateRequest sampleRequest() {
        return new PaymentDtos.InitiateRequest(
                PaymentContext.ORDER,
                "ORD-1",
                "stub",
                1000,
                "UGX",
                "0700123456",
                "Test",
                "biz-1",
                "Order"
        );
    }

    private static PaymentIntent sampleIntent(PaymentIntentStatus status) {
        PaymentIntent intent = new PaymentIntent();
        intent.setId("PAY-TEST123456");
        intent.setContext(PaymentContext.ORDER);
        intent.setReferenceId("ORD-1");
        intent.setProviderId("stub");
        intent.setAmount(1000);
        intent.setCurrency("UGX");
        intent.setStatus(status);
        intent.setCreatedAt(Instant.now());
        return intent;
    }
}
