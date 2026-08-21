package com.scanny.controller;

import com.scanny.dto.InventoryDtos;
import com.scanny.service.InventoryService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/businesses/{businessId}/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping("/summary")
    public InventoryDtos.InventorySummaryResponse summary(@PathVariable String businessId) {
        return inventoryService.summary(businessId);
    }

    @GetMapping("/ingredients")
    public Map<String, List<InventoryDtos.IngredientResponse>> listIngredients(
            @PathVariable String businessId,
            @RequestParam(defaultValue = "false") boolean includeInactive
    ) {
        return Map.of("items", inventoryService.listIngredients(businessId, includeInactive));
    }

    @PostMapping("/ingredients")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, InventoryDtos.IngredientResponse> createIngredient(
            @PathVariable String businessId,
            @Valid @RequestBody InventoryDtos.CreateIngredientRequest request
    ) {
        return Map.of("item", inventoryService.createIngredient(businessId, request));
    }

    @PatchMapping("/ingredients/{ingredientId}")
    public Map<String, InventoryDtos.IngredientResponse> updateIngredient(
            @PathVariable String businessId,
            @PathVariable String ingredientId,
            @Valid @RequestBody InventoryDtos.UpdateIngredientRequest request
    ) {
        return Map.of("item", inventoryService.updateIngredient(businessId, ingredientId, request));
    }

    @PostMapping("/ingredients/{ingredientId}/receive")
    public Map<String, InventoryDtos.IngredientResponse> receiveStock(
            @PathVariable String businessId,
            @PathVariable String ingredientId,
            @Valid @RequestBody InventoryDtos.ReceiveStockRequest request
    ) {
        return Map.of("item", inventoryService.receiveStock(businessId, ingredientId, request));
    }

    @PostMapping("/ingredients/{ingredientId}/adjust")
    public Map<String, InventoryDtos.IngredientResponse> adjustStock(
            @PathVariable String businessId,
            @PathVariable String ingredientId,
            @Valid @RequestBody InventoryDtos.AdjustStockRequest request
    ) {
        return Map.of("item", inventoryService.adjustStock(businessId, ingredientId, request));
    }

    @PostMapping("/ingredients/{ingredientId}/waste")
    public Map<String, InventoryDtos.IngredientResponse> wasteStock(
            @PathVariable String businessId,
            @PathVariable String ingredientId,
            @Valid @RequestBody InventoryDtos.WasteStockRequest request
    ) {
        return Map.of("item", inventoryService.wasteStock(businessId, ingredientId, request));
    }

    @PostMapping("/ingredients/{ingredientId}/transfer")
    public InventoryDtos.TransferStockResponse transferStock(
            @PathVariable String businessId,
            @PathVariable String ingredientId,
            @Valid @RequestBody InventoryDtos.TransferStockRequest request
    ) {
        return inventoryService.transferStock(businessId, ingredientId, request);
    }

    @GetMapping("/catalog/{catalogItemId}/recipe")
    public InventoryDtos.RecipeResponse getRecipe(
            @PathVariable String businessId,
            @PathVariable String catalogItemId
    ) {
        return inventoryService.getRecipe(businessId, catalogItemId);
    }

    @PutMapping("/catalog/{catalogItemId}/recipe")
    public InventoryDtos.RecipeResponse setRecipe(
            @PathVariable String businessId,
            @PathVariable String catalogItemId,
            @Valid @RequestBody InventoryDtos.SetRecipeRequest request
    ) {
        return inventoryService.setRecipe(businessId, catalogItemId, request);
    }

    @GetMapping("/movements")
    public Map<String, List<InventoryDtos.StockMovementResponse>> listMovements(
            @PathVariable String businessId,
            @RequestParam(defaultValue = "50") int limit
    ) {
        return Map.of("items", inventoryService.listMovements(businessId, limit));
    }

    @GetMapping("/variance")
    public Map<String, List<InventoryDtos.VarianceRow>> variance(
            @PathVariable String businessId,
            @RequestParam String from,
            @RequestParam String to
    ) {
        java.time.Instant fromInstant = java.time.Instant.parse(from);
        java.time.Instant toInstant   = java.time.Instant.parse(to);
        return Map.of("items", inventoryService.varianceReport(businessId, fromInstant, toInstant));
    }

    @PatchMapping("/ingredients/{ingredientId}/par-level")
    public Map<String, InventoryDtos.IngredientResponse> updateParLevel(
            @PathVariable String businessId,
            @PathVariable String ingredientId,
            @RequestBody InventoryDtos.UpdateParLevelRequest request
    ) {
        return Map.of("item", inventoryService.updateParLevel(businessId, ingredientId, request));
    }
}
