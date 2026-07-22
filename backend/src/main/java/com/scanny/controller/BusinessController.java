package com.scanny.controller;

import com.scanny.dto.BusinessResponse;
import com.scanny.dto.OrderResponse;
import com.scanny.dto.OrdersPageResponse;
import com.scanny.dto.PageDtos;
import com.scanny.dto.RequestDtos.CreateBusinessRequest;
import com.scanny.dto.RequestDtos.CreateOrderRequest;
import com.scanny.entity.CatalogItem;
import com.scanny.service.BusinessService;
import com.scanny.service.OrderService;
import com.scanny.service.QrScanService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class BusinessController {

    private final BusinessService businessService;
    private final OrderService orderService;
    private final QrScanService qrScanService;

    public BusinessController(
            BusinessService businessService,
            OrderService orderService,
            QrScanService qrScanService
    ) {
        this.businessService = businessService;
        this.orderService = orderService;
        this.qrScanService = qrScanService;
    }

    @GetMapping("/businesses")
    public Map<String, List<BusinessResponse>> listBusinesses() {
        return Map.of("businesses", businessService.listBusinesses());
    }

    @PostMapping("/businesses")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, BusinessResponse> createBusiness(@Valid @RequestBody CreateBusinessRequest request) {
        return Map.of("business", businessService.createBusiness(request));
    }

    @GetMapping("/qr/{qrToken}")
    public Map<String, BusinessResponse> getByQr(@PathVariable String qrToken) {
        return Map.of("business", businessService.getBusinessByQrToken(qrToken));
    }

    @GetMapping("/businesses/{businessId}")
    public Map<String, BusinessResponse> getBusiness(@PathVariable String businessId) {
        return Map.of("business", businessService.getBusiness(businessId));
    }

    @GetMapping("/businesses/{businessId}/menu")
    public Map<String, Object> getMenu(
            @PathVariable String businessId,
            @RequestParam(required = false) String qr
    ) {
        BusinessResponse business = businessService.getBusinessPublic(businessId);
        List<CatalogItem> availableItems = businessService.getAvailableMenu(businessId, qr);
        return Map.of(
                "business", business,
                "items", availableItems.stream()
                        .map(item -> Map.of(
                                "id", item.getId(),
                                "name", item.getName(),
                                "category", item.getCategory(),
                                "price", item.getPrice(),
                                "description", item.getDescription(),
                                "available", item.isAvailable()
                        ))
                        .toList()
        );
    }

    /** Explicit scan beacon — keeps GET /menu free of write side-effects. */
    @PostMapping("/businesses/{businessId}/scans")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordMenuScan(
            @PathVariable String businessId,
            @RequestParam(required = false) String qr,
            HttpServletRequest request
    ) {
        qrScanService.recordMenuScan(businessId, qr, request.getHeader("User-Agent"));
    }

    @PostMapping("/qr/{qrToken}/scans")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordQrScan(
            @PathVariable String qrToken,
            HttpServletRequest request
    ) {
        qrScanService.recordScanByQrToken(qrToken, request.getHeader("User-Agent"));
    }

    @GetMapping("/businesses/{businessId}/orders")
    public Object listOrders(
            @PathVariable String businessId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String paymentStatus
    ) {
        if (page == null && size == null && search == null && status == null && paymentStatus == null) {
            List<OrderResponse> orders = orderService.listOrders(businessId);
            return Map.of(
                    "orders", orders,
                    "pagination", PageDtos.PaginationMeta.ofFullList(orders.size())
            );
        }
        int safePage = page != null ? page : 1;
        int safeSize = size != null ? size : 20;
        OrdersPageResponse response = orderService.listOrdersPaged(
                businessId, safePage, safeSize, search, status, paymentStatus
        );
        return Map.of(
                "orders", response.orders(),
                "pagination", response.pagination()
        );
    }

    @PostMapping("/businesses/{businessId}/orders")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, OrderResponse> createOrder(
            @PathVariable String businessId,
            @Valid @RequestBody CreateOrderRequest request
    ) {
        return Map.of("order", orderService.createOrder(businessId, request));
    }
}
