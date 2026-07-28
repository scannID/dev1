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
import com.scanny.util.CodeUtils;
import java.util.List;
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
    private final String scanBaseUrl;

    public OperationsService(
            BusinessRepository businessRepository,
            CatalogItemRepository catalogItemRepository,
            OrderRepository orderRepository,
            BusinessTableRepository businessTableRepository,
            MerchantAccessService merchantAccessService,
            OperationsAccessService operationsAccessService,
            @Value("${scanny.scan-base-url}") String scanBaseUrl
    ) {
        this.businessRepository = businessRepository;
        this.catalogItemRepository = catalogItemRepository;
        this.orderRepository = orderRepository;
        this.businessTableRepository = businessTableRepository;
        this.merchantAccessService = merchantAccessService;
        this.operationsAccessService = operationsAccessService;
        this.scanBaseUrl = scanBaseUrl;
    }

    @Transactional(readOnly = true)
    public List<OperationsDtos.BranchResponse> listBranches(String businessId) {
        Business business = merchantAccessService.requireOwnedBusiness(businessId);
        return businessRepository.findByMerchantIdOrderByPrimaryDescBranchLabelAsc(business.getMerchantId()).stream()
                .map(OperationsDtos.BranchResponse::from)
                .toList();
    }

    @Transactional
    public OperationsDtos.BranchResponse createBranch(String businessId, OperationsDtos.CreateBranchRequest request) {
        Business source = merchantAccessService.requireOwnedBusiness(businessId);
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
        return Map.of(
                "acceptingOrders", business.isAcceptingOrders(),
                "busyMode", business.isBusyMode(),
                "busyEtaMinutes", business.getBusyEtaMinutes(),
                "pauseMessage", business.getPauseMessage()
        );
    }
}
