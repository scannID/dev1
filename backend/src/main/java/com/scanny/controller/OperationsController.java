package com.scanny.controller;

import com.scanny.dto.OperationsDtos;
import com.scanny.dto.OrderResponse;
import com.scanny.dto.OrderUpdateDtos;
import com.scanny.model.enums.OrderStatus;
import com.scanny.security.OperationsAccessService;
import com.scanny.service.CatalogCsvService;
import com.scanny.service.CustomerEngagementService;
import com.scanny.service.OperationsService;
import com.scanny.service.OrderService;
import com.scanny.service.PrintReceiptService;
import com.scanny.service.StaffService;
import com.scanny.service.TableService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/businesses/{businessId}/operations")
public class OperationsController {

    private final OperationsService operationsService;
    private final StaffService staffService;
    private final TableService tableService;
    private final CustomerEngagementService customerEngagementService;
    private final CatalogCsvService catalogCsvService;
    private final PrintReceiptService printReceiptService;
    private final OrderService orderService;
    private final OperationsAccessService operationsAccessService;

    public OperationsController(
            OperationsService operationsService,
            StaffService staffService,
            TableService tableService,
            CustomerEngagementService customerEngagementService,
            CatalogCsvService catalogCsvService,
            PrintReceiptService printReceiptService,
            OrderService orderService,
            OperationsAccessService operationsAccessService
    ) {
        this.operationsService = operationsService;
        this.staffService = staffService;
        this.tableService = tableService;
        this.customerEngagementService = customerEngagementService;
        this.catalogCsvService = catalogCsvService;
        this.printReceiptService = printReceiptService;
        this.orderService = orderService;
        this.operationsAccessService = operationsAccessService;
    }

    @GetMapping("/branches")
    public Map<String, List<OperationsDtos.BranchResponse>> listBranches(@PathVariable String businessId) {
        return Map.of("branches", operationsService.listBranches(businessId));
    }

    @PostMapping("/branches")
    public Map<String, OperationsDtos.BranchResponse> createBranch(
            @PathVariable String businessId,
            @Valid @RequestBody OperationsDtos.CreateBranchRequest request
    ) {
        return Map.of("branch", operationsService.createBranch(businessId, request));
    }

    @PostMapping("/catalog/build")
    public Map<String, OperationsDtos.BuildCatalogResponse> buildCatalog(@PathVariable String businessId) {
        return Map.of("result", operationsService.buildCatalog(businessId));
    }

    @GetMapping("/settings")
    public Map<String, OperationsDtos.OperationsSettingsResponse> getSettings(@PathVariable String businessId) {
        return Map.of("settings", operationsService.getSettings(businessId));
    }

    @PatchMapping("/settings")
    public Map<String, OperationsDtos.OperationsSettingsResponse> updateSettings(
            @PathVariable String businessId,
            @Valid @RequestBody OperationsDtos.UpdateOperationsSettingsRequest request
    ) {
        return Map.of("settings", operationsService.updateSettings(businessId, request));
    }

    @GetMapping("/kitchen/orders")
    public Map<String, List<OperationsDtos.KitchenOrderResponse>> kitchenOrders(
            @PathVariable String businessId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        return Map.of("orders", operationsService.kitchenOrders(businessId, staffSession));
    }

    @PatchMapping("/kitchen/orders/{orderId}/status")
    public Map<String, OrderResponse> updateKitchenStatus(
            @PathVariable String businessId,
            @PathVariable String orderId,
            @Valid @RequestBody OrderUpdateDtos.UpdateOrderStatusRequest request,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        operationsAccessService.requireMerchantOrStaff(
                businessId, staffSession, OperationsAccessService.kitchenRoles());
        OrderStatus status = request.status();
        return Map.of("order", orderService.updateOrderStatusForBusiness(businessId, orderId, status));
    }

    @GetMapping("/low-stock")
    public Map<String, List<OperationsDtos.LowStockItemResponse>> lowStock(
            @PathVariable String businessId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        return Map.of("items", operationsService.lowStockItems(businessId, staffSession));
    }

    @GetMapping("/staff")
    public Map<String, List<OperationsDtos.StaffResponse>> listStaff(@PathVariable String businessId) {
        return Map.of("staff", staffService.listStaff(businessId));
    }

    @PostMapping("/staff")
    public Map<String, OperationsDtos.StaffResponse> createStaff(
            @PathVariable String businessId,
            @Valid @RequestBody OperationsDtos.CreateStaffRequest request
    ) {
        return Map.of("staff", staffService.createStaff(businessId, request));
    }

    @PatchMapping("/staff/{staffId}")
    public Map<String, OperationsDtos.StaffResponse> updateStaff(
            @PathVariable String businessId,
            @PathVariable UUID staffId,
            @Valid @RequestBody OperationsDtos.UpdateStaffRequest request
    ) {
        return Map.of("staff", staffService.updateStaff(businessId, staffId, request));
    }

    @PostMapping("/staff/login")
    public OperationsDtos.StaffSessionResponse staffLogin(
            @PathVariable String businessId,
            @Valid @RequestBody OperationsDtos.StaffLoginRequest request
    ) {
        return staffService.login(businessId, request);
    }

