package com.scanny.payment.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.dto.PaymentDtos;
import com.scanny.entity.PaymentIntent;
import com.scanny.entity.QuickPaymentCode;
import com.scanny.entity.QuickPaymentTransaction;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.TransactionStatus;
import com.scanny.payment.PaymentContext;
import com.scanny.payment.PaymentIntentStatus;
import com.scanny.payment.config.PaymentProperties;
import com.scanny.payment.model.FeeSplit;
import com.scanny.payment.model.PaymentCommand;
import com.scanny.payment.model.PaymentProviderResult;
import com.scanny.repository.PaymentIntentRepository;
import com.scanny.repository.QuickPaymentCodeRepository;
import com.scanny.repository.QuickPaymentTransactionRepository;
import com.scanny.service.FeeService;
import com.scanny.service.OrderService;
import com.scanny.service.OutboxService;
import com.scanny.service.TableService;
import com.scanny.service.TicketPurchaseService;
import com.scanny.entity.Order;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentIntentService {

    private static final Logger logger = LoggerFactory.getLogger(PaymentIntentService.class);

    private final PaymentIntentRepository paymentIntentRepository;
    private final OrderService orderService;
    private final QuickPaymentTransactionRepository quickPaymentTransactionRepository;
    private final QuickPaymentCodeRepository quickPaymentCodeRepository;
    private final ObjectMapper objectMapper;
    private final TicketPurchaseService ticketPurchaseService;
    private final OutboxService outboxService;
    private final FeeService feeService;
    private final PaymentProperties paymentProperties;
    private final TableService tableService;

    public PaymentIntentService(
            PaymentIntentRepository paymentIntentRepository,
            OrderService orderService,
            QuickPaymentTransactionRepository quickPaymentTransactionRepository,
            QuickPaymentCodeRepository quickPaymentCodeRepository,
            ObjectMapper objectMapper,
            TicketPurchaseService ticketPurchaseService,
            OutboxService outboxService,
            FeeService feeService,
            PaymentProperties paymentProperties,
            TableService tableService) {
        this.paymentIntentRepository = paymentIntentRepository;
        this.orderService = orderService;
        this.quickPaymentTransactionRepository = quickPaymentTransactionRepository;
        this.quickPaymentCodeRepository = quickPaymentCodeRepository;
        this.objectMapper = objectMapper;
        this.ticketPurchaseService = ticketPurchaseService;
        this.outboxService = outboxService;
        this.feeService = feeService;
        this.paymentProperties = paymentProperties;
        this.tableService = tableService;
    }

    @Transactional
    public PaymentIntent createIntent(String providerId, PaymentDtos.InitiateRequest request, String idempotencyKey) {
        PaymentIntent intent = new PaymentIntent();
        intent.setId(generatePaymentId());
        intent.setContext(request.context());
        intent.setReferenceId(request.referenceId());
        intent.setProviderId(providerId);
        intent.setAmount(request.amount());
        intent.setCurrency(request.currency() != null && !request.currency().isBlank() ? request.currency() : "UGX");
        intent.setCustomerPhone(request.customerPhone().trim());
        intent.setCustomerName(nullToEmpty(request.customerName()));
        intent.setBusinessId(request.businessId());
        intent.setIdempotencyKey(blankToNull(idempotencyKey));
        intent.setStatus(PaymentIntentStatus.Pending);
        intent.setCreatedAt(Instant.now());
        intent.setScannyFeeDestination(nullToEmpty(paymentProperties.getScannyFeeDestination()));
        applyFeeSplit(intent, request);
        return paymentIntentRepository.save(intent);
    }

    private void applyFeeSplit(PaymentIntent intent, PaymentDtos.InitiateRequest request) {
        if (request.context() == PaymentContext.ORDER) {
            Order order = orderService.requireOrderForPayment(request.referenceId());
            intent.setAmount(order.getTotal());
            intent.setSubtotal(order.getSubtotal());
            intent.setServiceFee(order.getServiceFee());
            intent.setPsoFee(order.getPsoFee());
            intent.setPlatformFee(order.getPlatformFee());
            intent.setMerchantPayout(order.getMerchantPayout());
            intent.setMerchantMomoDestination(order.getMerchantMomoDestination());
            intent.setBusinessId(order.getBusiness().getId());
            return;
        }
        if (request.context() == PaymentContext.ORDER_SPLIT) {
            var split = tableService.requireUnpaidSplit(request.referenceId());
            Order order = orderService.requireOrderForPayment(split.getOrderId());
            intent.setAmount(split.getAmount());
            intent.setSubtotal(split.getAmount());
            intent.setServiceFee(0);
            intent.setPsoFee(0);
            intent.setPlatformFee(0);
            intent.setMerchantPayout(split.getAmount());
            intent.setMerchantMomoDestination(order.getMerchantMomoDestination());
            intent.setBusinessId(order.getBusiness().getId());
            return;
        }
        // Non-order contexts: treat full amount as merchant payout until those flows get fee rules.
        int amount = Math.max(request.amount(), 0);
        FeeSplit fees = feeService.split(amount, 0);
        intent.setSubtotal(fees.subtotal());
        intent.setServiceFee(0);
        intent.setPsoFee(0);
        intent.setPlatformFee(0);
        intent.setMerchantPayout(amount);
        intent.setMerchantMomoDestination("");
    }

    @Transactional(readOnly = true)
    public Optional<PaymentIntent> findByIdempotencyKey(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return Optional.empty();
        }
        return paymentIntentRepository.findByIdempotencyKey(idempotencyKey.trim());
    }

    @Transactional(readOnly = true)
    public Optional<PaymentIntent> findReusableIntent(PaymentContext context, String referenceId) {
        return paymentIntentRepository.findTopByContextAndReferenceIdAndStatusInOrderByCreatedAtDesc(
                context,
                referenceId,
                List.of(PaymentIntentStatus.Pending, PaymentIntentStatus.Processing, PaymentIntentStatus.Paid)
        );
    }

    @Transactional
    public PaymentIntent applyProviderResult(PaymentIntent intent, PaymentProviderResult result) {
        if (result.providerReference() != null && !result.providerReference().isBlank()) {
            intent.setProviderReference(result.providerReference());
        }
        if (result.customerMessage() != null && !result.customerMessage().isBlank()) {
            intent.setCustomerMessage(result.customerMessage());
        }
        if (result.metadata() != null && !result.metadata().isEmpty()) {
            intent.setMetadata(writeMetadata(result.metadata()));
        }
        return applyStatusChange(intent, result.status(), result.failureReason());
    }

    @Transactional
    public PaymentIntent applyStatusChange(
            PaymentIntent intent,
            PaymentIntentStatus newStatus,
            String failureReason) {

        PaymentIntentStatus oldStatus = intent.getStatus();
        if (oldStatus == newStatus && (failureReason == null || failureReason.isBlank())) {
            return intent;
        }

        intent.setStatus(newStatus);
        intent.setUpdatedAt(Instant.now());

        if (newStatus == PaymentIntentStatus.Paid && oldStatus != PaymentIntentStatus.Paid) {
            intent.setCompletedAt(Instant.now());
            PaymentIntent saved = paymentIntentRepository.save(intent);
            outboxService.enqueuePaymentPaid(saved.getId());
            return saved;
        } else if ((newStatus == PaymentIntentStatus.Failed || newStatus == PaymentIntentStatus.Cancelled)
                && oldStatus != newStatus) {
            intent.setFailedAt(Instant.now());
            intent.setFailureReason(failureReason);
            // Free unique idempotency key so a later retry can reuse split:{id}.
            intent.setIdempotencyKey(null);
            onFailed(intent, failureReason);
        }

        return paymentIntentRepository.save(intent);
    }

    @Transactional
    public void clearIdempotencyKey(PaymentIntent intent) {
        if (intent.getIdempotencyKey() == null) {
            return;
        }
        intent.setIdempotencyKey(null);
        paymentIntentRepository.save(intent);
    }

    /** Runs order / quick-pay / ticket side effects after intent is marked Paid (via outbox). */
    @Transactional
    public void applyPaidSideEffects(PaymentIntent intent) {
        onPaid(intent);
    }

    @Transactional(readOnly = true)
    public PaymentIntent requireIntent(String paymentId) {
        return paymentIntentRepository.findById(paymentId)
            .orElseThrow(() -> new com.scanny.exception.ApiException(404, "Payment not found: " + paymentId));
    }

    public PaymentCommand toCommand(PaymentIntent intent) {
        return new PaymentCommand(
            intent.getId(),
            intent.getContext(),
            intent.getReferenceId(),
            intent.getAmount(),
            intent.getCurrency(),
            intent.getCustomerPhone(),
            intent.getCustomerName(),
            intent.getBusinessId(),
            null,
            intent.getCreatedAt(),
            intent.getSubtotal(),
            intent.getServiceFee(),
            intent.getPsoFee(),
            intent.getPlatformFee(),
            intent.getMerchantPayout(),
            intent.getMerchantMomoDestination(),
            intent.getScannyFeeDestination()
        );
    }

    public PaymentDtos.InitiateResponse toInitiateResponse(PaymentIntent intent) {
        return new PaymentDtos.InitiateResponse(
            intent.getId(),
            intent.getProviderId(),
            intent.getProviderReference(),
            intent.getStatus(),
            intent.getCustomerMessage()
        );
    }

    public PaymentDtos.StatusResponse toStatusResponse(PaymentIntent intent) {
        return new PaymentDtos.StatusResponse(
            intent.getId(),
            intent.getProviderId(),
            intent.getStatus(),
            intent.getCustomerMessage(),
            intent.getFailureReason(),
            intent.getUpdatedAt() != null ? intent.getUpdatedAt() : intent.getCreatedAt()
        );
    }

    private void onPaid(PaymentIntent intent) {
        switch (intent.getContext()) {
            case ORDER -> orderService.confirmPaymentFromGateway(intent.getReferenceId(), PaymentStatus.Paid);
            case ORDER_SPLIT -> tableService.confirmSplitFromGateway(intent.getReferenceId());
            case QUICK_PAY -> completeQuickPay(intent.getReferenceId(), TransactionStatus.Completed, null);
            case TICKET -> ticketPurchaseService.confirmPurchaseFromPayment(
                intent.getReferenceId(),
                intent.getId()
            );
            default -> logger.warn("No side-effect handler for payment context {}", intent.getContext());
        }
    }

    private void onFailed(PaymentIntent intent, String failureReason) {
        if (intent.getContext() == PaymentContext.QUICK_PAY) {
            completeQuickPay(intent.getReferenceId(), TransactionStatus.Failed, failureReason);
        }
    }

    private void completeQuickPay(String transactionRef, TransactionStatus status, String failureReason) {
        quickPaymentTransactionRepository.findByTransactionRef(transactionRef).ifPresent(transaction -> {
            transaction.setStatus(status);
            if (status == TransactionStatus.Completed) {
                transaction.setCompletedAt(Instant.now());
                QuickPaymentCode code = transaction.getCode();
                code.setUsageCount(code.getUsageCount() + 1);
                code.setLastUsedAt(Instant.now());
                code.setUpdatedAt(Instant.now());
                quickPaymentCodeRepository.save(code);
            } else if (status == TransactionStatus.Failed) {
                transaction.setFailedAt(Instant.now());
                transaction.setFailureReason(failureReason);
            }
            quickPaymentTransactionRepository.save(transaction);
        });
    }

    private String writeMetadata(Map<String, String> metadata) {
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException e) {
            logger.warn("Could not serialize payment metadata", e);
            return null;
        }
    }

    private static String generatePaymentId() {
        return "PAY-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase(Locale.ROOT);
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
