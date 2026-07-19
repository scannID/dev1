package com.scanny.service;

import com.scanny.dto.CatalogDtos;
import com.scanny.entity.Business;
import com.scanny.entity.CatalogItem;
import com.scanny.exception.ApiException;
import com.scanny.repository.CatalogItemRepository;
import com.scanny.security.MerchantAccessService;
import com.scanny.websocket.RealtimeEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CatalogService {

    private final CatalogItemRepository catalogItemRepository;
    private final MerchantAccessService merchantAccessService;
    private final AuditService auditService;
    private final RealtimeEventPublisher realtimeEventPublisher;

    public CatalogService(
            CatalogItemRepository catalogItemRepository,
            MerchantAccessService merchantAccessService,
            AuditService auditService,
            RealtimeEventPublisher realtimeEventPublisher
    ) {
        this.catalogItemRepository = catalogItemRepository;
        this.merchantAccessService = merchantAccessService;
        this.auditService = auditService;
        this.realtimeEventPublisher = realtimeEventPublisher;
    }

    @Transactional(readOnly = true)
    public List<CatalogDtos.CatalogItemResponse> getCatalogItems(String businessId) {
        Business business = merchantAccessService.requireOwnedBusiness(businessId);
        return business.getItems().stream().map(CatalogDtos.CatalogItemResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public CatalogDtos.CatalogItemResponse getCatalogItem(String businessId, String itemId) {
        CatalogItem item = requireOwnedItem(businessId, itemId);
        return CatalogDtos.CatalogItemResponse.from(item);
    }

    @Transactional
    public CatalogDtos.CatalogItemResponse createCatalogItem(String businessId, CatalogDtos.CreateCatalogItemRequest request) {
        Business business = merchantAccessService.requireOwnedBusiness(businessId);

        CatalogItem item = new CatalogItem();
        item.setId(generateItemId());
        item.setBusiness(business);
        item.setName(request.name());
        item.setCategory(request.category());
        item.setPrice(request.price());
        item.setDescription(request.description() != null ? request.description() : "");
        item.setAvailable(request.available());

        item = catalogItemRepository.save(item);
        CatalogDtos.CatalogItemResponse response = CatalogDtos.CatalogItemResponse.from(item);
        realtimeEventPublisher.publishCatalogEvent(businessId, "CATALOG_ITEM_CREATED", response);
        auditService.success("CATALOG_ITEM_CREATED", "catalog_item", item.getId(), Map.of("businessId", businessId));
        return response;
    }

    @Transactional
    public CatalogDtos.CatalogItemResponse updateCatalogItem(
            String businessId,
            String itemId,
            CatalogDtos.UpdateCatalogItemRequest request
    ) {
        CatalogItem item = requireOwnedItem(businessId, itemId);

        if (request.name() != null) {
            item.setName(request.name());
        }
        if (request.category() != null) {
            item.setCategory(request.category());
        }
        if (request.price() != null) {
            item.setPrice(request.price());
        }
        if (request.description() != null) {
            item.setDescription(request.description());
        }
        if (request.available() != null) {
            item.setAvailable(request.available());
        }

        item = catalogItemRepository.save(item);
        CatalogDtos.CatalogItemResponse response = CatalogDtos.CatalogItemResponse.from(item);
        realtimeEventPublisher.publishCatalogEvent(businessId, "CATALOG_ITEM_UPDATED", response);
        return response;
    }

    @Transactional
    public CatalogDtos.CatalogItemResponse updateAvailability(
            String businessId,
            String itemId,
            CatalogDtos.UpdateAvailabilityRequest request
    ) {
        CatalogItem item = requireOwnedItem(businessId, itemId);
        item.setAvailable(request.available());
        item = catalogItemRepository.save(item);
        CatalogDtos.CatalogItemResponse response = CatalogDtos.CatalogItemResponse.from(item);
        realtimeEventPublisher.publishCatalogEvent(businessId, "CATALOG_AVAILABILITY_UPDATED", response);
        return response;
    }

    @Transactional
    public void deleteCatalogItem(String businessId, String itemId) {
        CatalogItem item = requireOwnedItem(businessId, itemId);
        catalogItemRepository.delete(item);
        realtimeEventPublisher.publishCatalogEvent(businessId, "CATALOG_ITEM_DELETED", Map.of("id", itemId));
        auditService.success("CATALOG_ITEM_DELETED", "catalog_item", itemId, Map.of("businessId", businessId));
    }

    private CatalogItem requireOwnedItem(String businessId, String itemId) {
        merchantAccessService.assertOwnsBusinessId(businessId);
        CatalogItem item = catalogItemRepository.findById(itemId)
                .orElseThrow(() -> new ApiException(404, "Catalog item not found: " + itemId));
        if (!item.getBusiness().getId().equals(businessId)) {
            throw new ApiException(403, "Catalog item does not belong to business: " + businessId);
        }
        return item;
    }

    private String generateItemId() {
        return "ITM-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
