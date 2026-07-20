package com.scanny.payment.model;

import com.scanny.payment.PaymentContext;
import java.time.Instant;

public record PaymentCommand(
    String paymentIntentId,
    PaymentContext context,
    String referenceId,
    int amount,
    String currency,
    String customerPhone,
    String customerName,
    String businessId,
    String description,
    Instant createdAt
) {}
