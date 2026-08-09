package com.scanny.service;

import com.scanny.dto.OperationsDtos;
import com.scanny.dto.OperationsDtos.KitchenOrderResponse;
import com.scanny.dto.OperationsDtos.LowStockItemResponse;
import com.scanny.entity.Business;
import com.scanny.entity.CatalogItem;
import com.scanny.entity.Merchant;
import com.scanny.entity.Order;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.BusinessType;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.StaffRole;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.BusinessTableRepository;
import com.scanny.repository.CatalogItemRepository;
import com.scanny.repository.OrderRepository;
import com.scanny.security.MerchantAccessService;
import com.scanny.security.OperationsAccessService;
import com.scanny.service.StarterCatalogService;
import com.scanny.util.CatalogCategories;
import com.scanny.util.CodeUtils;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OperationsService {

    private final BusinessRepository businessRepository;
    private final CatalogItemRepository catalogItemRepository;
    private final OrderRepository orderRepository;
    private final BusinessTableRepository businessTableRepository;
    private final MerchantAccessService merchantAccessService;
    private final OperationsAccessService operationsAccessService;
    private final StarterCatalogService starterCatalogService;
    private final BusinessService businessService;
    private final SystemBusyModeService systemBusyModeService;
    private final String scanBaseUrl;

    public OperationsService(
            BusinessRepository businessRepository,
            CatalogItemRepository catalogItemRepository,
            OrderRepository orderRepository,
            BusinessTableRepository businessTableRepository,
            MerchantAccessService merchantAccessService,
            OperationsAccessService operationsAccessService,
            StarterCatalogService starterCatalogService,
            BusinessService businessService,
            SystemBusyModeService systemBusyModeService,
            @Value("${scanny.scan-base-url}") String scanBaseUrl
    ) {
        this.businessRepository = businessRepository;
        this.catalogItemRepository = catalogItemRepository;
        this.orderRepository = orderRepository;
        this.businessTableRepository = businessTableRepository;
        this.merchantAccessService = merchantAccessService;
        this.operationsAccessService = operationsAccessService;
        this.starterCatalogService = starterCatalogService;
        this.businessService = businessService;
        this.systemBusyModeService = systemBusyModeService;
        this.scanBaseUrl = scanBaseUrl;
    }

    private Business requireOwnerBusiness(String businessId) {
        merchantAccessService.requireMerchantOwner(businessId);
        return businessRepository.findWithItemsById(businessId)
                .orElseThrow(() -> new ApiException(404, "Business was not found."));
    }

    @Transactional(readOnly = true)
    public List<OperationsDtos.BranchResponse> listBranches(String businessId) {
        Business business = requireOwnerBusiness(businessId);
        return businessRepository.findByMerchantIdOrderByPrimaryDescBranchLabelAsc(business.getMerchantId()).stream()
                .map(OperationsDtos.BranchResponse::from)
                .toList();
    }

    @Transactional
    public OperationsDtos.BranchResponse createBranch(String businessId, OperationsDtos.CreateBranchRequest request) {
        Business source = requireOwnerBusiness(businessId);
        Merchant merchant = merchantAccessService.requireCurrentMerchant();

        Business branch = new Business();
        branch.setId(CodeUtils.slugify(request.branchLabel() + "-" + CodeUtils.randomToken(4)));
        branch.setMerchantId(merchant.getId().toString());
        branch.setQrToken(CodeUtils.randomToken(16));
        branch.setName(request.name().trim());
        branch.setOwnerName(source.getOwnerName());
        branch.setPhone(request.phone() != null ? request.phone().trim() : source.getPhone());
        branch.setType(source.getType());
        branch.setTableLabel(source.getTableLabel());
        branch.setPaymentReference(source.getPaymentReference());
        branch.setAccent(source.getAccent());
        branch.setBranchLabel(request.branchLabel().trim());
        branch.setPrimary(false);
        branch.setAddress(request.address() != null ? request.address().trim() : "");
        branch.setDailyDigestEmail(merchant.getEmail());

        return OperationsDtos.BranchResponse.from(businessRepository.save(branch));
    }

    /**
     * Builds a sibling branch catalog on demand.
     * Prefer copying from the merchant main branch (preserves item media), fallback to starter items.
     */
    @Transactional
    public OperationsDtos.BuildCatalogResponse buildCatalog(String businessId) {
        Business business = requireOwnerBusiness(businessId);

        if (business.isPrimary()) {
            throw new ApiException(400, "The main branch already has a catalog. Build catalog is for sibling branches only.");
        }

        Business mainBranch = requireMainBranchWithItems(business.getMerchantId());

        int existingItems = business.getItems() != null ? business.getItems().size() : 0;
        if (existingItems > 0) {
            // Catalog already exists — sync uploaded photos from Main onto matching items.
            int synced = syncCatalogMediaFromMain(business, mainBranch);
            businessService.evictMenuCache(businessId);
            return new OperationsDtos.BuildCatalogResponse(synced > 0, synced, existingItems);
        }

        List<CatalogItem> sourceItems = (mainBranch.getItems() == null || mainBranch.getItems().isEmpty())
                ? starterCatalogService.buildStarterItems(business.getType(), businessId)
                : cloneCatalogItems(mainBranch.getItems(), businessId);

        business.setCustomCategories(mainBranch.getCustomCategories() == null || mainBranch.getCustomCategories().isEmpty()
                ? new ArrayList<>(CatalogCategories.defaultNames(business.getType()))
                : new ArrayList<>(mainBranch.getCustomCategories()));
        sourceItems.forEach(business::addItem);

        Business saved = businessRepository.save(business);
        businessService.evictMenuCache(businessId);
        int itemsAdded = saved.getItems() != null ? saved.getItems().size() : 0;
        return new OperationsDtos.BuildCatalogResponse(true, itemsAdded, 0);
    }

    /**
     * Push Main-branch uploaded photos onto every sibling branch (matched by item name).
     */
    @Transactional
    public int syncAllBranchMediaFromMain(String merchantId) {
        List<Business> branches = businessRepository.findWithItemsByMerchantIdOrderByPrimaryDescBranchLabelAsc(merchantId);
        Business main = branches.stream()
                .filter(Business::isPrimary)
                .findFirst()
                .orElse(null);
        if (main == null || main.getItems() == null || main.getItems().isEmpty()) {
            return 0;
        }
        int synced = 0;
        for (Business branch : branches) {
            if (branch.isPrimary()) {
                continue;
            }
            int n = syncCatalogMediaFromMain(branch, main);
            if (n > 0) {
                businessService.evictMenuCache(branch.getId());
                synced += n;
            }
        }
        return synced;
    }

    private Business requireMainBranchWithItems(String merchantId) {
        return businessRepository.findWithItemsByMerchantIdOrderByPrimaryDescBranchLabelAsc(merchantId).stream()
                .filter(Business::isPrimary)
                .findFirst()
                .or(() -> businessRepository.findWithItemsByMerchantIdOrderByPrimaryDescBranchLabelAsc(merchantId).stream().findFirst())
                .orElseThrow(() -> new ApiException(404, "Main branch was not found."));
    }

    private int syncCatalogMediaFromMain(Business branch, Business mainBranch) {
        if (mainBranch.getItems() == null || mainBranch.getItems().isEmpty()) {
            return 0;
        }
        if (branch.getItems() == null || branch.getItems().isEmpty()) {
            return 0;
        }

        Map<String, CatalogItem> mainByName = new LinkedHashMap<>();
        for (CatalogItem source : mainBranch.getItems()) {
            if (source.getName() == null || source.getName().isBlank()) {
                continue;
            }
            mainByName.putIfAbsent(source.getName().trim().toLowerCase(Locale.ROOT), source);
        }

        int synced = 0;
        for (CatalogItem item : branch.getItems()) {
            if (item.getName() == null || item.getName().isBlank()) {
                continue;
            }
            CatalogItem source = mainByName.get(item.getName().trim().toLowerCase(Locale.ROOT));
            if (source == null) {
                continue;
            }
            String sourceCover = source.getImageUrl();
            String sourceGallery = source.getImageUrlsJson();
            boolean hasSourceMedia = (sourceCover != null && !sourceCover.isBlank())
                    || (sourceGallery != null && !sourceGallery.isBlank() && !"[]".equals(sourceGallery.trim()));
            if (!hasSourceMedia) {
                continue;
            }

            boolean changed = false;
            if (sourceCover != null && !sourceCover.equals(item.getImageUrl())) {
                item.setImageUrl(sourceCover);
                changed = true;
            }
            if (sourceGallery != null && !sourceGallery.equals(item.getImageUrlsJson())) {
                item.setImageUrlsJson(sourceGallery);
                changed = true;
            }
            if (changed) {
                catalogItemRepository.save(item);
                synced++;
            }
        }
        return synced;
    }

    private List<CatalogItem> cloneCatalogItems(List<CatalogItem> sourceItems, String businessId) {
        List<CatalogItem> clones = new ArrayList<>();
        int index = 1;
        for (CatalogItem source : sourceItems) {
            CatalogItem clone = new CatalogItem();
            clone.setId(businessId + "-" + index++);
            clone.setName(source.getName());
            clone.setCategory(source.getCategory());
            clone.setPrice(source.getPrice());
            clone.setDiscountPercent(source.getDiscountPercent());
            clone.setDescription(source.getDescription());
            clone.setImageUrl(source.getImageUrl());
            clone.setImageUrlsJson(source.getImageUrlsJson());
            clone.setDetails(source.getDetails());
            clone.setIngredientsJson(source.getIngredientsJson());
            clone.setAvailable(source.isAvailable());
            clone.setItemKind(source.getItemKind());
            clone.setCapacity(source.getCapacity());
            clone.setAmenitiesJson(source.getAmenitiesJson());
            clone.setUnitsAvailable(source.getUnitsAvailable());
            clone.setTrackStock(source.isTrackStock());
            clone.setLowStockThreshold(source.getLowStockThreshold());
            clones.add(clone);
        }
        return clones;
    }

    @Transactional(readOnly = true)
    public OperationsDtos.OperationsSettingsResponse getSettings(String businessId) {
        return OperationsDtos.OperationsSettingsResponse.from(merchantAccessService.requireOwnedBusiness(businessId));
    }

    @Transactional
    public OperationsDtos.OperationsSettingsResponse updateSettings(
            String businessId,
            OperationsDtos.UpdateOperationsSettingsRequest request
    ) {
        Business business = merchantAccessService.requireOwnedBusiness(businessId);
        boolean wasBusy = business.isBusyMode();
        if (request.acceptingOrders() != null) {
            business.setAcceptingOrders(request.acceptingOrders());
        }
        if (request.busyMode() != null) {
            business.setBusyMode(request.busyMode());
        }
        if (request.busyEtaMinutes() != null) {
            business.setBusyEtaMinutes(request.busyEtaMinutes());
        }
        if (request.pauseMessage() != null) {
            business.setPauseMessage(request.pauseMessage());
        }
        if (request.whatsappNotificationsEnabled() != null) {
            business.setWhatsappNotificationsEnabled(request.whatsappNotificationsEnabled());
        }
        if (request.whatsappBusinessPhone() != null) {
            business.setWhatsappBusinessPhone(request.whatsappBusinessPhone());
        }
        if (request.dailyDigestEnabled() != null) {
            business.setDailyDigestEnabled(request.dailyDigestEnabled());
        }
        if (request.dailyDigestChannel() != null) {
            business.setDailyDigestChannel(request.dailyDigestChannel());
        }
        if (request.dailyDigestEmail() != null) {
            business.setDailyDigestEmail(request.dailyDigestEmail());
        }

        // Entering busy mode: ensure ETA is set so customer wait estimates rise.
        if (business.isBusyMode() && !wasBusy && business.getBusyEtaMinutes() <= 0) {
            business.setBusyEtaMinutes(20);
        }
        if (business.isBusyMode() && business.getPauseMessage().isBlank()) {
            business.setPauseMessage("We're busy — orders may take longer.");
        }

        Business saved = businessRepository.save(business);

        // When pausing orders entirely, mark track-stock items with 0 units unavailable.
        if (Boolean.FALSE.equals(request.acceptingOrders())) {
            catalogItemRepository.findByBusiness_IdOrderByNameAsc(businessId).stream()
                    .filter(CatalogItem::isTrackStock)
                    .filter(item -> item.getUnitsAvailable() <= 0 && item.isAvailable())
                    .forEach(item -> {
                        item.setAvailable(false);
                        catalogItemRepository.save(item);
                    });
        }

        return OperationsDtos.OperationsSettingsResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<KitchenOrderResponse> kitchenOrders(String businessId, String staffSession) {
        operationsAccessService.requireMerchantOrStaff(businessId, staffSession, OperationsAccessService.kitchenRoles());
        List<OrderStatus> active = List.of(OrderStatus.Pending, OrderStatus.Preparing, OrderStatus.Ready);
        Map<String, String> tableLabels = businessTableRepository.findByBusinessIdOrderByLabelAsc(businessId).stream()
                .collect(Collectors.toMap(t -> t.getId(), t -> t.getLabel(), (a, b) -> a));

        return orderRepository.findByBusinessIdAndStatusInOrderByCreatedAtAsc(businessId, active).stream()
                // Skip orders that contain only lodging items — nothing for the kitchen to prepare.
                .filter(order -> order.getItems().stream().anyMatch(line -> !line.isLodging()))
                .map(order -> KitchenOrderResponse.from(order, tableLabels.getOrDefault(order.getTableId(), "")))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<LowStockItemResponse> lowStockItems(String businessId, String staffSession) {
        operationsAccessService.requireMerchantOrStaff(
                businessId, staffSession, StaffRole.MANAGER, StaffRole.KITCHEN, StaffRole.CASHIER);
        return catalogItemRepository.findByBusiness_IdOrderByNameAsc(businessId).stream()
                .filter(CatalogItem::isLowStock)
                .map(item -> new LowStockItemResponse(
                        item.getId(),
                        item.getName(),
                        item.getUnitsAvailable(),
                        item.getLowStockThreshold(),
                        item.isAvailable()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> publicOperationsStatus(String businessId) {
        Business business = businessRepository.findById(businessId)
                .orElseThrow(() -> new ApiException(404, "Business was not found."));
        boolean systemBusy = systemBusyModeService.isSystemBusy();
        String systemMessage = systemBusy ? systemBusyModeService.getPauseMessage() : "";
        boolean suspended = !business.isAcceptingOrders() && !systemBusy;
        return Map.of(
                "acceptingOrders", business.isAcceptingOrders() && !systemBusy,
                "busyMode", business.isBusyMode() || systemBusy,
                "busyEtaMinutes", business.getBusyEtaMinutes(),
                "pauseMessage", systemBusy ? systemMessage : business.getPauseMessage(),
                "systemBusy", systemBusy,
                "suspended", suspended
        );
    }
}
