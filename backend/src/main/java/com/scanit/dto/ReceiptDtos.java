package com.scanit.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class ReceiptDtos {

    // Request to generate receipt
    public record GenerateReceiptRequest(
        String orderId,
        Long ticketId,
        Long quickPaymentId,
        Long devicePaymentId,
        String businessId,
        String businessName,
        String merchantId,
        String customerName,
        String customerEmail,
        String customerPhone,
        BigDecimal amount,
        String currency,
        String paymentMethod,
        String paymentReference,
        List<ReceiptItem> items,
        BigDecimal subtotal,
        BigDecimal taxAmount,
        BigDecimal serviceFee,
        String notes,
        Boolean sendEmail,
        Boolean generatePdf
    ) {}

    // Receipt item
    public record ReceiptItem(
        String name,
        Integer quantity,
        BigDecimal price,
        BigDecimal total
    ) {}

    // Receipt response
    public record ReceiptResponse(
        Long id,
        String receiptNumber,
        String orderId,
        Long ticketId,
        Long quickPaymentId,
        Long devicePaymentId,
        String businessId,
        String businessName,
        String merchantId,
        String customerName,
        String customerEmail,
        String customerPhone,
        BigDecimal amount,
        String currency,
        String paymentMethod,
        String paymentReference,
        LocalDateTime paymentDate,
        List<ReceiptItem> items,
        BigDecimal subtotal,
        BigDecimal taxAmount,
        BigDecimal serviceFee,
        BigDecimal totalAmount,
        String status,
        Boolean emailSent,
        LocalDateTime emailSentAt,
        Boolean inAppViewed,
        LocalDateTime inAppViewedAt,
        Boolean pdfGenerated,
        String pdfUrl,
        String notes,
        LocalDateTime createdAt
    ) {}

    // List response
    public record ReceiptsResponse(
        List<ReceiptResponse> receipts,
        int total
    ) {}

    // Send receipt email request
    public record SendReceiptEmailRequest(
        String receiptNumber,
        String recipientEmail
    ) {}

    // Email send result
    public record EmailSendResult(
        Boolean success,
        String message,
        LocalDateTime sentAt
    ) {}

    // Receipt summary for dashboard
    public record ReceiptSummary(
        Long totalReceipts,
        Long sentReceipts,
        Long pendingReceipts,
        Long failedReceipts,
        BigDecimal totalAmount
    ) {}

    // In-app receipt view request
    public record MarkViewedRequest(
        String receiptNumber
    ) {}

    // PDF generation request
    public record GeneratePdfRequest(
        String receiptNumber
    ) {}

    // PDF generation result
    public record PdfGenerationResult(
        Boolean success,
        String pdfUrl,
        String message
    ) {}
}
