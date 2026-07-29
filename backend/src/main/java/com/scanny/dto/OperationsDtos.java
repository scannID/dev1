package com.scanny.dto;

import com.scanny.entity.Business;
import com.scanny.entity.BusinessStaff;
import com.scanny.entity.BusinessTable;
import com.scanny.entity.Order;
import com.scanny.entity.OrderFeedback;
import com.scanny.entity.OrderSplitPayment;
import com.scanny.entity.Reservation;
import com.scanny.entity.TableSession;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.ReservationStatus;
import com.scanny.model.enums.StaffRole;
import com.scanny.model.enums.TableSessionStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class OperationsDtos {

    private OperationsDtos() {}

    public record BranchResponse(
            String id,
            String merchantId,
            String name,
            String branchLabel,
            boolean primary,
            String address,
            String qrToken,
            String phone,
            String type
    ) {
        public static BranchResponse from(Business business) {
            return new BranchResponse(
                    business.getId(),
                    business.getMerchantId(),
                    business.getName(),
                    business.getBranchLabel(),
                    business.isPrimary(),
                    business.getAddress(),
                    business.getQrToken(),
                    business.getPhone(),
                    business.getType().name()
            );
        }
    }

    public record BuildCatalogResponse(
            boolean built,
            int itemsAdded,
            int existingItems
    ) {}

    public record CreateBranchRequest(
            @NotBlank @Size(max = 255) String name,
            @NotBlank @Size(max = 128) String branchLabel,
            @Size(max = 500) String address,
            @Size(max = 32) String phone
    ) {}

    public record OperationsSettingsResponse(
            boolean acceptingOrders,
            boolean busyMode,
            int busyEtaMinutes,
            String pauseMessage,
            boolean whatsappNotificationsEnabled,
            String whatsappBusinessPhone,
            boolean dailyDigestEnabled,
            String dailyDigestChannel,
            String dailyDigestEmail
    ) {
        public static OperationsSettingsResponse from(Business business) {
            return new OperationsSettingsResponse(
                    business.isAcceptingOrders(),
                    business.isBusyMode(),
                    business.getBusyEtaMinutes(),
                    business.getPauseMessage(),
                    business.isWhatsappNotificationsEnabled(),
                    business.getWhatsappBusinessPhone(),
                    business.isDailyDigestEnabled(),
                    business.getDailyDigestChannel(),
                    business.getDailyDigestEmail()
            );
        }
    }

    public record UpdateOperationsSettingsRequest(
            Boolean acceptingOrders,
            Boolean busyMode,
            @Min(0) @Max(240) Integer busyEtaMinutes,
            @Size(max = 500) String pauseMessage,
            Boolean whatsappNotificationsEnabled,
            @Size(max = 32) String whatsappBusinessPhone,
            Boolean dailyDigestEnabled,
            @Size(max = 16) String dailyDigestChannel,
            @Size(max = 255) String dailyDigestEmail
    ) {}

    public record StaffResponse(
            UUID id,
            String email,
            String displayName,
            StaffRole role,
            boolean active,
            boolean invitePending,
            Instant createdAt
    ) {
        public static StaffResponse from(BusinessStaff staff) {
            return new StaffResponse(
                    staff.getId(),
                    staff.getEmail(),
                    staff.getDisplayName(),
                    staff.getRole(),
                    staff.isActive(),
                    staff.isInvitePending(),
                    staff.getCreatedAt()
            );
        }
    }

    public record CreateStaffRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(max = 255) String displayName,
            @NotNull StaffRole role
    ) {}

    public record UpdateStaffRequest(
            @Size(max = 255) String displayName,
            StaffRole role,
            Boolean active
    ) {}

    public record StaffBusinessOption(
            String businessId,
            String businessName
    ) {}

    public record StaffMeResponse(
            StaffResponse staff,
            BusinessResponse business,
            List<StaffBusinessOption> businesses
    ) {}

    public record TableResponse(
            String id,
            String label,
            String qrToken,
            String scanUrl,
            boolean active
    ) {
        public static TableResponse from(BusinessTable table, String scanBaseUrl) {
            String businessId = table.getBusiness() != null ? table.getBusiness().getId() : "";
            String businessQr = table.getBusiness() != null && table.getBusiness().getQrToken() != null
                    ? table.getBusiness().getQrToken()
                    : "";
            // Business menu token stays in ?qr=; table session uses ?table= + ?tableQr=
            String scanUrl = scanBaseUrl + "/b/" + businessId
                    + "?qr=" + businessQr
                    + "&table=" + table.getId()
                    + "&tableQr=" + table.getQrToken();
            return new TableResponse(
                    table.getId(),
                    table.getLabel(),
                    table.getQrToken(),
                    scanUrl,
                    table.isActive()
            );
        }
    }

    public record CreateTableRequest(@NotBlank @Size(max = 128) String label) {}

    public record TableSessionResponse(
            UUID id,
            String tableId,
            String tableLabel,
            TableSessionStatus status,
            Instant openedAt,
            List<String> orderIds,
            int orderTotal,
            int unpaidTotal,
            String paymentStatus
    ) {
        public static TableSessionResponse from(
                TableSession session,
                List<String> orderIds,
                int orderTotal,
                int unpaidTotal,
                String paymentStatus
        ) {
            return new TableSessionResponse(
                    session.getId(),
                    session.getTable().getId(),
                    session.getTable().getLabel(),
                    session.getStatus(),
                    session.getOpenedAt(),
                    orderIds,
                    orderTotal,
                    unpaidTotal,
                    paymentStatus
            );
        }
    }

    public record KitchenOrderResponse(
            String id,
            String customerName,
            String customerLocation,
            String customerNote,
            String kitchenNotes,
            OrderStatus status,
            int total,
            Instant createdAt,
            List<KitchenLineItem> items,
            String tableLabel
    ) {
        public record KitchenLineItem(String name, int quantity, String note) {}

        public static KitchenOrderResponse from(Order order, String tableLabel) {
            return new KitchenOrderResponse(
                    order.getId(),
                    order.getCustomerName(),
                    order.getCustomerLocation(),
                    order.getCustomerNote(),
                    order.getKitchenNotes(),
                    order.getStatus(),
                    order.getTotal(),
                    order.getCreatedAt(),
                    order.getItems().stream()
                            .map(item -> new KitchenLineItem(item.getName(), item.getQuantity(), ""))
                            .toList(),
                    tableLabel
            );
        }
    }

    public record SubmitFeedbackRequest(
            @Min(1) @Max(5) int rating,
            @Size(max = 1000) String comment,
            @NotBlank @Size(max = 32) String phone
    ) {}

    public record FeedbackResponse(
            Long id,
            String orderId,
            int rating,
            String comment,
            Instant createdAt
    ) {
        public static FeedbackResponse from(OrderFeedback feedback) {
            return new FeedbackResponse(
                    feedback.getId(),
                    feedback.getOrderId(),
                    feedback.getRating(),
                    feedback.getComment(),
                    feedback.getCreatedAt()
            );
        }
    }

    public record CustomerHistoryRequest(@NotBlank @Size(max = 32) String phone) {}

    public record CustomerHistoryVerifyRequest(
            @NotBlank @Size(max = 32) String phone,
            @NotBlank @Size(min = 4, max = 8) String code
    ) {}

    public record CustomerHistoryResponse(
            String sessionToken,
            Instant expiresAt,
            List<CustomerOrderSummary> orders
    ) {
        public record CustomerOrderSummary(
                UUID publicId,
                String businessName,
                int total,
                OrderStatus status,
                Instant createdAt
        ) {}
    }

    public record CreateSplitPaymentRequest(
            @NotBlank @Size(max = 255) String payerName,
            @Size(max = 32) String payerPhone,
            @Min(1) int amount
    ) {}

    public record CreateEqualSplitsRequest(
            @Min(2) @Max(20) int parts,
            @Size(max = 255) String basePayerName
    ) {}

    public record CreateCustomSplitsRequest(
            @NotEmpty @Size(min = 2, max = 20) List<@Valid CreateSplitPaymentRequest> shares
    ) {}

    public record SplitPaymentResponse(
            UUID id,
            UUID splitGroupId,
            String orderId,
            String payerName,
            String payerPhone,
            int amount,
            String paymentStatus
    ) {
        public static SplitPaymentResponse from(OrderSplitPayment payment) {
            return new SplitPaymentResponse(
                    payment.getId(),
                    payment.getSplitGroupId(),
                    payment.getOrderId(),
                    payment.getPayerName(),
                    payment.getPayerPhone(),
                    payment.getAmount(),
                    payment.getPaymentStatus().name()
            );
        }
    }

    public record SplitBillSummary(
            String orderId,
            UUID publicId,
            String businessName,
            int orderTotal,
            int allocatedTotal,
            int remainingTotal,
            String orderPaymentStatus,
            List<SplitPaymentResponse> splits
    ) {}

    public record CreateReservationRequest(
            @NotBlank @Size(max = 255) String customerName,
            @NotBlank @Size(max = 32) String customerPhone,
            @Min(1) @Max(100) int partySize,
            @NotNull Instant reservedAt,
            @Size(max = 1000) String note
    ) {}

    public record ReservationResponse(
            UUID id,
            String customerName,
            String customerPhone,
            int partySize,
            Instant reservedAt,
            ReservationStatus status,
            String note
    ) {
        public static ReservationResponse from(Reservation reservation) {
            return new ReservationResponse(
                    reservation.getId(),
                    reservation.getCustomerName(),
                    reservation.getCustomerPhone(),
                    reservation.getPartySize(),
                    reservation.getReservedAt(),
                    reservation.getStatus(),
                    reservation.getNote()
            );
        }
    }

    public record UpdateReservationRequest(
            ReservationStatus status,
            @Size(max = 1000) String note,
            Instant reservedAt,
            @Min(1) @Max(100) Integer partySize
    ) {}

    public record LowStockItemResponse(
            String id,
            String name,
            int unitsAvailable,
            int lowStockThreshold,
            boolean available
    ) {}

    public record PrintReceiptResponse(
            String receiptNumber,
            String businessName,
            String orderId,
            Instant createdAt,
            int total,
            List<PrintLineItem> items,
            String customerName,
            String customerLocation,
            String escPosBase64
    ) {
        public record PrintLineItem(String name, int quantity, int lineTotal) {}
    }
}
