package com.scanit.controller;

import com.scanit.dto.CatalogDtos;
import com.scanit.service.CatalogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/businesses/{businessId}/catalog")
public class CatalogController {

    private final CatalogService catalogService;

    public CatalogController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping
    public Map<String, List<CatalogDtos.CatalogItemResponse>> getCatalogItems(@PathVariable String businessId) {
        return Map.of("items", catalogService.getCatalogItems(businessId));
    }

    @GetMapping("/{itemId}")
    public Map<String, CatalogDtos.CatalogItemResponse> getCatalogItem(
        @PathVariable String businessId,
        @PathVariable String itemId
    ) {
        return Map.of("item", catalogService.getCatalogItem(businessId, itemId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, CatalogDtos.CatalogItemResponse> createCatalogItem(
        @PathVariable String businessId,
        @Valid @RequestBody CatalogDtos.CreateCatalogItemRequest request
    ) {
        return Map.of("item", catalogService.createCatalogItem(businessId, request));
    }

    @PatchMapping("/{itemId}")
    public Map<String, CatalogDtos.CatalogItemResponse> updateCatalogItem(
        @PathVariable String businessId,
        @PathVariable String itemId,
        @Valid @RequestBody CatalogDtos.UpdateCatalogItemRequest request
    ) {
        return Map.of("item", catalogService.updateCatalogItem(businessId, itemId, request));
    }

    @PatchMapping("/{itemId}/availability")
    public Map<String, CatalogDtos.CatalogItemResponse> updateAvailability(
        @PathVariable String businessId,
        @PathVariable String itemId,
        @Valid @RequestBody CatalogDtos.UpdateAvailabilityRequest request
    ) {
        return Map.of("item", catalogService.updateAvailability(businessId, itemId, request));
    }

    @DeleteMapping("/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCatalogItem(
        @PathVariable String businessId,
        @PathVariable String itemId
    ) {
        catalogService.deleteCatalogItem(businessId, itemId);
    }
}
