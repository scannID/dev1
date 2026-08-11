package com.scanny.service;

import com.scanny.dto.BusinessResponse;
import com.scanny.dto.CatalogDtos;
import com.scanny.dto.RequestDtos.CreateBusinessRequest;
import com.scanny.entity.Business;
import com.scanny.entity.CatalogItem;
import com.scanny.entity.Merchant;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.BusinessType;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.BusinessTableRepository;
import com.scanny.repository.CatalogItemRepository;
import com.scanny.repository.MerchantRepository;
import com.scanny.security.MerchantAccessService;
import com.scanny.config.RedisConfig;
import com.scanny.util.CodeUtils;
import com.scanny.util.CatalogCategories;
import com.scanny.util.WaitEstimate;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.repository.OrderRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BusinessService {

    private static final int POPULAR_LIMIT = 8;
    private static final int POPULAR_LOOKBACK_DAYS = 30;

    private final BusinessRepository businessRepository;
    private final CatalogItemRepository catalogItemRepository;
    private final BusinessTableRepository businessTableRepository;
    private final MerchantRepository merchantRepository;
    private final OrderRepository orderRepository;
    private final StarterCatalogService starterCatalogService;
    private final MerchantAccessService merchantAccessService;
    private final String scanBaseUrl;

    public BusinessService(
            BusinessRepository businessRepository,
            CatalogItemRepository catalogItemRepository,
            BusinessTableRepository businessTableRepository,
            MerchantRepository merchantRepository,
            OrderRepository orderRepository,
            StarterCatalogService starterCatalogService,
            MerchantAccessService merchantAccessService,
            @Value("${scanny.scan-base-url}") String scanBaseUrl
    ) {
        this.businessRepository = businessRepository;
        this.catalogItemRepository = catalogItemRepository;
        this.businessTableRepository = businessTableRepository;
        this.merchantRepository = merchantRepository;
        this.orderRepository = orderRepository;
        this.starterCatalogService = starterCatalogService;
        this.merchantAccessService = merchantAccessService;
        this.scanBaseUrl = scanBaseUrl;
    }

    @Transactional(readOnly = true)
    public List<BusinessResponse> listBusinesses() {
        if (merchantAccessService.isAdmin()) {
            return businessRepository.findAll().stream()
                    .map(business -> toResponse(business, true))
                    .toList();
        }
        Merchant merchant = merchantAccessService.requireCurrentMerchant();
        return businessRepository.findByMerchantIdOrderByPrimaryDescBranchLabelAsc(merchant.getId().toString()).stream()
                .map(business -> toResponse(business, true))
                .toList();
    }

    @Transactional(readOnly = true)
    public BusinessResponse getBusiness(String businessId) {
        Business business = requireBusiness(businessId);
        merchantAccessService.assertOwnsBusiness(business);
        return toResponse(business, true);
    }

    @Transactional(readOnly = true)
    public BusinessResponse getBusinessPublic(String businessId) {
        return toResponse(requireBusiness(businessId), false);
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = RedisConfig.BUSINESS_QR_CACHE, key = "#qrToken")
    public BusinessResponse getBusinessByQrToken(String qrToken) {
        Business business = businessRepository.findWithItemsByQrToken(qrToken)
                .orElseThrow(() -> new ApiException(404, "QR code was not found."));
        return toResponse(business, true);
    }

    @Transactional(readOnly = true)
    public Business requireBusiness(String businessId) {
        return businessRepository.findWithItemsById(businessId)
                .orElseThrow(() -> new ApiException(404, "Business was not found."));
    }

    /** Lightweight business load without catalog graph. */
    @Transactional(readOnly = true)
    public Business requireBusinessLight(String businessId) {
        return businessRepository.findById(businessId)
                .orElseThrow(() -> new ApiException(404, "Business was not found."));
    }

    private boolean isRoomAvailableToday(CatalogItem item) {
        if (!item.isLodging()) {
            return true;
        }
        // A room must be explicitly VACANT to appear in the customer-facing menu.
        // BOOKED, OCCUPIED, CHECKOUT_PENDING, and UNDER_MAINTENANCE are all hidden
        // from customers until the room is checked out and returns to VACANT.
        return item.getRoomStatus() == com.scanny.model.enums.RoomStatus.VACANT;
    }

    @Transactional(readOnly = true)
    public List<CatalogItem> getAvailableMenu(String businessId, String qrToken) {
        Business business = requireBusiness(businessId);
        assertMenuQrAllowed(business, qrToken);
        return business.getItems().stream()
                .filter(CatalogItem::isAvailable)
                // Lodging items only appear when vacant or check-out date reached.
                .filter(this::isRoomAvailableToday)
                .toList();
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = RedisConfig.MENU_CACHE, key = "#businessId")
    public List<CatalogDtos.CatalogItemResponse> getAvailableMenuCached(String businessId, String qrToken) {
        Business business = requireBusinessLight(businessId);
        assertMenuQrAllowed(business, qrToken);
        return catalogItemRepository.findByBusiness_IdAndAvailableTrue(businessId).stream()
                // Lodging items only appear when vacant or check-out date reached.
                .filter(this::isRoomAvailableToday)
                .map(CatalogDtos.CatalogItemResponse::from)
                .toList();
    }

    /** Accept business menu QR, or a valid active table QR for this business. */
    private void assertMenuQrAllowed(Business business, String qrToken) {
        if (qrToken == null || qrToken.isBlank() || qrToken.equals(business.getQrToken())) {
            return;
        }
        boolean tableQr = businessTableRepository.findByQrToken(qrToken)
                .filter(table -> table.isActive() && table.getBusiness() != null)
                .filter(table -> business.getId().equals(table.getBusiness().getId()))
                .isPresent();
        if (!tableQr) {
            throw new ApiException(403, "QR code does not match this business.");
        }
    }

    @Transactional(readOnly = true)
    public List<CatalogDtos.CatalogItemResponse> getPopularMenuItems(String businessId, int limit) {
        requireBusinessLight(businessId);
        Instant since = Instant.now().minus(POPULAR_LOOKBACK_DAYS, ChronoUnit.DAYS);
        int safeLimit = Math.min(Math.max(limit, 1), POPULAR_LIMIT);
        List<Object[]> rows = orderRepository.findPopularItemCounts(
                businessId,
                OrderStatus.Cancelled,
                since,
                PageRequest.of(0, safeLimit * 2)
        );
        if (rows.isEmpty()) {
            return List.of();
        }

        List<String> orderedIds = rows.stream()
                .map(row -> (String) row[0])
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        if (orderedIds.isEmpty()) {
            return List.of();
        }

        Map<String, CatalogItem> byId = catalogItemRepository.findByBusinessIdAndIdIn(businessId, orderedIds).stream()
                .filter(CatalogItem::isAvailable)
                // Don't surface non-vacant rooms as popular items in the customer booking view.
                .filter(this::isRoomAvailableToday)
                .collect(Collectors.toMap(CatalogItem::getId, Function.identity(), (a, b) -> a, LinkedHashMap::new));

        List<CatalogDtos.CatalogItemResponse> popular = new ArrayList<>();
        for (String id : orderedIds) {
            CatalogItem item = byId.get(id);
            if (item != null) {
                popular.add(CatalogDtos.CatalogItemResponse.from(item));
                if (popular.size() >= safeLimit) {
                    break;
                }
            }
        }
        return popular;
    }

    @Transactional(readOnly = true)
    public int estimateWaitMinutes(String businessId) {
        Business business = requireBusinessLight(businessId);
        long open = orderRepository.countByBusinessIdAndStatusIn(
                businessId,
                List.of(OrderStatus.Pending, OrderStatus.Preparing)
        );
        int base = WaitEstimate.estimateMinutes(open);
        if (business.isBusyMode()) {
            int busyEta = business.getBusyEtaMinutes();
            return Math.max(base, busyEta > 0 ? busyEta : base + 15);
        }
        return base;
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = RedisConfig.MENU_CACHE, key = "#businessId"),
            @CacheEvict(cacheNames = RedisConfig.BUSINESS_QR_CACHE, allEntries = true)
    })
    public void evictMenuCache(String businessId) {
        // annotation-driven
    }

    @Transactional
    public BusinessResponse createBusiness(CreateBusinessRequest request) {
        Merchant merchant = merchantAccessService.requireCurrentMerchant();
        String businessName = request.businessName().trim();
        String ownerName = request.ownerName().trim();
        BusinessType type = request.type() != null ? request.type() : BusinessType.Restaurant;

        if (businessName.isBlank() || ownerName.isBlank()) {
            throw new ApiException(400, "Business name and owner name are required.");
        }

        String baseId = CodeUtils.slugify(businessName);
        if (baseId.isBlank()) {
            baseId = "business-" + System.currentTimeMillis();
        }
        String id = businessRepository.existsById(baseId)
                ? baseId + "-" + String.valueOf(System.currentTimeMillis()).substring(6)
                : baseId;

        Business business = new Business();
        business.setId(id);
        business.setMerchantId(merchant.getId().toString());
        business.setQrToken(CodeUtils.makeCode("SCN", businessName));
        business.setName(businessName);
        business.setOwnerName(ownerName);
        business.setPhone(request.phone() != null ? request.phone().trim() : "");
        business.setType(type);
        business.setTableLabel(starterCatalogService.defaultTableLabel(type));
        business.setPaymentReference(CodeUtils.makeCode("PAY", businessName));
        business.setCreatedAt(Instant.now());
        business.setCustomCategories(new ArrayList<>(CatalogCategories.defaultNames(type)));

        starterCatalogService.buildStarterItems(type, id).forEach(business::addItem);

        Business saved = businessRepository.save(business);
        return toResponse(saved, true);
    }

    @Transactional(readOnly = true)
    public BusinessResponse getBusinessForMerchant(String merchantId) {
        merchantAccessService.requireMerchantById(UUID.fromString(merchantId));
        Business business = businessRepository.findFirstByMerchantIdOrderByPrimaryDescBranchLabelAsc(merchantId)
                .orElseThrow(() -> new ApiException(404, "Business was not found for this merchant."));
        return toResponse(business, true);
    }

    @Transactional(readOnly = true)
    public List<BusinessResponse> listBusinessesForMerchant(String merchantId) {
        merchantAccessService.requireMerchantById(UUID.fromString(merchantId));
        return businessRepository.findWithItemsByMerchantIdOrderByPrimaryDescBranchLabelAsc(merchantId).stream()
                .map(business -> toResponse(business, true))
                .toList();
    }

    @Transactional
    public BusinessResponse ensureBusinessForMerchant(Merchant merchant) {
        String merchantId = merchant.getId().toString();
        Business business = businessRepository.findFirstByMerchantIdOrderByPrimaryDescBranchLabelAsc(merchantId).orElse(null);

        if (business == null) {
            business = new Business();
            String baseId = CodeUtils.slugify(merchant.getBusinessName());
            if (baseId.isBlank()) {
                baseId = "merchant-" + merchantId.substring(0, 8);
            }
            String id = businessRepository.existsById(baseId)
                    ? baseId + "-" + merchantId.substring(0, 8)
                    : baseId;

            BusinessType type = mapMerchantType(merchant.getBusinessType());
            String qrToken = merchant.getQrCodeToken() != null
                    ? merchant.getQrCodeToken()
                    : CodeUtils.makeCode("SCN", merchant.getBusinessName());

            business.setId(id);
            business.setMerchantId(merchantId);
            business.setQrToken(qrToken);
            business.setName(merchant.getBusinessName());
            business.setOwnerName(merchant.getBusinessName());
            business.setPhone(merchant.getPhoneNumber() != null ? merchant.getPhoneNumber() : "");
            business.setType(type);
            business.setTableLabel(starterCatalogService.defaultTableLabel(type));
            business.setPaymentReference(CodeUtils.makeCode("PAY", merchant.getBusinessName()));
            business.setCreatedAt(Instant.now());
            business.setCustomCategories(new ArrayList<>(CatalogCategories.defaultNames(type)));

            starterCatalogService.buildStarterItems(type, id).forEach(business::addItem);
            business = businessRepository.save(business);
        } else {
            boolean dirty = false;
            if (merchant.getQrCodeToken() != null
                    && !merchant.getQrCodeToken().equals(business.getQrToken())) {
                business.setQrToken(merchant.getQrCodeToken());
                dirty = true;
            }

            BusinessType desiredType = mapMerchantType(merchant.getBusinessType());
            if (desiredType != business.getType()) {
                business.setType(desiredType);
                business.setTableLabel(starterCatalogService.defaultTableLabel(desiredType));
                for (String category : CatalogCategories.defaultNames(desiredType)) {
                    business.addCustomCategory(category);
                }
                if (desiredType == BusinessType.Hotel) {
                    ensureHotelLodgingCatalog(business);
                }
                if (merchant.getBusinessName() != null
                        && !merchant.getBusinessName().isBlank()
                        && !merchant.getBusinessName().equals(business.getName())) {
                    business.setName(merchant.getBusinessName());
                }
                dirty = true;
            } else if (desiredType == BusinessType.Hotel) {
                int before = business.getItems() != null ? business.getItems().size() : 0;
                ensureHotelLodgingCatalog(business);
                int after = business.getItems() != null ? business.getItems().size() : 0;
                if (after > before) {
                    dirty = true;
                }
            }

            if (dirty) {
                business = businessRepository.save(business);
            }
        }

        return toResponse(business, true);
    }

    /** Add rooms/suites (+ hotel food defaults) when a venue is promoted to Hotel. */
    private void ensureHotelLodgingCatalog(Business business) {
        java.util.Set<String> names = new java.util.HashSet<>();
        if (business.getItems() != null) {
            for (CatalogItem existing : business.getItems()) {
                if (existing.getName() != null) {
                    names.add(existing.getName().trim().toLowerCase(java.util.Locale.ROOT));
                }
            }
        }
        boolean hasLodging = business.getItems() != null && business.getItems().stream()
                .anyMatch(CatalogItem::isLodging);
        if (hasLodging) {
            return;
        }
        int index = (business.getItems() != null ? business.getItems().size() : 0) + 1;
        for (var spec : starterCatalogService.premiumHotelRooms()) {
            if (names.contains(spec.name().trim().toLowerCase(java.util.Locale.ROOT))) {
                continue;
            }
            CatalogItem item = new CatalogItem();
            item.setId(business.getId() + "-room-" + (index++));
            item.setName(spec.name());
            item.setCategory(spec.category());
            item.setPrice(spec.price());
            item.setDescription(spec.description());
            item.setAvailable(true);
            item.setItemKind(spec.kind());
            item.setCapacity(spec.capacity());
            item.setUnitsAvailable(spec.units());
            item.setAmenitiesJson(spec.amenitiesJson());
            business.addItem(item);
            business.addCustomCategory(spec.category());
        }
    }

    private BusinessResponse toResponse(Business business, boolean includeItems) {
        String logoUrl = null;
        try {
            logoUrl = merchantRepository.findById(UUID.fromString(business.getMerchantId()))
                    .map(Merchant::getBusinessLogoUrl)
                    .orElse(null);
        } catch (IllegalArgumentException ignored) {
            // Demo / legacy merchant ids are not UUIDs.
        }
        return BusinessResponse.from(
            business,
            scanBaseUrl,
            includeItems,
            logoUrl,
            CatalogCategories.merged(business)
        );
    }

    @Transactional
    public void syncQrToken(String merchantId, String qrToken) {
        businessRepository.findFirstByMerchantIdOrderByPrimaryDescBranchLabelAsc(merchantId).ifPresent(business -> {
            business.setQrToken(qrToken);
            businessRepository.save(business);
        });
    }

    private static BusinessType mapMerchantType(Merchant.BusinessType type) {
        if (type == null) {
            return BusinessType.Restaurant;
        }
        return switch (type) {
            case BAR -> BusinessType.Bar;
            case EVENT -> BusinessType.Boutique;
            case SALON -> BusinessType.Boutique;
            case RETAIL -> BusinessType.Boutique;
            case PARKING -> BusinessType.Boutique;
            case OTHER -> BusinessType.Restaurant;
            case RESTAURANT -> BusinessType.Restaurant;
            case HOTEL -> BusinessType.Hotel;
        };
    }
}
