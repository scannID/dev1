package com.scanny.controller;

import com.scanny.dto.SupplierDtos;
import com.scanny.service.SupplierService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/businesses/{businessId}/suppliers")
public class SupplierController {

    private final SupplierService supplierService;

    public SupplierController(SupplierService supplierService) {
        this.supplierService = supplierService;
    }

    @GetMapping
    public Map<String, List<SupplierDtos.SupplierResponse>> list(
            @PathVariable String businessId,
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        return Map.of("items", supplierService.list(businessId, includeInactive));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, SupplierDtos.SupplierResponse> create(
            @PathVariable String businessId,
            @Valid @RequestBody SupplierDtos.CreateSupplierRequest request) {
        return Map.of("item", supplierService.create(businessId, request));
    }

    @PatchMapping("/{supplierId}")
    public Map<String, SupplierDtos.SupplierResponse> update(
            @PathVariable String businessId,
            @PathVariable String supplierId,
            @Valid @RequestBody SupplierDtos.UpdateSupplierRequest request) {
        return Map.of("item", supplierService.update(businessId, supplierId, request));
    }
}
