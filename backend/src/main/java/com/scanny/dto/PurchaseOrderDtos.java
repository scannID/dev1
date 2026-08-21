package com.scanny.dto;

import com.scanny.entity.IngredientBatch;
import com.scanny.entity.PurchaseOrder;
import com.scanny.entity.PurchaseOrderLine;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class PurchaseOrderDtos {
    private PurchaseOrderDtos() {}

    // ── Purchase order responses ────────────────────────────────────────────

    public record PurchaseOrderLineResponse(
        Long id, String ingredientId, String ingredientName, String unit,
        BigDecimal qtyOrdered, BigDecimal qtyReceived, int unitCost, int lineTotal
    ) {
        public static PurchaseOrderLineResponse from(PurchaseOrderLine l) {
            return new PurchaseOrderLineResponse(l.getId(), l.getIngredient().getId(),
                l.getIngredientName(), l.getUnit(), l.getQtyOrdered(), l.getQtyReceived(),
                l.getUnitCost(), l.getLineTotal());
        }
    }

    public record PurchaseOrderResponse(
        String id, String businessId, String supplierId, String supplierName,
        String status, String reference, String notes, int totalCost,
        Instant createdAt, Instant updatedAt, Instant sentAt, Instant receivedAt,
        List<PurchaseOrderLineResponse> lines
    ) {
        public static PurchaseOrderResponse from(PurchaseOrder po) {
            return new PurchaseOrderResponse(
                po.getId(), po.getBusiness().getId(),
                po.getSupplier() != null ? po.getSupplier().getId() : null,
                po.getSupplierName(), po.getStatus(), po.getReference(), po.getNotes(),
                po.getTotalCost(), po.getCreatedAt(), po.getUpdatedAt(), po.getSentAt(), po.getReceivedAt(),
                po.getLines().stream().map(PurchaseOrderLineResponse::from).toList()
            );
        }
    }

    // ── Requests ────────────────────────────────────────────────────────────

    public record PurchaseOrderLineRequest(
        @NotBlank String ingredientId,
        @NotNull @DecimalMin("0.0001") BigDecimal qtyOrdered,
        @Min(0) int unitCost
    ) {}

    public record CreatePurchaseOrderRequest(
        String supplierId,
        @Size(max = 255) String supplierName,
        @Size(max = 128) String reference,
        String notes,
        @NotNull @Valid List<PurchaseOrderLineRequest> lines
    ) {}

    public record ReceiveLineRequest(
        @NotBlank String ingredientId,
        @NotNull @DecimalMin("0.0001") BigDecimal qtyReceived,
        Integer unitCost,
        @Size(max = 128) String batchNumber,
        LocalDate expiryDate
    ) {}

    public record ReceivePurchaseOrderRequest(
        @NotNull @Valid List<ReceiveLineRequest> lines
    ) {}

    // ── Reorder suggestions ─────────────────────────────────────────────────

    public record ReorderSuggestion(
        String ingredientId, String ingredientName, String unit,
        BigDecimal qtyOnHand, BigDecimal lowStockThreshold, BigDecimal parLevel,
        BigDecimal reorderQty, int avgUnitCost, String preferredSupplierId
    ) {}

    // ── Batch responses ────────────────────────────────────────────────────

    public record BatchResponse(
        Long id, String ingredientId, String ingredientName, String unit,
        String batchNumber, BigDecimal qtyOriginal, BigDecimal qtyRemaining,
        int unitCost, LocalDate expiryDate, boolean expired, boolean expiringSoon,
        Instant receivedAt, String poId
    ) {
        public static BatchResponse from(IngredientBatch b) {
            return new BatchResponse(
                b.getId(), b.getIngredient().getId(), b.getIngredient().getName(),
                b.getIngredient().getUnit(), b.getBatchNumber(),
                b.getQtyOriginal(), b.getQtyRemaining(), b.getUnitCost(),
                b.getExpiryDate(), b.isExpired(), b.expiresWithinDays(7),
                b.getReceivedAt(), b.getPoId()
            );
        }
    }
}
