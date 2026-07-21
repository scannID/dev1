package com.scanny.service;

import com.scanny.dto.BusinessResponse;
import com.scanny.dto.RequestDtos.CreateBusinessRequest;
import com.scanny.entity.Business;
import com.scanny.entity.CatalogItem;
import com.scanny.entity.Merchant;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.BusinessType;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.MerchantRepository;
import com.scanny.security.MerchantAccessService;
import com.scanny.util.CodeUtils;
import com.scanny.util.CatalogCategories;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BusinessService {

    private final BusinessRepository businessRepository;
    private final MerchantRepository merchantRepository;
    private final StarterCatalogService starterCatalogService;
    private final MerchantAccessService merchantAccessService;
    private final String scanBaseUrl;

    public BusinessService(
            BusinessRepository businessRepository,
            MerchantRepository merchantRepository,
            StarterCatalogService starterCatalogService,
            MerchantAccessService merchantAccessService,
            @Value("${scanny.scan-base-url}") String scanBaseUrl
    ) {
        this.businessRepository = businessRepository;
        this.merchantRepository = merchantRepository;
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
        return businessRepository.findWithItemsByMerchantId(merchant.getId().toString())
                .map(business -> List.of(toResponse(business, true)))
                .orElse(List.of());
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

    @Transactional(readOnly = true)
    public List<CatalogItem> getAvailableMenu(String businessId, String qrToken) {
        Business business = requireBusiness(businessId);
        if (qrToken != null && !qrToken.isBlank() && !qrToken.equals(business.getQrToken())) {
            throw new ApiException(403, "QR code does not match this business.");
        }
        return business.getItems().stream().filter(CatalogItem::isAvailable).toList();
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
        Business business = businessRepository.findWithItemsByMerchantId(merchantId)
                .orElseThrow(() -> new ApiException(404, "Business was not found for this merchant."));
        return toResponse(business, true);
    }

    @Transactional
    public BusinessResponse ensureBusinessForMerchant(Merchant merchant) {
        String merchantId = merchant.getId().toString();
        Business business = businessRepository.findWithItemsByMerchantId(merchantId).orElse(null);

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
        } else if (merchant.getQrCodeToken() != null
                && !merchant.getQrCodeToken().equals(business.getQrToken())) {
            business.setQrToken(merchant.getQrCodeToken());
            business = businessRepository.save(business);
        }

        return toResponse(business, true);
    }

    private BusinessResponse toResponse(Business business, boolean includeItems) {
        String logoUrl = merchantRepository.findById(UUID.fromString(business.getMerchantId()))
                .map(Merchant::getBusinessLogoUrl)
                .orElse(null);
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
        businessRepository.findByMerchantId(merchantId).ifPresent(business -> {
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
        };
    }
}
