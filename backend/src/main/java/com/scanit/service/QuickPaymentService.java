package com.scanit.service;

import com.scanit.dto.QuickPaymentCodeResponse;
import com.scanit.dto.QuickPaymentDtos;
import com.scanit.entity.Business;
import com.scanit.entity.QuickPaymentCode;
import com.scanit.entity.QuickPaymentTransaction;
import com.scanit.model.enums.QuickPaymentCodeStatus;
import com.scanit.model.enums.TransactionStatus;
import com.scanit.repository.BusinessRepository;
import com.scanit.repository.QuickPaymentCodeRepository;
import com.scanit.repository.QuickPaymentTransactionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class QuickPaymentService {

    private final QuickPaymentCodeRepository codeRepository;
    private final QuickPaymentTransactionRepository transactionRepository;
    private final BusinessRepository businessRepository;

    @Value("${app.customer-url:https://scanit.app}")
    private String customerUrl;

    public QuickPaymentService(
            QuickPaymentCodeRepository codeRepository,
            QuickPaymentTransactionRepository transactionRepository,
            BusinessRepository businessRepository) {
        this.codeRepository = codeRepository;
        this.transactionRepository = transactionRepository;
        this.businessRepository = businessRepository;
    }

    @Transactional
    public QuickPaymentCodeResponse createQuickPaymentCode(QuickPaymentDtos.CreateQuickPaymentCodeRequest request) {
        QuickPaymentCode code = new QuickPaymentCode();
        code.setId(generateCodeId());
        code.setQrToken(generateQrToken());
        code.setDescription(request.description());
        code.setAmount(request.amount());
        code.setCurrency(request.currency() != null ? request.currency() : "UGX");
        code.setOwnerName(request.ownerName() != null ? request.ownerName() : "");
        code.setOwnerPhone(request.ownerPhone() != null ? request.ownerPhone() : "");
        code.setPaymentDestination(request.paymentDestination());
        code.setPaymentDestinationType(request.paymentDestinationType() != null ? request.paymentDestinationType() : "MobileMoney");
        code.setMerchantId(request.merchantId());
        code.setMetadata(request.metadata());
        code.setStatus(QuickPaymentCodeStatus.Active);

        // Link to business if provided
        if (request.businessId() != null) {
            Business business = businessRepository.findById(request.businessId())
                .orElseThrow(() -> new RuntimeException("Business not found: " + request.businessId()));
            code.setBusiness(business);
        }

        code = codeRepository.save(code);
        return QuickPaymentCodeResponse.from(code, customerUrl);
    }

    @Transactional(readOnly = true)
    public QuickPaymentCodeResponse getCode(String codeId) {
        QuickPaymentCode code = codeRepository.findById(codeId)
            .orElseThrow(() -> new RuntimeException("Payment code not found: " + codeId));
        return QuickPaymentCodeResponse.from(code, customerUrl);
    }

    @Transactional(readOnly = true)
    public QuickPaymentCodeResponse getCodeByQrToken(String qrToken) {
        QuickPaymentCode code = codeRepository.findByQrToken(qrToken)
            .orElseThrow(() -> new RuntimeException("Payment code not found with QR token: " + qrToken));
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
            .orElseThrow(() -> new RuntimeException("Invalid QR code"));

        // Validate code
        String message;
        boolean valid = false;
        String transactionRef = null;

        if (code.getStatus() == QuickPaymentCodeStatus.Cancelled) {
            message = "Payment code has been cancelled";
        } else if (code.canBeUsed()) {
            message = "Payment initiated successfully. Pay to: " + code.getPaymentDestination();
            valid = true;
            
            // Create transaction record
            QuickPaymentTransaction transaction = new QuickPaymentTransaction();
            transaction.setCode(code);
            transaction.setTransactionRef(generateTransactionRef());
            transaction.setAmount(code.getAmount());
            transaction.setCurrency(code.getCurrency());
            transaction.setCustomerPhone(request.customerPhone() != null ? request.customerPhone() : "");
            transaction.setCustomerName(request.customerName() != null ? request.customerName() : "");
            transaction.setPaymentMethod(request.paymentMethod() != null ? request.paymentMethod() : "");
            transaction.setPaymentProvider(""); // Will be set by payment gateway
            transaction.setDeviceInfo(request.deviceInfo());
            transaction.setLocation(request.location() != null ? request.location() : "");
            transaction.setStatus(TransactionStatus.Pending);
            
            transaction = transactionRepository.save(transaction);
            transactionRef = transaction.getTransactionRef();
            
            // Update code stats (don't increment usage_count yet - wait for payment confirmation)
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
            .orElseThrow(() -> new RuntimeException("Transaction not found: " + transactionRef));

        QuickPaymentCode code = transaction.getCode();

        transaction.setStatus(status);
        
        if (status == TransactionStatus.Completed) {
            transaction.setCompletedAt(Instant.now());
            
            // Increment usage count (track how many times this code has been used)
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
            .orElseThrow(() -> new RuntimeException("Payment code not found: " + codeId));
        
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
            .orElseThrow(() -> new RuntimeException("Transaction not found: " + transactionRef));
        return mapTransactionToResponse(transaction);
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

    private String generateCodeId() {
        return "QPC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private String generateQrToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    private String generateTransactionRef() {
        return "TXN-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
