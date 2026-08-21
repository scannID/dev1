package com.scanny.controller;

import com.scanny.dto.PurchaseOrderDtos;
import com.scanny.service.PurchaseOrderService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/businesses/{businessId}/purchase-orders")
public class PurchaseOrderController {

    private final PurchaseOrderService purchaseOrderService;

    public PurchaseOrderController(PurchaseOrderService purchaseOrderService) {
        this.purchaseOrderService = purchaseOrderService;
    }

    @GetMapping
    public Map<String, List<PurchaseOrderDtos.PurchaseOrderResponse>> list(
            @PathVariable String businessId,
            @RequestParam(required = false) String status) {
        return Map.of("items", purchaseOrderService.list(businessId, status));
    }

    @GetMapping("/{poId}")
    public PurchaseOrderDtos.PurchaseOrderResponse get(
            @PathVariable String businessId,
            @PathVariable String poId) {
        return purchaseOrderService.get(businessId, poId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseOrderDtos.PurchaseOrderResponse create(
            @PathVariable String businessId,
            @Valid @RequestBody PurchaseOrderDtos.CreatePurchaseOrderRequest request) {
        return purchaseOrderService.create(businessId, request);
    }

    @PostMapping("/{poId}/send")
    public PurchaseOrderDtos.PurchaseOrderResponse markSent(
            @PathVariable String businessId,
            @PathVariable String poId) {
        return purchaseOrderService.markSent(businessId, poId);
    }

    @PostMapping("/{poId}/receive")
    public PurchaseOrderDtos.PurchaseOrderResponse receive(
            @PathVariable String businessId,
            @PathVariable String poId,
            @Valid @RequestBody PurchaseOrderDtos.ReceivePurchaseOrderRequest request) {
        return purchaseOrderService.receive(businessId, poId, request);
    }

    @PostMapping("/{poId}/cancel")
    public PurchaseOrderDtos.PurchaseOrderResponse cancel(
            @PathVariable String businessId,
            @PathVariable String poId) {
        return purchaseOrderService.cancel(businessId, poId);
    }

    /** Ingredients that are low stock and have a reorder_qty set — ready to raise a PO. */
    @GetMapping("/reorder-suggestions")
    public Map<String, List<PurchaseOrderDtos.ReorderSuggestion>> reorderSuggestions(
            @PathVariable String businessId) {
        return Map.of("items", purchaseOrderService.reorderSuggestions(businessId));
    }

    /** Active ingredient batches, optionally filtered to those expiring within N days. */
    @GetMapping("/batches")
    public Map<String, List<PurchaseOrderDtos.BatchResponse>> batches(
            @PathVariable String businessId,
            @RequestParam(required = false) Integer expiringWithinDays) {
        return Map.of("items", purchaseOrderService.listBatches(businessId, expiringWithinDays));
    }
}
