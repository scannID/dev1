package com.scanny.service;

import com.scanny.dto.PaymentDtos;
import com.scanny.dto.RentDtos;
import com.scanny.entity.PropertyViewPayment;
import com.scanny.entity.RentProperty;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.RentPaymentStatus;
import com.scanny.payment.PaymentContext;
import com.scanny.payment.service.PaymentGatewayService;
import com.scanny.repository.PropertyViewPaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Service for handling property viewing payments.
 * <p>
 * When a user scans a property QR code, they must pay a viewing fee (typically 2000 UGX)
 * before accessing vacant unit details and property manager contact info.
 */
@Service
public class PropertyViewPaymentService {

    private static final Logger log = LoggerFactory.getLogger(PropertyViewPaymentService.class);

    /**
     * Default viewing fee in UGX (can be made configurable later).
     */
    private static final long DEFAULT_VIEWING_FEE = 5000;

    private final PropertyViewPaymentRepository viewPaymentRepository;
    private final RentPropertyService propertyService;
    private final PaymentGatewayService paymentGatewayService;

    public PropertyViewPaymentService(
            PropertyViewPaymentRepository viewPaymentRepository,
            RentPropertyService propertyService,
            PaymentGatewayService paymentGatewayService) {
        this.viewPaymentRepository = viewPaymentRepository;
        this.propertyService = propertyService;
        this.paymentGatewayService = paymentGatewayService;
    }

    /**
     * Check if a viewer has already paid to access this property.
     */
    @Transactional(readOnly = true)
    public RentDtos.PropertyViewAccessResponse checkAccess(String propertyToken, String phone) {
        RentProperty property = propertyService.requirePropertyByToken(propertyToken);

        var existingPayment = viewPaymentRepository.findByProperty_IdAndViewerPhoneAndStatus(
                property.getId(),
                phone.trim(),
                RentPaymentStatus.Completed
        );

        if (existingPayment.isPresent()) {
            PropertyViewPayment payment = existingPayment.get();
            return new RentDtos.PropertyViewAccessResponse(
                    true,
                    "Access granted - payment already completed",
                    payment.getPaidAt(),
                    payment.getExpiresAt()
            );
        }

        return new RentDtos.PropertyViewAccessResponse(
                false,
                "Payment required to view property details",
                null,
                null
        );
    }

    /**
     * Initiate a property viewing payment.
     */
    @Transactional
    public RentDtos.InitiatePropertyViewPaymentResponse initiatePayment(
            String propertyToken,
            RentDtos.InitiatePropertyViewPaymentRequest request) {

        // 1. Resolve property
        RentProperty property = propertyService.requirePropertyByToken(propertyToken);

        // 2. Check if already paid
        String phone = request.phone().trim();
        var existingPayment = viewPaymentRepository.findByProperty_IdAndViewerPhoneAndStatus(
                property.getId(),
                phone,
                RentPaymentStatus.Completed
        );

        if (existingPayment.isPresent()) {
            // Already paid - return success without initiating new payment
            PropertyViewPayment payment = existingPayment.get();
            return new RentDtos.InitiatePropertyViewPaymentResponse(
                    true,
                    "You've already paid to view this property",
                    payment.getTransactionRef(),
                    null,
                    payment.getAmount(),
                    payment.getCurrency()
            );
        }

        // 3. Create pending payment record
        PropertyViewPayment payment = new PropertyViewPayment();
        payment.setProperty(property);
        payment.setViewerPhone(phone);
        payment.setAmount(DEFAULT_VIEWING_FEE);
        payment.setCurrency(property.getCurrency());
        payment.setStatus(RentPaymentStatus.Pending);

        String transactionRef = "PV-" + UUID.randomUUID();
        payment.setTransactionRef(transactionRef);

        payment = viewPaymentRepository.save(payment);
        log.info("[PropertyView] Created payment {} for property {} by {}", 
                transactionRef, property.getName(), phone);

        // 4. Call payment gateway
        PaymentDtos.InitiateResponse gatewayResponse;
        try {
            gatewayResponse = paymentGatewayService.initiate(new PaymentDtos.InitiateRequest(
                    PaymentContext.PROPERTY_VIEW,
                    transactionRef,
                    "MobileMoney",  // payment method as String
                    (int) DEFAULT_VIEWING_FEE,
                    property.getCurrency(),
                    phone,
                    "",  // customerName not required
                    null,  // businessId - no business entity
                    "Property Viewing Fee - " + property.getName()
            ));
        } catch (Exception e) {
            log.error("[PropertyView] Gateway error for {}: {}", transactionRef, e.getMessage());
            payment.setStatus(RentPaymentStatus.Failed);
            payment.setFailedAt(Instant.now());
            payment.setFailureReason(e.getMessage());
            viewPaymentRepository.save(payment);
            throw new ApiException(502, "Could not start payment: " + e.getMessage());
        }

        return new RentDtos.InitiatePropertyViewPaymentResponse(
                true,
                gatewayResponse.message(),
                transactionRef,
                gatewayResponse.paymentId(),
                DEFAULT_VIEWING_FEE,
                property.getCurrency()
        );
    }

    /**
     * Complete a property viewing payment (called by payment gateway callback).
     */
    @Transactional
    public void completePayment(String transactionRef) {
        PropertyViewPayment payment = viewPaymentRepository
                .findByTransactionRef(transactionRef)
                .orElseThrow(() -> new ApiException(404, "Property view payment not found"));

        if (payment.getStatus() == RentPaymentStatus.Completed) {
            log.warn("[PropertyView] Payment {} already completed", transactionRef);
            return;
        }

        payment.setStatus(RentPaymentStatus.Completed);
        payment.setPaidAt(Instant.now());
        payment.setUpdatedAt(Instant.now());

        viewPaymentRepository.save(payment);
        log.info("[PropertyView] Completed payment {} for property {} by {}",
                transactionRef,
                payment.getProperty().getName(),
                payment.getViewerPhone());
    }

    /**
     * Mark a property viewing payment as failed (called by payment gateway callback).
     */
    @Transactional
    public void failPayment(String transactionRef, String reason) {
        PropertyViewPayment payment = viewPaymentRepository
                .findByTransactionRef(transactionRef)
                .orElseThrow(() -> new ApiException(404, "Property view payment not found"));

        if (payment.getStatus() == RentPaymentStatus.Completed) {
            log.warn("[PropertyView] Cannot fail already-completed payment {}", transactionRef);
            return;
        }

        payment.setStatus(RentPaymentStatus.Failed);
        payment.setFailedAt(Instant.now());
        payment.setFailureReason(reason);
        payment.setUpdatedAt(Instant.now());

        viewPaymentRepository.save(payment);
        log.info("[PropertyView] Failed payment {} for property {}: {}",
                transactionRef,
                payment.getProperty().getName(),
                reason);
    }

    /**
     * Get payment status (for frontend polling).
     */
    @Transactional(readOnly = true)
    public RentDtos.PaymentStatusResponse getPaymentStatus(String transactionRef) {
        PropertyViewPayment payment = viewPaymentRepository
                .findByTransactionRef(transactionRef)
                .orElseThrow(() -> new ApiException(404, "Payment not found"));

        return new RentDtos.PaymentStatusResponse(
                payment.getTransactionRef(),
                payment.getStatus().name(),
                payment.getAmount(),
                payment.getCurrency(),
                payment.getPaidAt(),
                payment.getFailedAt(),
                payment.getFailureReason()
        );
    }
}