    @GetMapping("/tables")
    public Map<String, List<OperationsDtos.TableResponse>> listTables(
            @PathVariable String businessId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        return Map.of("tables", tableService.listTables(businessId, staffSession));
    }

    @PostMapping("/tables")
    public Map<String, OperationsDtos.TableResponse> createTable(
            @PathVariable String businessId,
            @Valid @RequestBody OperationsDtos.CreateTableRequest request,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        return Map.of("table", tableService.createTable(businessId, request, staffSession));
    }

    @GetMapping("/table-sessions")
    public Map<String, List<OperationsDtos.TableSessionResponse>> openSessions(
            @PathVariable String businessId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        return Map.of("sessions", tableService.openSessions(businessId, staffSession));
    }

    @PostMapping("/table-sessions/{sessionId}/close")
    public Map<String, String> closeSession(
            @PathVariable String businessId,
            @PathVariable UUID sessionId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        tableService.closeSession(businessId, sessionId, staffSession);
        return Map.of("status", "closed");
    }

    @PostMapping("/orders/{orderId}/splits")
    public Map<String, OperationsDtos.SplitPaymentResponse> createSplit(
            @PathVariable String businessId,
            @PathVariable String orderId,
            @Valid @RequestBody OperationsDtos.CreateSplitPaymentRequest request,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        return Map.of("split", tableService.createSplitPayment(businessId, orderId, request, staffSession));
    }

    @PostMapping("/orders/{orderId}/splits/equal")
    public Map<String, List<OperationsDtos.SplitPaymentResponse>> createEqualSplits(
            @PathVariable String businessId,
            @PathVariable String orderId,
            @Valid @RequestBody OperationsDtos.CreateEqualSplitsRequest request,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        return Map.of("splits", tableService.createEqualSplits(businessId, orderId, request, staffSession));
    }

    @GetMapping("/orders/{orderId}/splits")
    public Map<String, Object> listSplits(
            @PathVariable String businessId,
            @PathVariable String orderId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        OperationsDtos.SplitBillSummary bill = tableService.getSplitBill(businessId, orderId, staffSession);
        return Map.of("bill", bill, "splits", bill.splits());
    }

    @PostMapping("/orders/{orderId}/splits/{splitId}/mark-paid")
    public Map<String, OperationsDtos.SplitPaymentResponse> markSplitPaid(
            @PathVariable String businessId,
            @PathVariable String orderId,
            @PathVariable UUID splitId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        return Map.of("split", tableService.markSplitPaid(businessId, orderId, splitId, staffSession));
    }

    @DeleteMapping("/orders/{orderId}/splits/{splitId}")
    public Map<String, String> deleteSplit(
            @PathVariable String businessId,
            @PathVariable String orderId,
            @PathVariable UUID splitId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        tableService.deleteSplit(businessId, orderId, splitId, staffSession);
        return Map.of("status", "deleted");
    }

    @DeleteMapping("/orders/{orderId}/splits")
    public Map<String, Integer> clearUnpaidSplits(
            @PathVariable String businessId,
            @PathVariable String orderId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        return Map.of("cleared", tableService.clearUnpaidSplits(businessId, orderId, staffSession));
    }

    @GetMapping("/orders/{orderId}/print")
    public Map<String, OperationsDtos.PrintReceiptResponse> printOrder(
            @PathVariable String businessId,
            @PathVariable String orderId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        operationsAccessService.requireMerchantOrStaff(
                businessId, staffSession, OperationsAccessService.floorRoles());
        return Map.of("receipt", printReceiptService.printOrder(businessId, orderId));
    }

    @GetMapping(value = "/catalog/export.csv", produces = "text/csv")
    public ResponseEntity<String> exportCatalog(@PathVariable String businessId) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=catalog-" + businessId + ".csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(catalogCsvService.exportCsv(businessId));
    }

    @PostMapping("/catalog/import.csv")
    public Map<String, Integer> importCatalog(
            @PathVariable String businessId,
            @RequestBody String csvContent
    ) {
        return Map.of("imported", catalogCsvService.importCsv(businessId, csvContent));
    }

    @GetMapping("/reservations")
    public Map<String, List<OperationsDtos.ReservationResponse>> listReservations(
            @PathVariable String businessId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        operationsAccessService.requireMerchantOrStaff(
                businessId, staffSession, OperationsAccessService.floorRoles());
        return Map.of("reservations", customerEngagementService.listReservations(businessId));
    }

    @PostMapping("/reservations")
    public Map<String, OperationsDtos.ReservationResponse> createReservation(
            @PathVariable String businessId,
            @Valid @RequestBody OperationsDtos.CreateReservationRequest request
    ) {
        return Map.of("reservation", customerEngagementService.createReservation(businessId, request));
    }

    @PatchMapping("/reservations/{reservationId}")
    public Map<String, OperationsDtos.ReservationResponse> updateReservation(
            @PathVariable String businessId,
            @PathVariable UUID reservationId,
            @Valid @RequestBody OperationsDtos.UpdateReservationRequest request,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        operationsAccessService.requireMerchantOrStaff(
                businessId, staffSession, OperationsAccessService.floorRoles());
        return Map.of("reservation", customerEngagementService.updateReservation(businessId, reservationId, request));
    }
}
