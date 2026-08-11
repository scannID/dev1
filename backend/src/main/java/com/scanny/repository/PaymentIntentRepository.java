package com.scanny.repository;
import com.scanny.entity.PaymentIntent;
import com.scanny.payment.PaymentContext;
import com.scanny.payment.PaymentIntentStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface PaymentIntentRepository extends JpaRepository<PaymentIntent, String> {
    List<PaymentIntent> findByContextAndReferenceIdOrderByCreatedAtDesc(PaymentContext context, String referenceId);
    Optional<PaymentIntent> findTopByContextAndReferenceIdOrderByCreatedAtDesc(PaymentContext context, String referenceId);
    Optional<PaymentIntent> findByIdempotencyKey(String idempotencyKey);
    Optional<PaymentIntent> findTopByContextAndReferenceIdAndStatusInOrderByCreatedAtDesc(
            PaymentContext context,
            String referenceId,
            Collection<PaymentIntentStatus> statuses
    );
    Optional<PaymentIntent> findByProviderReference(String providerReference);

    /** All payment intents for a given business, newest first. */
    Page<PaymentIntent> findByBusinessIdOrderByCreatedAtDesc(String businessId, Pageable pageable);

    long countByBusinessId(String businessId);

    @Query("SELECT COUNT(p) FROM PaymentIntent p WHERE p.businessId = :businessId AND p.status = :status")
    long countByBusinessIdAndStatus(@Param("businessId") String businessId,
                                    @Param("status") PaymentIntentStatus status);

    @Query("SELECT COALESCE(SUM(p.merchantPayout), 0) FROM PaymentIntent p WHERE p.businessId = :businessId AND p.status = :status")
    long sumMerchantPayoutByBusinessIdAndStatus(@Param("businessId") String businessId,
                                                @Param("status") PaymentIntentStatus status);

    @Query("SELECT COALESCE(SUM(p.platformFee), 0) FROM PaymentIntent p WHERE p.businessId = :businessId AND p.status = :status")
    long sumPlatformFeeByBusinessIdAndStatus(@Param("businessId") String businessId,
                                             @Param("status") PaymentIntentStatus status);
}
