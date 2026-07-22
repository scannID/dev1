package com.scanny.repository;

import com.scanny.entity.PaymentIntent;
import com.scanny.payment.PaymentContext;
import com.scanny.payment.PaymentIntentStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentIntentRepository extends JpaRepository<PaymentIntent, String> {

    List<PaymentIntent> findByContextAndReferenceIdOrderByCreatedAtDesc(PaymentContext context, String referenceId);

    Optional<PaymentIntent> findTopByContextAndReferenceIdOrderByCreatedAtDesc(PaymentContext context, String referenceId);

    Optional<PaymentIntent> findByIdempotencyKey(String idempotencyKey);

    Optional<PaymentIntent> findTopByContextAndReferenceIdAndStatusInOrderByCreatedAtDesc(
            PaymentContext context,
            String referenceId,
            Collection<PaymentIntentStatus> statuses
    );
}
