package com.scanny.controller;

import com.scanny.dto.admin.AdminMerchantDtos;
import com.scanny.service.AdminMerchantsService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/merchants")
public class AdminMerchantsController {

    private final AdminMerchantsService adminMerchantsService;

    public AdminMerchantsController(AdminMerchantsService adminMerchantsService) {
        this.adminMerchantsService = adminMerchantsService;
    }

    @GetMapping
    public AdminMerchantDtos.MerchantsListResponse listMerchants(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int limit,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String type
    ) {
        return adminMerchantsService.listMerchants(page, limit, search, status, type);
    }

    @GetMapping("/{merchantId}")
    public AdminMerchantDtos.MerchantDetails getMerchantDetails(@PathVariable String merchantId) {
        return adminMerchantsService.getMerchantDetails(merchantId);
    }

    @PatchMapping("/{merchantId}")
    public AdminMerchantDtos.MerchantDetails updateMerchant(
        @PathVariable String merchantId,
        @RequestBody AdminMerchantDtos.UpdateMerchantRequest request
    ) {
        return adminMerchantsService.updateMerchant(merchantId, request);
    }

    @PatchMapping("/{merchantId}/status")
    public AdminMerchantDtos.MerchantDetails updateMerchantStatus(
        @PathVariable String merchantId,
        @RequestBody AdminMerchantDtos.UpdateMerchantStatusRequest request
    ) {
        return adminMerchantsService.updateMerchantStatus(merchantId, request);
    }

    @DeleteMapping("/{merchantId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMerchant(@PathVariable String merchantId) {
        adminMerchantsService.deleteMerchant(merchantId);
    }
}
