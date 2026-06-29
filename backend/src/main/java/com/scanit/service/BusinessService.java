package com.scanit.service;

import com.scanit.dto.ApiDtos.BusinessResponse;
import com.scanit.dto.RequestDtos.CreateBusinessRequest;
import com.scanit.entity.Business;
import com.scanit.entity.CatalogItem;
import com.scanit.exception.ApiException;
import com.scanit.model.enums.BusinessType;
import com.scanit.repository.BusinessRepository;
import com.scanit.util.CodeUtils;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BusinessService {

    private final BusinessRepository businessRepository;
    private final StarterCatalogService starterCatalogService;
    private final String scanBaseUrl;

    public BusinessService(
            BusinessRepository businessRepository,
            StarterCatalogService starterCatalogService,
            @Value("${scanit.scan-base-url}") String scanBaseUrl
    ) {
        this.businessRepository = businessRepository;
        this.starterCatalogService = starterCatalogService;
        this.scanBaseUrl = scanBaseUrl;
    }

    @Transactional(readOnly = true)
    public List<BusinessResponse> listBusinesses() {
        return businessRepository.findAll().stream()
                .map(business -> BusinessResponse.from(business, scanBaseUrl, true))
                .toList();
    }

    @Transactional(readOnly = true)
    public BusinessResponse getBusiness(String businessId) {
        return BusinessResponse.from(requireBusiness(businessId), scanBaseUrl, true);
    }

    @Transactional(readOnly = true)
    public BusinessResponse getBusinessByQrToken(String qrToken) {
        Business business = businessRepository.findWithItemsByQrToken(qrToken)
                .orElseThrow(() -> new ApiException(404, "QR code was not found."));
        return BusinessResponse.from(business, scanBaseUrl, true);
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
        business.setMerchantId(CodeUtils.makeCode("MER", businessName));
        business.setQrToken(CodeUtils.makeCode("SIT", businessName));
        business.setName(businessName);
        business.setOwnerName(ownerName);
        business.setPhone(request.phone() != null ? request.phone().trim() : "");
        business.setType(type);
        business.setTableLabel(starterCatalogService.defaultTableLabel(type));
        business.setPaymentReference(CodeUtils.makeCode("PAY", businessName));
        business.setCreatedAt(Instant.now());

        starterCatalogService.buildStarterItems(type, id).forEach(business::addItem);

        Business saved = businessRepository.save(business);
        return BusinessResponse.from(saved, scanBaseUrl, true);
    }

}
