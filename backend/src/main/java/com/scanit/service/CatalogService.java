package com.scanit.service;

import com.scanit.dto.CatalogDtos;
import com.scanit.entity.Business;
import com.scanit.entity.CatalogItem;
import com.scanit.repository.BusinessRepository;
import com.scanit.repository.CatalogItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CatalogService {

    private final CatalogItemRepository catalogItemRepository;
    private final BusinessRepository businessRepository;

    public CatalogService(CatalogItemRepository catalogItemRepository, BusinessRepository businessRepository) {
        this.catalogItemRepository = catalogItemRepository;
        this.businessRepository = businessRepository;
    }

    @Transactional
    public CatalogDtos.CatalogItemResponse createCatalogItem(String businessId, CatalogDtos.CreateCatalogItemRequest request) {
        Business business = businessRepository.findById(businessId)
            .orElseThrow(() -> new RuntimeException("Business not found: " + businessId));

        CatalogItem item = new CatalogItem();
        item.setId(generateItemId());
        item.setBusiness(business);
        item.setName(request.name());
        item.setCategory(request.category());
        item.setPrice(request.price());
        item.setDescription(request.description() != null ? request.description() : "");
        item.setAvailable(request.available());

        item = catalogItemRepository.save(item);
        return CatalogDtos.CatalogItemResponse.from(item);
    }

    @Transactional
    public CatalogDtos.CatalogItemResponse updateCatalogItem(
        String businessId,
        String itemId,
        CatalogDtos.UpdateCatalogItemRequest request
    ) {
        CatalogItem item = catalogItemRepository.findById(itemId)
            .orElseThrow(() -> new RuntimeException("Catalog item not found: " + itemId));

        // Verify item belongs to business
        if (!item.getBusiness().getId().equals(businessId)) {
            throw new RuntimeException("Catalog item does not belong to business: " + businessId);
        }

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
        return CatalogDtos.CatalogItemResponse.from(item);
    }

    @Transactional
    public CatalogDtos.CatalogItemResponse updateAvailability(
        String businessId,
        String itemId,
        CatalogDtos.UpdateAvailabilityRequest request
    ) {
        CatalogItem item = catalogItemRepository.findById(itemId)
            .orElseThrow(() -> new RuntimeException("Catalog item not found: " + itemId));

        // Verify item belongs to business
        if (!item.getBusiness().getId().equals(businessId)) {
            throw new RuntimeException("Catalog item does not belong to business: " + businessId);
        }

        item.setAvailable(request.available());
        item = catalogItemRepository.save(item);
        return CatalogDtos.CatalogItemResponse.from(item);
    }

    @Transactional
    public void deleteCatalogItem(String businessId, String itemId) {
        CatalogItem item = catalogItemRepository.findById(itemId)
            .orElseThrow(() -> new RuntimeException("Catalog item not found: " + itemId));

        // Verify item belongs to business
        if (!item.getBusiness().getId().equals(businessId)) {
            throw new RuntimeException("Catalog item does not belong to business: " + businessId);
        }

        catalogItemRepository.delete(item);
    }

    @Transactional(readOnly = true)
    public List<CatalogDtos.CatalogItemResponse> getCatalogItems(String businessId) {
        Business business = businessRepository.findWithItemsById(businessId)
            .orElseThrow(() -> new RuntimeException("Business not found: " + businessId));

        return business.getItems().stream()
            .map(CatalogDtos.CatalogItemResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public CatalogDtos.CatalogItemResponse getCatalogItem(String businessId, String itemId) {
        CatalogItem item = catalogItemRepository.findById(itemId)
            .orElseThrow(() -> new RuntimeException("Catalog item not found: " + itemId));

        // Verify item belongs to business
        if (!item.getBusiness().getId().equals(businessId)) {
            throw new RuntimeException("Catalog item does not belong to business: " + businessId);
        }

        return CatalogDtos.CatalogItemResponse.from(item);
    }

    private String generateItemId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
