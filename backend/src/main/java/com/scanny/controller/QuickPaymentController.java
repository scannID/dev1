package com.scanny.controller;

import com.scanny.dto.QuickPaymentCodeResponse;
import com.scanny.dto.QuickPaymentDtos;
import com.scanny.exception.ApiException;
import com.scanny.service.QuickPaymentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/quick-payments")
public class QuickPaymentController {

    private final QuickPaymentService quickPaymentService;

    public QuickPaymentController(QuickPaymentService quickPaymentService) {
        this.quickPaymentService = quickPaymentService;
    }

    /** Landing-page create — no login. Returns QR + tracking number and emails the owner. */
    @PostMapping("/public/codes")
    public ResponseEntity<QuickPaymentCodeResponse> createPublicCode(
            @RequestBody QuickPaymentDtos.PublicCreateQuickPaymentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(quickPaymentService.createPublicCode(request));
    }

    /** Public metrics by tracking number (acts as the owner's access key). */
    @GetMapping("/public/track/{trackingNumber}")
    public ResponseEntity<QuickPaymentDtos.TrackingMetricsResponse> trackByNumber(
            @PathVariable String trackingNumber) {
        return ResponseEntity.ok(quickPaymentService.getTrackingMetrics(trackingNumber));
    }

    @PostMapping("/codes")
    public ResponseEntity<QuickPaymentCodeResponse> createCode(
            @RequestBody QuickPaymentDtos.CreateQuickPaymentCodeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(quickPaymentService.createQuickPaymentCode(request));
    }

    @GetMapping("/codes")
    public ResponseEntity<List<QuickPaymentCodeResponse>> getAllCodes(
            @RequestParam(required = false) String merchantId,
            @RequestParam(required = false) String businessId) {
        List<QuickPaymentCodeResponse> codes;
        if (merchantId != null) {
            codes = quickPaymentService.getCodesByMerchant(merchantId);
        } else if (businessId != null) {
            codes = quickPaymentService.getCodesByBusiness(businessId);
        } else {
            codes = quickPaymentService.getAllCodes();
        }
        return ResponseEntity.ok(codes);
    }

    @GetMapping("/codes/{codeId}")
    public ResponseEntity<QuickPaymentCodeResponse> getCode(@PathVariable String codeId) {
        return ResponseEntity.ok(quickPaymentService.getCode(codeId));
    }

    @GetMapping("/codes/qr/{qrToken}")
    public ResponseEntity<QuickPaymentCodeResponse> getCodeByQr(@PathVariable String qrToken) {
        return ResponseEntity.ok(quickPaymentService.getCodeByQrToken(qrToken));
    }

    @PostMapping("/codes/qr/{qrToken}/pay")
    public ResponseEntity<QuickPaymentDtos.PaymentValidationResponse> initiatePayment(
            @PathVariable String qrToken,
            @RequestBody QuickPaymentDtos.InitiatePaymentRequest request) {
        return ResponseEntity.ok(quickPaymentService.initiatePayment(qrToken, request));
    }

    @PatchMapping("/codes/{codeId}/status")
    public ResponseEntity<QuickPaymentCodeResponse> updateCodeStatus(
            @PathVariable String codeId,
            @RequestBody QuickPaymentDtos.UpdateCodeStatusRequest request) {
        return ResponseEntity.ok(quickPaymentService.updateCodeStatus(codeId, request.status()));
    }

    @GetMapping("/transactions/{transactionRef}")
    public ResponseEntity<QuickPaymentDtos.TransactionResponse> getTransaction(
            @PathVariable String transactionRef) {
        return ResponseEntity.ok(quickPaymentService.getTransaction(transactionRef));
    }

    @GetMapping("/codes/{codeId}/transactions")
    public ResponseEntity<List<QuickPaymentDtos.TransactionResponse>> getTransactionsByCode(
            @PathVariable String codeId) {
        return ResponseEntity.ok(quickPaymentService.getTransactionsByCode(codeId));
    }

    @PostMapping("/transactions/{transactionRef}/complete")
    public ResponseEntity<QuickPaymentDtos.TransactionResponse> completeTransaction(
            @PathVariable String transactionRef,
            @RequestBody QuickPaymentDtos.CompleteTransactionRequest request) {
        if (request.status() == null) {
            throw new ApiException(400, "Transaction status is required");
        }
        return ResponseEntity.ok(quickPaymentService.completeTransaction(
            transactionRef,
            request.status(),
            request.failureReason()
        ));
    }
}
