package com.scanit.service;

import com.scanit.dto.admin.AdminMerchantDtos;
import com.scanit.entity.Business;
import com.scanit.entity.Order;
import com.scanit.model.enums.BusinessType;
import com.scanit.model.enums.OrderStatus;
import com.scanit.repository.BusinessRepository;
import com.scanit.repository.OrderRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AdminMerchantsService {

    private final BusinessRepository businessRepository;
    private final OrderRepository orderRepository;

    public AdminMerchantsService(BusinessRepository businessRepository, OrderRepository orderRepository) {
        this.businessRepository = businessRepository;
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public AdminMerchantDtos.MerchantsListResponse listMerchants(
        int page,
        int limit,
        String search,
        String status,
        String type
    ) {
        List<Business> allBusinesses = businessRepository.findAll();

        // Apply filters
        List<Business> filteredBusinesses = allBusinesses.stream()
            .filter(b -> search == null || search.isEmpty() || 
                b.getName().toLowerCase().contains(search.toLowerCase()) ||
                b.getOwnerName().toLowerCase().contains(search.toLowerCase()) ||
                b.getId().toLowerCase().contains(search.toLowerCase()))
            .filter(b -> type == null || type.isEmpty() || 
                b.getType().name().equalsIgnoreCase(type))
            .toList();

        // Calculate pagination
        int total = filteredBusinesses.size();
        int totalPages = (int) Math.ceil((double) total / limit);
        int start = (page - 1) * limit;
        int end = Math.min(start + limit, total);

        List<Business> paginatedBusinesses = filteredBusinesses.subList(
            Math.min(start, total),
            Math.min(end, total)
        );

        // Get orders for all businesses
        List<Order> allOrders = orderRepository.findAll();
        Map<String, List<Order>> ordersByMerchant = allOrders.stream()
            .filter(o -> o.getStatus() == OrderStatus.Completed)
            .collect(Collectors.groupingBy(Order::getMerchantId));

        // Build merchant list items
        List<AdminMerchantDtos.MerchantListItem> merchantItems = paginatedBusinesses.stream()
            .map(business -> {
                List<Order> merchantOrders = ordersByMerchant.getOrDefault(business.getId(), List.of());
                int orderCount = merchantOrders.size();
                long revenue = merchantOrders.stream().mapToLong(Order::getTotal).sum();
                return AdminMerchantDtos.MerchantListItem.from(business, orderCount, revenue);
            })
            .toList();

        AdminMerchantDtos.PaginationInfo pagination = new AdminMerchantDtos.PaginationInfo(
            page,
            limit,
            total,
            totalPages
        );

        AdminMerchantDtos.MerchantSummary summary = new AdminMerchantDtos.MerchantSummary(
            total,
            total, // All active for now
            0,
            0
        );

        return new AdminMerchantDtos.MerchantsListResponse(merchantItems, pagination, summary);
    }

    @Transactional(readOnly = true)
    public AdminMerchantDtos.MerchantDetails getMerchantDetails(String merchantId) {
        Business business = businessRepository.findById(merchantId)
            .orElseThrow(() -> new RuntimeException("Merchant not found: " + merchantId));

        List<Order> orders = orderRepository.findByBusinessIdOrderByCreatedAtDesc(merchantId);
        List<Order> completedOrders = orders.stream()
            .filter(o -> o.getStatus() == OrderStatus.Completed)
            .toList();

        int totalOrders = completedOrders.size();
        long totalRevenue = completedOrders.stream().mapToLong(Order::getTotal).sum();

        return AdminMerchantDtos.MerchantDetails.from(business, totalOrders, totalRevenue);
    }

    @Transactional
    public AdminMerchantDtos.MerchantDetails updateMerchant(
        String merchantId,
        AdminMerchantDtos.UpdateMerchantRequest request
    ) {
        Business business = businessRepository.findById(merchantId)
            .orElseThrow(() -> new RuntimeException("Merchant not found: " + merchantId));

        if (request.name() != null && !request.name().isEmpty()) {
            business.setName(request.name());
        }

        // Plan and status would be stored in a separate table in production
        business = businessRepository.save(business);

        List<Order> orders = orderRepository.findByBusinessIdOrderByCreatedAtDesc(merchantId);
        List<Order> completedOrders = orders.stream()
            .filter(o -> o.getStatus() == OrderStatus.Completed)
            .toList();

        int totalOrders = completedOrders.size();
        long totalRevenue = completedOrders.stream().mapToLong(Order::getTotal).sum();

        return AdminMerchantDtos.MerchantDetails.from(business, totalOrders, totalRevenue);
    }

    @Transactional
    public void deleteMerchant(String merchantId) {
        Business business = businessRepository.findById(merchantId)
            .orElseThrow(() -> new RuntimeException("Merchant not found: " + merchantId));
        
        // In production, this should soft-delete or archive
        businessRepository.delete(business);
    }
}
