package com.scanny.service;

import com.scanny.dto.CatalogDtos;
import com.scanny.dto.PageDtos;
import com.scanny.entity.Business;
import com.scanny.entity.CatalogItem;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.ItemKind;
import com.scanny.repository.CatalogItemRepository;
import com.scanny.repository.BusinessRepository;
import com.scanny.security.MerchantAccessService;
import com.scanny.util.CatalogCategories;
import com.scanny.util.CatalogImageUrls;
import com.scanny.util.CatalogPricing;
import com.scanny.util.JsonLists;
import com.scanny.websocket.RealtimeEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CatalogService {

    private final CatalogItemRepository catalogItemRepository;
    private final BusinessRepository businessRepository;
    private final MerchantAccessService merchantAccessService;
    private final AuditService auditService;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final BusinessService businessService;

    public CatalogService(
            CatalogItemRepository catalogItemRepository,
            BusinessRepository businessRepository,
            MerchantAccessService merchantAccessService,
            AuditService auditService,
            RealtimeEventPublisher realtimeEventPublisher,
            BusinessService businessService
    ) {
        this.catalogItemRepository = catalogItemRepository;
        this.businessRepository = businessRepository;
        this.merchantAccessService = merchantAccessService;
        this.auditService = auditService;
        this.realtimeEventPublisher = realtimeEventPublisher;
        this.businessService = businessService;
    }

    @Transactional(readOnly = true)
    public List<CatalogDtos.CatalogItemResponse> getCatalogItems(String businessId) {
        Business business = merchantAccessService.requireOwnedBusiness(businessId);
        return business.getItems().stream().map(CatalogDtos.CatalogItemResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public CatalogDtos.CatalogItemsPageResponse getCatalogItemsPaged(
            String businessId,
            int page,
            int size,
            String search,
            String category,
            Boolean available,
            Boolean lodging
    ) {
        merchantAccessService.requireOwnedBusiness(businessId);
        int safePage = Math.max(page, 1);
        int safeSize = Math.min(Math.max(size, 1), 100);
        String normalizedSearch = blankToNull(search);
        String normalizedCategory = blankToNull(category);

        Pageable pageable = PageRequest.of(safePage - 1, safeSize, Sort.by(Sort.Direction.ASC, "name"));
        Page<CatalogItem> result = catalogItemRepository.searchByBusiness(
                businessId,
                normalizedSearch,
                normalizedCategory,
                available,
                lodging,
                pageable
        );

        return new CatalogDtos.CatalogItemsPageResponse(
                result.getContent().stream().map(CatalogDtos.CatalogItemResponse::from).toList(),
                PageDtos.PaginationMeta.from(result)
        );
    }

    private static String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @Transactional(readOnly = true)
    public CatalogDtos.CatalogItemResponse getCatalogItem(String businessId, String itemId) {
        CatalogItem item = requireOwnedItem(businessId, itemId);
        return CatalogDtos.CatalogItemResponse.from(item);
    }

    @Transactional(readOnly = true)
    public CatalogDtos.CategoriesResponse listCategories(String businessId) {
        Business business = merchantAccessService.requireOwnedBusiness(businessId);
        return new CatalogDtos.CategoriesResponse(CatalogCategories.merged(business));
    }

    @Transactional
    public CatalogDtos.CategoriesResponse addCustomCategory(String businessId, String rawName) {
        Business business = merchantAccessService.requireOwnedBusiness(businessId);
        String name = CatalogCategories.normalize(rawName);
        if (name.isBlank()) {
            throw new ApiException(400, "Category name is required.");
        }
        business.addCustomCategory(name);
        businessRepository.save(business);
        auditService.success("CATALOG_CATEGORY_ADDED", "business", businessId, Map.of("category", name));
        return new CatalogDtos.CategoriesResponse(CatalogCategories.merged(business));
    }

    @Transactional
    public CatalogDtos.CatalogItemResponse createCatalogItem(String businessId, CatalogDtos.CreateCatalogItemRequest request) {
        Business business = merchantAccessService.requireOwnedBusiness(businessId);

        String category = CatalogCategories.normalize(request.category());
        if (category.isBlank()) {
            throw new ApiException(400, "Category is required.");
        }
        if (request.name() == null || request.name().isBlank()) {
            throw new ApiException(400, "Name is required.");
        }
        if (request.price() <= 0) {
            throw new ApiException(400, "Price must be greater than zero.");
        }

        ItemKind kind = request.itemKind() != null ? request.itemKind() : ItemKind.FOOD;
        List<String> gallery = CatalogImageUrls.normalizeGallery(request.imageUrls());
        String cover = CatalogImageUrls.normalizeOptional(request.imageUrl());
        if (cover == null && !gallery.isEmpty()) {
            cover = gallery.get(0);
        }
        if (gallery.isEmpty() && cover != null) {
            gallery = List.of(cover);
        }

        CatalogItem item = new CatalogItem();
        item.setId(generateItemId());
        item.setName(request.name().trim());
        item.setCategory(category);
        item.setPrice(request.price());
        item.setDiscountPercent(requireDiscountPercent(request.discountPercent()));
        item.setDescription(request.description() != null ? request.description() : "");
        item.setImageUrl(cover);
        item.setImageUrlsJson(JsonLists.writeStringList(gallery));
        item.setDetails(request.details() != null ? request.details().trim() : "");
        item.setIngredientsJson(JsonLists.writeIngredients(
                kind == ItemKind.FOOD ? request.ingredients() : List.of()
        ));
        item.setAvailable(request.available());
        item.setItemKind(kind);
        applyLodgingFields(item, kind, request.capacity(), request.amenities(), request.unitsAvailable());

        business.addCustomCategory(category);
        business.addItem(item);
        businessRepository.save(business);

        item = catalogItemRepository.save(item);
        businessService.evictMenuCache(businessId);
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
            String category = CatalogCategories.normalize(request.category());
            if (category.isBlank()) {
                throw new ApiException(400, "Category is required.");
            }
            item.setCategory(category);
            item.getBusiness().addCustomCategory(category);
            businessRepository.save(item.getBusiness());
        }
        if (request.price() != null) {
            item.setPrice(request.price());
        }
        if (request.discountPercent() != null) {
            item.setDiscountPercent(requireDiscountPercent(request.discountPercent()));
        }
        if (request.description() != null) {
            item.setDescription(request.description());
        }
        if (request.imageUrls() != null) {
            List<String> gallery = CatalogImageUrls.normalizeGallery(request.imageUrls());
            item.setImageUrlsJson(JsonLists.writeStringList(gallery));
            if (!gallery.isEmpty()) {
                item.setImageUrl(gallery.get(0));
            } else if (request.imageUrl() == null) {
                item.setImageUrl(null);
            }
        }
        if (request.imageUrl() != null) {
            String cover = CatalogImageUrls.normalizeOptional(request.imageUrl());
            item.setImageUrl(cover);
            if (request.imageUrls() == null && cover != null) {
                List<String> existing = JsonLists.readStringList(item.getImageUrlsJson());
                if (existing.isEmpty()) {
                    item.setImageUrlsJson(JsonLists.writeStringList(List.of(cover)));
                }
            }
        }
        if (request.details() != null) {
            item.setDetails(request.details().trim());
        }
        if (request.ingredients() != null) {
            item.setIngredientsJson(JsonLists.writeIngredients(request.ingredients()));
        }
        if (request.available() != null) {
            item.setAvailable(request.available());
        }
        if (request.itemKind() != null) {
            item.setItemKind(request.itemKind());
        }
        ItemKind kind = item.getItemKind();
        if (request.capacity() != null || request.amenities() != null || request.unitsAvailable() != null || request.itemKind() != null) {
            applyLodgingFields(
                    item,
                    kind,
                    request.capacity() != null ? request.capacity() : item.getCapacity(),
                    request.amenities() != null ? request.amenities() : JsonLists.readStringList(item.getAmenitiesJson()),
                    request.unitsAvailable() != null ? request.unitsAvailable() : item.getUnitsAvailable()
            );
        }

        item = catalogItemRepository.save(item);
        businessService.evictMenuCache(businessId);
        CatalogDtos.CatalogItemResponse response = CatalogDtos.CatalogItemResponse.from(item);
        realtimeEventPublisher.publishCatalogEvent(businessId, "CATALOG_ITEM_UPDATED", response);
        auditService.success("CATALOG_ITEM_UPDATED", "catalog_item", itemId, Map.of("businessId", businessId));
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
        businessService.evictMenuCache(businessId);
        CatalogDtos.CatalogItemResponse response = CatalogDtos.CatalogItemResponse.from(item);
        realtimeEventPublisher.publishCatalogEvent(businessId, "CATALOG_AVAILABILITY_UPDATED", response);
        return response;
    }

    @Transactional
    public void deleteCatalogItem(String businessId, String itemId) {
        CatalogItem item = requireOwnedItem(businessId, itemId);
        item.getBusiness().getItems().remove(item);
        catalogItemRepository.delete(item);
        businessService.evictMenuCache(businessId);
        realtimeEventPublisher.publishCatalogEvent(businessId, "CATALOG_ITEM_DELETED", Map.of("id", itemId));
        auditService.success("CATALOG_ITEM_DELETED", "catalog_item", itemId, Map.of("businessId", businessId));
    }

    private static void applyLodgingFields(
            CatalogItem item,
            ItemKind kind,
            Integer capacity,
            List<String> amenities,
            Integer unitsAvailable
    ) {
        if (kind == ItemKind.ROOM || kind == ItemKind.SUITE) {
            int cap = capacity != null ? capacity : 2;
            if (cap < 1) {
                throw new ApiException(400, "Capacity must be at least 1 guest for rooms and suites.");
            }
            int units = unitsAvailable != null ? unitsAvailable : 1;
            if (units < 1) {
                throw new ApiException(400, "Units available must be at least 1 for rooms and suites.");
            }
            item.setCapacity(cap);
            item.setUnitsAvailable(units);
            item.setAmenitiesJson(JsonLists.writeStringList(amenities));
            item.setIngredientsJson("[]");
        } else {
            item.setCapacity(0);
            item.setUnitsAvailable(0);
            item.setAmenitiesJson("[]");
        }
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

    private static int requireDiscountPercent(Integer discountPercent) {
        try {
            return CatalogPricing.clampDiscountPercent(discountPercent);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(400, ex.getMessage());
        }
    }

    private String generateItemId() {
        return "ITM-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
