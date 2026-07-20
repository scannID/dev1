package com.scanny.service;

import com.scanny.dto.PaymentDtos;
import com.scanny.dto.QuickPaymentCodeResponse;
import com.scanny.dto.QuickPaymentDtos;
import com.scanny.entity.Business;
import com.scanny.entity.QuickPaymentCode;
import com.scanny.entity.QuickPaymentTransaction;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.QuickPaymentCodeStatus;
import com.scanny.model.enums.TransactionStatus;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.QuickPaymentCodeRepository;
import com.scanny.repository.QuickPaymentTransactionRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import com.scanny.payment.PaymentContext;
import com.scanny.payment.service.PaymentGatewayService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class QuickPaymentService {

    private static final Logger logger = LoggerFactory.getLogger(QuickPaymentService.class);
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
    );

    private final QuickPaymentCodeRepository codeRepository;
    private final QuickPaymentTransactionRepository transactionRepository;
    private final BusinessRepository businessRepository;
    private final JavaMailSender mailSender;
    private final PaymentGatewayService paymentGatewayService;

    @Value("${scanny.scan-base-url:https://scanny.app}")
    private String customerUrl;

    @Value("${scanny.mail.from:noreply@scanny.app}")
    private String mailFrom;

    public QuickPaymentService(
            QuickPaymentCodeRepository codeRepository,
            QuickPaymentTransactionRepository transactionRepository,
            BusinessRepository businessRepository,
            ObjectProvider<JavaMailSender> mailSenderProvider,
            PaymentGatewayService paymentGatewayService) {
        this.codeRepository = codeRepository;
        this.transactionRepository = transactionRepository;
        this.businessRepository = businessRepository;
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.paymentGatewayService = paymentGatewayService;
    }

    @Transactional
    public QuickPaymentCodeResponse createQuickPaymentCode(QuickPaymentDtos.CreateQuickPaymentCodeRequest request) {
        validateAmount(request.amount());
        requireText(request.description(), "Description is required");
        requireText(request.paymentDestination(), "Payment destination is required");

        QuickPaymentCode code = new QuickPaymentCode();
        code.setId(generateCodeId());
        code.setQrToken(generateQrToken());
        code.setTrackingNumber(generateTrackingNumber());
        code.setDescription(request.description().trim());
        code.setAmount(request.amount());
        code.setCurrency(request.currency() != null && !request.currency().isBlank() ? request.currency() : "UGX");
        code.setOwnerName(nullToEmpty(request.ownerName()));
        code.setOwnerPhone(nullToEmpty(request.ownerPhone()));
        code.setOwnerEmail(nullToEmpty(request.ownerEmail()).toLowerCase(Locale.ROOT));
        code.setPaymentDestination(request.paymentDestination().trim());
        code.setPaymentDestinationType(
            request.paymentDestinationType() != null ? request.paymentDestinationType() : "MobileMoney"
        );
        code.setMerchantId(request.merchantId());
        code.setMetadata(request.metadata());
        code.setStatus(QuickPaymentCodeStatus.Active);

        if (request.businessId() != null) {
            Business business = businessRepository.findById(request.businessId())
                .orElseThrow(() -> new ApiException(404, "Business not found: " + request.businessId()));
            code.setBusiness(business);
        }

        code = codeRepository.save(code);
        boolean emailSent = false;
        if (!code.getOwnerEmail().isBlank()) {
            emailSent = sendOwnerEmail(code);
        }
        return QuickPaymentCodeResponse.from(code, customerUrl, emailSent);
    }

    @Transactional
    public QuickPaymentCodeResponse createPublicCode(QuickPaymentDtos.PublicCreateQuickPaymentRequest request) {
        validateAmount(request.amount());
        requireText(request.description(), "Description is required");
        requireText(request.ownerName(), "Your name is required");
        requireText(request.paymentDestination(), "Mobile money number is required");
        String email = requireText(request.ownerEmail(), "Email is required").trim().toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new ApiException(400, "Enter a valid email address");
        }

        QuickPaymentCode code = new QuickPaymentCode();
        code.setId(generateCodeId());
        code.setQrToken(generateQrToken());
        code.setTrackingNumber(generateTrackingNumber());
        code.setDescription(request.description().trim());
        code.setAmount(request.amount());
        code.setCurrency(request.currency() != null && !request.currency().isBlank() ? request.currency() : "UGX");
        code.setOwnerName(request.ownerName().trim());
        code.setOwnerPhone(nullToEmpty(request.ownerPhone()).trim());
        code.setOwnerEmail(email);
        code.setPaymentDestination(request.paymentDestination().trim());
        code.setPaymentDestinationType(
            request.paymentDestinationType() != null && !request.paymentDestinationType().isBlank()
                ? request.paymentDestinationType()
                : "MobileMoney"
        );
        code.setStatus(QuickPaymentCodeStatus.Active);

        code = codeRepository.save(code);
        boolean emailSent = sendOwnerEmail(code);
        return QuickPaymentCodeResponse.from(code, customerUrl, emailSent);
    }

    @Transactional(readOnly = true)
    public QuickPaymentDtos.TrackingMetricsResponse getTrackingMetrics(String trackingNumber) {
        String normalized = requireText(trackingNumber, "Tracking number is required").trim().toUpperCase(Locale.ROOT);
        QuickPaymentCode code = codeRepository.findByTrackingNumber(normalized)
            .orElseThrow(() -> new ApiException(404, "No payment QR found for that tracking number"));

        List<QuickPaymentTransaction> transactions =
            transactionRepository.findByCodeIdOrderByCreatedAtDesc(code.getId());

        long completed = transactions.stream().filter(t -> t.getStatus() == TransactionStatus.Completed).count();
        long pending = transactions.stream().filter(t ->
            t.getStatus() == TransactionStatus.Pending || t.getStatus() == TransactionStatus.Processing
        ).count();
        long failed = transactions.stream().filter(t ->
            t.getStatus() == TransactionStatus.Failed || t.getStatus() == TransactionStatus.Cancelled
        ).count();
        long totalCollected = transactions.stream()
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .mapToLong(QuickPaymentTransaction::getAmount)
            .sum();

        List<QuickPaymentDtos.TransactionResponse> recent = transactions.stream()
            .limit(25)
            .map(this::mapTransactionToResponse)
            .toList();

        return new QuickPaymentDtos.TrackingMetricsResponse(
            code.getTrackingNumber(),
            code.getId(),
            code.getDescription(),
            code.getAmount(),
            code.getCurrency(),
            code.getStatus(),
            code.getUsageCount(),
            completed,
            pending,
            failed,
            totalCollected,
            code.getOwnerName(),
            code.getOwnerEmail(),
            code.getPaymentDestination(),
            code.getPaymentDestinationType(),
            customerUrl + "/pay/" + code.getQrToken(),
            customerUrl + "/track/" + code.getTrackingNumber(),
            code.getCreatedAt(),
            code.getLastUsedAt(),
            recent
        );
    }

    @Transactional(readOnly = true)
    public QuickPaymentCodeResponse getCode(String codeId) {
        QuickPaymentCode code = codeRepository.findById(codeId)
            .orElseThrow(() -> new ApiException(404, "Payment code not found: " + codeId));
        return QuickPaymentCodeResponse.from(code, customerUrl);
    }

    @Transactional(readOnly = true)
    public QuickPaymentCodeResponse getCodeByQrToken(String qrToken) {
        QuickPaymentCode code = codeRepository.findByQrToken(qrToken)
            .orElseThrow(() -> new ApiException(404, "Payment code not found"));
        return QuickPaymentCodeResponse.from(code, customerUrl);
    }

    @Transactional(readOnly = true)
    public List<QuickPaymentCodeResponse> getAllCodes() {
        return codeRepository.findAll().stream()
            .map(code -> QuickPaymentCodeResponse.from(code, customerUrl))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<QuickPaymentCodeResponse> getCodesByMerchant(String merchantId) {
        return codeRepository.findByMerchantId(merchantId).stream()
            .map(code -> QuickPaymentCodeResponse.from(code, customerUrl))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<QuickPaymentCodeResponse> getCodesByBusiness(String businessId) {
        return codeRepository.findByBusinessId(businessId).stream()
            .map(code -> QuickPaymentCodeResponse.from(code, customerUrl))
            .toList();
    }

    @Transactional
    public QuickPaymentDtos.PaymentValidationResponse initiatePayment(
            String qrToken,
            QuickPaymentDtos.InitiatePaymentRequest request) {

        QuickPaymentCode code = codeRepository.findByQrToken(qrToken)
            .orElseThrow(() -> new ApiException(404, "Invalid QR code"));

        String message;
        boolean valid = false;
        String transactionRef = null;

        if (code.getStatus() == QuickPaymentCodeStatus.Cancelled) {
            message = "Payment code has been cancelled";
        } else if (code.canBeUsed()) {
            message = "Payment initiated successfully. Pay to: " + code.getPaymentDestination();
            valid = true;

            QuickPaymentTransaction transaction = new QuickPaymentTransaction();
            transaction.setCode(code);
            transaction.setTransactionRef(generateTransactionRef());
            transaction.setAmount(code.getAmount());
            transaction.setCurrency(code.getCurrency());
            transaction.setCustomerPhone(nullToEmpty(request.customerPhone()));
            transaction.setCustomerName(nullToEmpty(request.customerName()));
            transaction.setPaymentMethod(request.paymentMethod() != null ? request.paymentMethod() : "MobileMoney");
            transaction.setPaymentProvider("");
            transaction.setDeviceInfo(request.deviceInfo());
            transaction.setLocation(nullToEmpty(request.location()));
            transaction.setStatus(TransactionStatus.Pending);

            transaction = transactionRepository.save(transaction);
            transactionRef = transaction.getTransactionRef();

            PaymentDtos.InitiateResponse payment = paymentGatewayService.initiate(new PaymentDtos.InitiateRequest(
                PaymentContext.QUICK_PAY,
                transactionRef,
                request.paymentMethod(),
                code.getAmount(),
                code.getCurrency(),
                nullToEmpty(request.customerPhone()),
                nullToEmpty(request.customerName()),
                code.getBusiness() != null ? code.getBusiness().getId() : null,
                code.getDescription()
            ));
            transaction.setPaymentProvider(payment.providerId());
            transaction.setStatus(mapGatewayStatus(payment.status()));
            transactionRepository.save(transaction);

            code.setLastUsedAt(Instant.now());
            code.setUpdatedAt(Instant.now());
        } else {
            message = "Payment code is not valid";
        }

        codeRepository.save(code);

        return new QuickPaymentDtos.PaymentValidationResponse(
            valid,
            message,
            QuickPaymentCodeResponse.from(code, customerUrl),
            transactionRef
        );
    }

    @Transactional
    public QuickPaymentDtos.TransactionResponse completeTransaction(
            String transactionRef,
            TransactionStatus status,
            String failureReason) {

        QuickPaymentTransaction transaction = transactionRepository.findByTransactionRef(transactionRef)
            .orElseThrow(() -> new ApiException(404, "Transaction not found: " + transactionRef));

        QuickPaymentCode code = transaction.getCode();

        transaction.setStatus(status);

        if (status == TransactionStatus.Completed) {
            transaction.setCompletedAt(Instant.now());
            code.setUsageCount(code.getUsageCount() + 1);
            code.setLastUsedAt(Instant.now());
            code.setUpdatedAt(Instant.now());
        } else if (status == TransactionStatus.Failed) {
            transaction.setFailedAt(Instant.now());
            transaction.setFailureReason(failureReason);
        }

        transaction = transactionRepository.save(transaction);
        codeRepository.save(code);

        return mapTransactionToResponse(transaction);
    }

    @Transactional
    public QuickPaymentCodeResponse updateCodeStatus(String codeId, QuickPaymentCodeStatus status) {
        QuickPaymentCode code = codeRepository.findById(codeId)
            .orElseThrow(() -> new ApiException(404, "Payment code not found: " + codeId));

        code.setStatus(status);
        code.setUpdatedAt(Instant.now());

        code = codeRepository.save(code);
        return QuickPaymentCodeResponse.from(code, customerUrl);
    }

    @Transactional(readOnly = true)
    public List<QuickPaymentDtos.TransactionResponse> getTransactionsByCode(String codeId) {
        return transactionRepository.findByCodeIdOrderByCreatedAtDesc(codeId).stream()
            .map(this::mapTransactionToResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public QuickPaymentDtos.TransactionResponse getTransaction(String transactionRef) {
        QuickPaymentTransaction transaction = transactionRepository.findByTransactionRef(transactionRef)
            .orElseThrow(() -> new ApiException(404, "Transaction not found: " + transactionRef));
        return mapTransactionToResponse(transaction);
    }

    private static TransactionStatus mapGatewayStatus(com.scanny.payment.PaymentIntentStatus status) {
        return switch (status) {
            case Paid -> TransactionStatus.Completed;
            case Failed, Cancelled -> TransactionStatus.Failed;
            case Processing -> TransactionStatus.Processing;
            case Pending -> TransactionStatus.Pending;
        };
    }

    private boolean sendOwnerEmail(QuickPaymentCode code) {
        if (mailSender == null) {
            logger.warn("Mail sender not configured; skipping quick-pay owner email for {}", code.getTrackingNumber());
            return false;
        }
        try {
            String qrUrl = customerUrl + "/pay/" + code.getQrToken();
            String trackUrl = customerUrl + "/track/" + code.getTrackingNumber();
            String amountLabel = String.format(Locale.US, "%,d %s", code.getAmount(), code.getCurrency());

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(mailFrom);
            helper.setTo(code.getOwnerEmail());
            helper.setSubject("Your Scanny payment QR — " + code.getTrackingNumber());
            helper.setText(
                """
                <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#111827">
                  <h2 style="margin:0 0 12px">Your payment QR is ready</h2>
                  <p>Hi %s,</p>
                  <p>Your Scanny QR for <strong>%s</strong> (%s) is live.</p>
                  <p style="font-size:18px;font-weight:700;letter-spacing:0.04em">Tracking number: %s</p>
                  <ul>
                    <li>Customer pay link: <a href="%s">%s</a></li>
                    <li>Track metrics: <a href="%s">%s</a></li>
                    <li>Money goes to: %s</li>
                  </ul>
                  <p>Save your tracking number — use it anytime to see payments and totals. No account needed.</p>
                  <p style="color:#6b7280;font-size:13px">— Scanny</p>
                </div>
                """.formatted(
                    escape(code.getOwnerName()),
                    escape(code.getDescription()),
                    amountLabel,
                    code.getTrackingNumber(),
                    qrUrl, qrUrl,
                    trackUrl, trackUrl,
                    escape(code.getPaymentDestination())
                ),
                true
            );
            mailSender.send(message);
            logger.info("Sent quick-pay owner email for {} to {}", code.getTrackingNumber(), code.getOwnerEmail());
            return true;
        } catch (MessagingException | MailException e) {
            logger.error("Failed to send quick-pay owner email for {}", code.getTrackingNumber(), e);
            return false;
        }
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;");
    }

    private QuickPaymentDtos.TransactionResponse mapTransactionToResponse(QuickPaymentTransaction transaction) {
        return new QuickPaymentDtos.TransactionResponse(
            transaction.getId(),
            transaction.getCode().getId(),
            transaction.getTransactionRef(),
            transaction.getAmount(),
            transaction.getCurrency(),
            transaction.getCustomerPhone(),
            transaction.getCustomerName(),
            transaction.getPaymentMethod(),
            transaction.getPaymentProvider(),
            transaction.getStatus(),
            transaction.getDeviceInfo(),
            transaction.getLocation(),
            transaction.getCreatedAt(),
            transaction.getCompletedAt(),
            transaction.getFailedAt(),
            transaction.getFailureReason()
        );
    }

    private static void validateAmount(int amount) {
        if (amount <= 0) {
            throw new ApiException(400, "Amount must be greater than zero");
        }
        if (amount > 50_000_000) {
            throw new ApiException(400, "Amount is too large");
        }
    }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ApiException(400, message);
        }
        return value;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String generateCodeId() {
        return "QPC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private String generateTrackingNumber() {
        for (int attempt = 0; attempt < 8; attempt++) {
            String candidate = "TRK-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
            if (codeRepository.findByTrackingNumber(candidate).isEmpty()) {
                return candidate;
            }
        }
        throw new ApiException(500, "Could not allocate a tracking number");
    }

    private String generateQrToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    private String generateTransactionRef() {
        return "TXN-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }
}
