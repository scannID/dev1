package com.scanny.service;

import com.scanny.dto.PurchaseOrderDtos;
import com.scanny.entity.Business;
import com.scanny.entity.Ingredient;
import com.scanny.entity.IngredientBatch;
import com.scanny.entity.PurchaseOrder;
import com.scanny.entity.PurchaseOrderLine;
import com.scanny.entity.Supplier;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.StockMovementType;
import com.scanny.repository.IngredientBatchRepository;
import com.scanny.repository.IngredientRepository;
import com.scanny.repository.PurchaseOrderRepository;
import com.scanny.repository.SupplierRepository;
import com.scanny.security.MerchantAccessService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class PurchaseOrderService {

    private final PurchaseOrderRepository poRepository;
    private final IngredientRepository ingredientRepository;
    private final SupplierRepository supplierRepository;
    private final IngredientBatchRepository batchRepository;
    private final InventoryService inventoryService;
    private final MerchantAccessService merchantAccessService;

    public PurchaseOrderService(
            PurchaseOrderRepository poRepository,
            IngredientRepository ingredientRepository,
            SupplierRepository supplierRepository,
            IngredientBatchRepository batchRepository,
            InventoryService inventoryService,
            MerchantAccessService merchantAccessService) {
        this.poRepository = poRepository;
        this.ingredientRepository = ingredientRepository;
        this.supplierRepository = supplierRepository;
        this.batchRepository = batchRepository;
        this.inventoryService = inventoryService;
        this.merchantAccessService = merchantAccessService;
    }

    // ── List ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PurchaseOrderDtos.PurchaseOrderResponse> list(String businessId, String status) {
        merchantAccessService.requireOwnedBusiness(businessId);
        List<PurchaseOrder> orders = status != null && !status.isBlank()
            ? poRepository.findByBusiness_IdAndStatusOrderByCreatedAtDesc(businessId, status.toUpperCase())
            : poRepository.findByBusiness_IdOrderByCreatedAtDesc(businessId);
        return orders.stream().map(po -> {
            var full = poRepository.findWithLinesById(po.getId()).orElse(po);
            return PurchaseOrderDtos.PurchaseOrderResponse.from(full);
        }).toList();
    }

    @Transactional(readOnly = true)
    public PurchaseOrderDtos.PurchaseOrderResponse get(String businessId, String poId) {
        return PurchaseOrderDtos.PurchaseOrderResponse.from(require(businessId, poId));
    }

    // ── Create ───────────────────────────────────────────────────────────────

    @Transactional
    public PurchaseOrderDtos.PurchaseOrderResponse create(String businessId, PurchaseOrderDtos.CreatePurchaseOrderRequest req) {
        Business business = merchantAccessService.requireOwnedBusiness(businessId);

        PurchaseOrder po = new PurchaseOrder();
        po.setId("PO-" + UUID.randomUUID().toString().replace("-","").substring(0, 12).toUpperCase(Locale.ROOT));
        po.setBusiness(business);
        po.setStatus("DRAFT");
        po.setReference(blankToEmpty(req.reference()));
        po.setNotes(blankToEmpty(req.notes()));
        po.setCreatedAt(Instant.now());

        if (req.supplierId() != null && !req.supplierId().isBlank()) {
            Supplier supplier = supplierRepository.findById(req.supplierId())
                .filter(s -> s.getBusiness().getId().equals(businessId))
                .orElseThrow(() -> new ApiException(404, "Supplier not found."));
            po.setSupplier(supplier);
            po.setSupplierName(supplier.getName());
        } else {
            po.setSupplierName(blankToEmpty(req.supplierName()));
        }

        for (PurchaseOrderDtos.PurchaseOrderLineRequest lr : req.lines()) {
            Ingredient ingredient = ingredientRepository.findById(lr.ingredientId())
                .filter(i -> i.getBusiness().getId().equals(businessId))
                .orElseThrow(() -> new ApiException(404, "Ingredient not found: " + lr.ingredientId()));
            PurchaseOrderLine line = new PurchaseOrderLine();
            line.setIngredient(ingredient);
            line.setIngredientName(ingredient.getName());
            line.setUnit(ingredient.getUnit());
            line.setQtyOrdered(lr.qtyOrdered().setScale(4, RoundingMode.HALF_UP));
            line.setUnitCost(Math.max(0, lr.unitCost()));
            line.recalcTotal();
            po.addLine(line);
        }
        po.recalcTotal();

        return PurchaseOrderDtos.PurchaseOrderResponse.from(poRepository.save(po));
    }

    // ── Mark as sent ─────────────────────────────────────────────────────────

    @Transactional
    public PurchaseOrderDtos.PurchaseOrderResponse markSent(String businessId, String poId) {
        PurchaseOrder po = require(businessId, poId);
        if (!"DRAFT".equals(po.getStatus())) {
            throw new ApiException(409, "Only DRAFT orders can be marked as sent.");
        }
        po.setStatus("SENT");
        po.setSentAt(Instant.now());
        po.setUpdatedAt(Instant.now());
        return PurchaseOrderDtos.PurchaseOrderResponse.from(poRepository.save(po));
    }

    // ── Receive stock ─────────────────────────────────────────────────────────
    // Receiving a PO:
    //   - For each line, calls InventoryService.receiveStock() to update qty + weighted avg cost
    //   - Creates an IngredientBatch record (for batch/expiry tracking)
    //   - Updates line.qtyReceived, advances PO status

    @Transactional
    public PurchaseOrderDtos.PurchaseOrderResponse receive(
            String businessId,
            String poId,
            PurchaseOrderDtos.ReceivePurchaseOrderRequest req) {
        PurchaseOrder po = require(businessId, poId);
        if ("CANCELLED".equals(po.getStatus()) || "RECEIVED".equals(po.getStatus())) {
            throw new ApiException(409, "Cannot receive a " + po.getStatus() + " order.");
        }

        Instant now = Instant.now();
        for (PurchaseOrderDtos.ReceiveLineRequest lr : req.lines()) {
            po.getLines().stream()
                .filter(l -> l.getIngredient().getId().equals(lr.ingredientId()))
                .findFirst()
                .ifPresent(line -> {
                    BigDecimal toReceive = lr.qtyReceived().setScale(4, RoundingMode.HALF_UP);
                    if (toReceive.compareTo(BigDecimal.ZERO) <= 0) return;

                    int unitCost = lr.unitCost() != null ? lr.unitCost() : line.getUnitCost();

                    // Update inventory (weighted avg cost, RECEIVE movement)
                    inventoryService.receiveStockInternal(
                        line.getIngredient(),
                        toReceive,
                        unitCost,
                        "PO receipt: " + po.getId(),
                        "merchant"
                    );

                    // Create batch record
                    IngredientBatch batch = new IngredientBatch();
                    batch.setBusiness(po.getBusiness());
                    batch.setIngredient(line.getIngredient());
                    batch.setBatchNumber(blankToEmpty(lr.batchNumber()));
                    batch.setQtyOriginal(toReceive);
                    batch.setQtyRemaining(toReceive);
                    batch.setUnitCost(unitCost);
                    batch.setExpiryDate(lr.expiryDate());
                    batch.setReceivedAt(now);
                    batch.setPoId(po.getId());
                    batchRepository.save(batch);

                    BigDecimal newReceived = line.getQtyReceived().add(toReceive);
                    line.setQtyReceived(newReceived);
                });
        }

        // Advance status
        boolean allReceived = po.getLines().stream().allMatch(l ->
            l.getQtyReceived().compareTo(l.getQtyOrdered()) >= 0);
        boolean anyReceived = po.getLines().stream().anyMatch(l ->
            l.getQtyReceived().compareTo(BigDecimal.ZERO) > 0);

        if (allReceived) {
            po.setStatus("RECEIVED");
            po.setReceivedAt(now);
        } else if (anyReceived) {
            po.setStatus("PARTIALLY_RECEIVED");
        }
        po.setUpdatedAt(now);
        return PurchaseOrderDtos.PurchaseOrderResponse.from(poRepository.save(po));
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    @Transactional
    public PurchaseOrderDtos.PurchaseOrderResponse cancel(String businessId, String poId) {
        PurchaseOrder po = require(businessId, poId);
        if ("RECEIVED".equals(po.getStatus())) {
            throw new ApiException(409, "Cannot cancel a fully received order.");
        }
        po.setStatus("CANCELLED");
        po.setUpdatedAt(Instant.now());
        return PurchaseOrderDtos.PurchaseOrderResponse.from(poRepository.save(po));
    }

    // ── Reorder suggestions ───────────────────────────────────────────────────
    // Returns ingredients that are at or below low_stock_threshold with reorder_qty set.
    // Creates draft POs grouped by preferred supplier.

    @Transactional(readOnly = true)
    public List<PurchaseOrderDtos.ReorderSuggestion> reorderSuggestions(String businessId) {
        merchantAccessService.requireOwnedBusiness(businessId);
        return ingredientRepository.findByBusiness_IdAndActiveTrueOrderByNameAsc(businessId).stream()
            .filter(i -> i.needsReorder())
            .map(i -> new PurchaseOrderDtos.ReorderSuggestion(
                i.getId(),
                i.getName(),
                i.getUnit(),
                i.getQtyOnHand(),
                i.getLowStockThreshold(),
                i.getParLevel(),
                i.getReorderQty(),
                i.getAvgUnitCost(),
                i.getSupplierId()
            ))
            .toList();
    }

    // ── Batch / expiry dashboard ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PurchaseOrderDtos.BatchResponse> listBatches(String businessId, Integer expiringWithinDays) {
        merchantAccessService.requireOwnedBusiness(businessId);
        List<IngredientBatch> batches = expiringWithinDays != null
            ? batchRepository.findExpiringBefore(businessId, java.time.LocalDate.now().plusDays(expiringWithinDays))
            : batchRepository.findActiveByBusiness(businessId);
        return batches.stream().map(PurchaseOrderDtos.BatchResponse::from).toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private PurchaseOrder require(String businessId, String poId) {
        merchantAccessService.requireOwnedBusiness(businessId);
        PurchaseOrder po = poRepository.findWithLinesById(poId)
            .orElseThrow(() -> new ApiException(404, "Purchase order not found."));
        if (!po.getBusiness().getId().equals(businessId)) {
            throw new ApiException(404, "Purchase order not found.");
        }
        return po;
    }

    private static String blankToEmpty(String s) {
        return s == null ? "" : s.trim();
    }
}
