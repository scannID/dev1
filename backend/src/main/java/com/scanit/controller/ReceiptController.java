package com.scanit.controller;

import com.scanit.dto.ReceiptDtos.*;
import com.scanit.service.ReceiptService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/receipts")
public class ReceiptController {

    private final ReceiptService receiptService;

    public ReceiptController(ReceiptService receiptService) {
        this.receiptService = receiptService;
    }

    // Generate a new receipt
    @PostMapping("/generate")
    public ResponseEntity<ReceiptResponse> generateReceipt(@RequestBody GenerateReceiptRequest request) {
        ReceiptResponse receipt = receiptService.generateReceipt(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(receipt);
    }

    // Send receipt email
    @PostMapping("/{receiptNumber}/send-email")
    public ResponseEntity<EmailSendResult> sendReceiptEmail(
            @PathVariable String receiptNumber,
            @RequestBody(required = false) SendReceiptEmailRequest request) {
        
        String email = request != null ? request.recipientEmail() : null;
        EmailSendResult result = receiptService.sendReceiptEmail(receiptNumber, email);
        return ResponseEntity.ok(result);
    }

    // Get receipt by receipt number
    @GetMapping("/{receiptNumber}")
    public ResponseEntity<ReceiptResponse> getReceipt(@PathVariable String receiptNumber) {
        ReceiptResponse receipt = receiptService.getReceiptByNumber(receiptNumber);
        return ResponseEntity.ok(receipt);
    }

    // Get receipts by customer email
    @GetMapping("/customer/{email}")
    public ResponseEntity<ReceiptsResponse> getCustomerReceipts(@PathVariable String email) {
        ReceiptsResponse receipts = receiptService.getReceiptsByCustomerEmail(email);
        return ResponseEntity.ok(receipts);
    }

    // Get receipts by business ID
    @GetMapping("/business/{businessId}")
    public ResponseEntity<ReceiptsResponse> getBusinessReceipts(@PathVariable String businessId) {
        ReceiptsResponse receipts = receiptService.getReceiptsByBusinessId(businessId);
        return ResponseEntity.ok(receipts);
    }

    // Get receipt by order ID
    @GetMapping("/order/{orderId}")
    public ResponseEntity<ReceiptResponse> getReceiptByOrder(@PathVariable String orderId) {
        return receiptService.getReceiptByOrderId(orderId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Mark receipt as viewed in app
    @PatchMapping("/{receiptNumber}/mark-viewed")
    public ResponseEntity<ReceiptResponse> markAsViewed(@PathVariable String receiptNumber) {
        ReceiptResponse receipt = receiptService.markAsViewed(receiptNumber);
        return ResponseEntity.ok(receipt);
    }

    // Get receipt summary for business
    @GetMapping("/summary")
    public ResponseEntity<ReceiptSummary> getReceiptSummary(
            @RequestParam(required = false) String businessId) {
        ReceiptSummary summary = receiptService.getReceiptSummary(businessId);
        return ResponseEntity.ok(summary);
    }
}
