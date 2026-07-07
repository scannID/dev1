package com.scanit.controller;

import com.scanit.dto.QuickPaymentCodeResponse;
import com.scanit.dto.QuickPaymentDtos;
import com.scanit.model.enums.QuickPaymentCodeStatus;
import com.scanit.model.enums.TransactionStatus;
import com.scanit.service.QuickPaymentService;
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

    @PostMapping("/codes")
    public ResponseEntity<QuickPaymentCodeResponse> createCode(
            @RequestBody QuickPaymentDtos.CreateQuickPaymentCodeRequest request) {
        try {
            QuickPaymentCodeResponse code = quickPaymentService.createQuickPaymentCode(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(code);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    @GetMapping("/codes")
    public ResponseEntity<List<QuickPaymentCodeResponse>> getAllCodes(
            @RequestParam(required = false) String merchantId,
            @RequestParam(required = false) String businessId) {
        try {
            List<QuickPaymentCodeResponse> codes;
            if (merchantId != null) {
                codes = quickPaymentService.getCodesByMerchant(merchantId);
            } else if (businessId != null) {
                codes = quickPaymentService.getCodesByBusiness(businessId);
            } else {
                codes = quickPaymentService.getAllCodes();
            }
            return ResponseEntity.ok(codes);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/codes/{codeId}")
    public ResponseEntity<QuickPaymentCodeResponse> getCode(@PathVariable String codeId) {
        try {
            QuickPaymentCodeResponse code = quickPaymentService.getCode(codeId);
            return ResponseEntity.ok(code);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @GetMapping("/codes/qr/{qrToken}")
    public ResponseEntity<QuickPaymentCodeResponse> getCodeByQr(@PathVariable String qrToken) {
        try {
            QuickPaymentCodeResponse code = quickPaymentService.getCodeByQrToken(qrToken);
            return ResponseEntity.ok(code);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @PostMapping("/codes/qr/{qrToken}/pay")
    public ResponseEntity<QuickPaymentDtos.PaymentValidationResponse> initiatePayment(
            @PathVariable String qrToken,
            @RequestBody QuickPaymentDtos.InitiatePaymentRequest request) {
        try {
            QuickPaymentDtos.PaymentValidationResponse response = 
                quickPaymentService.initiatePayment(qrToken, request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @PatchMapping("/codes/{codeId}/status")
    public ResponseEntity<QuickPaymentCodeResponse> updateCodeStatus(
            @PathVariable String codeId,
            @RequestBody QuickPaymentDtos.UpdateCodeStatusRequest request) {
        try {
            QuickPaymentCodeResponse code = quickPaymentService.updateCodeStatus(codeId, request.status());
            return ResponseEntity.ok(code);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @GetMapping("/transactions/{transactionRef}")
    public ResponseEntity<QuickPaymentDtos.TransactionResponse> getTransaction(
            @PathVariable String transactionRef) {
        try {
            QuickPaymentDtos.TransactionResponse transaction = 
                quickPaymentService.getTransaction(transactionRef);
            return ResponseEntity.ok(transaction);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @GetMapping("/codes/{codeId}/transactions")
    public ResponseEntity<List<QuickPaymentDtos.TransactionResponse>> getTransactionsByCode(
            @PathVariable String codeId) {
        try {
            List<QuickPaymentDtos.TransactionResponse> transactions = 
                quickPaymentService.getTransactionsByCode(codeId);
            return ResponseEntity.ok(transactions);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/transactions/{transactionRef}/complete")
    public ResponseEntity<QuickPaymentDtos.TransactionResponse> completeTransaction(
            @PathVariable String transactionRef,
            @RequestBody QuickPaymentDtos.CompleteTransactionRequest request) {
        try {
            QuickPaymentDtos.TransactionResponse transaction = quickPaymentService.completeTransaction(
                transactionRef,
                request.status(),
                request.failureReason()
            );
            return ResponseEntity.ok(transaction);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}
