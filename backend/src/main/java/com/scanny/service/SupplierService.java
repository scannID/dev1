package com.scanny.service;

import com.scanny.dto.SupplierDtos;
import com.scanny.entity.Business;
import com.scanny.entity.Supplier;
import com.scanny.exception.ApiException;
import com.scanny.repository.SupplierRepository;
import com.scanny.security.MerchantAccessService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final MerchantAccessService merchantAccessService;

    public SupplierService(SupplierRepository supplierRepository,
                           MerchantAccessService merchantAccessService) {
        this.supplierRepository = supplierRepository;
        this.merchantAccessService = merchantAccessService;
    }

    @Transactional(readOnly = true)
    public List<SupplierDtos.SupplierResponse> list(String businessId, boolean includeInactive) {
        merchantAccessService.requireOwnedBusiness(businessId);
        List<Supplier> items = includeInactive
            ? supplierRepository.findByBusiness_IdOrderByNameAsc(businessId)
            : supplierRepository.findByBusiness_IdAndActiveTrueOrderByNameAsc(businessId);
        return items.stream().map(SupplierDtos.SupplierResponse::from).toList();
    }

    @Transactional
    public SupplierDtos.SupplierResponse create(String businessId, SupplierDtos.CreateSupplierRequest req) {
        Business business = merchantAccessService.requireOwnedBusiness(businessId);
        String name = req.name().trim();
        if (supplierRepository.existsByBusiness_IdAndNameIgnoreCase(businessId, name)) {
            throw new ApiException(409, "A supplier with that name already exists.");
        }
        Supplier s = new Supplier();
        s.setId("SUP-" + UUID.randomUUID().toString().replace("-","").substring(0, 8).toUpperCase(Locale.ROOT));
        s.setBusiness(business);
        s.setName(name);
        s.setContactName(blankToEmpty(req.contactName()));
        s.setPhone(blankToEmpty(req.phone()));
        s.setEmail(blankToEmpty(req.email()));
        s.setAddress(blankToEmpty(req.address()));
        s.setNotes(blankToEmpty(req.notes()));
        return SupplierDtos.SupplierResponse.from(supplierRepository.save(s));
    }

    @Transactional
    public SupplierDtos.SupplierResponse update(String businessId, String supplierId, SupplierDtos.UpdateSupplierRequest req) {
        Supplier s = require(businessId, supplierId);
        if (req.name() != null && !req.name().isBlank()) {
            String name = req.name().trim();
            if (!name.equalsIgnoreCase(s.getName()) &&
                supplierRepository.existsByBusiness_IdAndNameIgnoreCase(businessId, name)) {
                throw new ApiException(409, "A supplier with that name already exists.");
            }
            s.setName(name);
        }
        if (req.contactName() != null) s.setContactName(req.contactName().trim());
        if (req.phone() != null) s.setPhone(req.phone().trim());
        if (req.email() != null) s.setEmail(req.email().trim());
        if (req.address() != null) s.setAddress(req.address().trim());
        if (req.notes() != null) s.setNotes(req.notes().trim());
        if (req.active() != null) s.setActive(req.active());
        s.setUpdatedAt(Instant.now());
        return SupplierDtos.SupplierResponse.from(supplierRepository.save(s));
    }

    private Supplier require(String businessId, String supplierId) {
        merchantAccessService.requireOwnedBusiness(businessId);
        Supplier s = supplierRepository.findById(supplierId)
            .orElseThrow(() -> new ApiException(404, "Supplier not found."));
        if (!s.getBusiness().getId().equals(businessId)) {
            throw new ApiException(404, "Supplier not found.");
        }
        return s;
    }

    private static String blankToEmpty(String s) {
        return s == null ? "" : s.trim();
    }
}
