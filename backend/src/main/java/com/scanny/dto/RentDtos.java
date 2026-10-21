package com.scanny.dto;

import com.scanny.entity.RentAccount;
import com.scanny.entity.RentCharge;
import com.scanny.entity.RentPayment;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentPropertyAccess;
import com.scanny.entity.RentTenant;
import com.scanny.entity.RentUnit;
import com.scanny.model.enums.PropertyAccessRole;
import com.scanny.model.enums.RentChargeStatus;
import com.scanny.model.enums.RentPaymentStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * All request / response DTOs for the rent collection feature.
 *
 * <p>Naming conventions:
 * <ul>
 *   <li>*Request  — inbound from the frontend</li>
 *   <li>*Response — outbound to the frontend</li>
 *   <li>*Summary  — lightweight list-view projection</li>
 * </ul>
 */
public final class RentDtos {

    private RentDtos() {}

    // ═══════════════════════════════════════════════════════════════════════
    // REQUESTS
    // ═══════════════════════════════════════════════════════════════════════

    /** Create a new rent account (manager or owner self-registration). */
    public record CreateAccountRequest(
            @NotBlank @Size(max = 255) String name,
            @NotBlank @Email @Size(max = 255) String email,
            @Size(max = 32) String phone
    ) {}

    /** Keycloak-based registration request for a new rent manager account. */
    public record RegisterRentManagerRequest(
            @NotBlank @Size(max = 255) String name,
            @NotBlank @Email @Size(max = 255) String email,
            @Size(max = 32) String phone,
            /** MoMo number — optionally collected at registration for convenience. */
            @Size(max = 64) String ownerMomo
    ) {}

    /** Create a property under an account's portfolio. */
    public record CreatePropertyRequest(
            @NotBlank @Size(max = 255) String name,
            @Size(max = 512) String address,
            @Size(max = 128) String city,
            /** Human name of the owner (for display). */
            @NotBlank @Size(max = 255) String ownerName,
            /** MoMo number where all rent payments for this property go. */
            @NotBlank @Size(max = 64) String ownerMomo,
            /**
             * Optional: email of an existing or new RentAccount to link as the
             * owner account (gives them read-only dashboard access).
             */
            @Email @Size(max = 255) String ownerEmail,
            @Size(max = 8) String currency,
            /**
             * IANA time-zone ID for this property (e.g. "Africa/Kampala", "Africa/Nairobi").
             * Used to compute daysRemaining on the tenant pay page.
             * Null = use server default ("Africa/Kampala").
             */
            @Size(max = 64) String timezone,
            /**
             * Whether tenants may pay less than the full outstanding balance.
             * Null = default true.
             */
            Boolean partialPaymentAllowed,
            /**
             * Minimum partial payment amount (minor units). Only applies when
             * partialPaymentAllowed = true. Null or 0 = no floor.
             */
            @Min(0) Integer minPaymentAmount
    ) {}

    /** Grant another account access to a property. */
    public record GrantAccessRequest(
            /** Email of the account to grant access to. */
            @NotBlank @Email String email,
            @NotBlank String role   // OWNER | MANAGER | OWNER_MANAGER
    ) {}

    /** Add a unit to a property. */
    public record CreateUnitRequest(
            @NotBlank @Size(max = 64) String unitNumber,
            @Size(max = 32) String floor,
            @Min(1) int monthlyAmount,
            int depositAmount,
            /**
             * Day of the month (1–28) rent is due. Null = inherit property default (5).
             * Clamped to 28 to avoid month-length edge cases.
             */
            Integer dueDayOfMonth,
            /**
             * Calendar days after the due date before the charge becomes OVERDUE.
             * Null or absent = 0 (strict — overdue the day after due date).
             */
            Integer gracePeriodDays
    ) {}

    /** Update a unit's rent amount, deposit, or due-day config. */
    public record UpdateUnitRequest(
            @Size(max = 64) String unitNumber,
            @Size(max = 32) String floor,
            @Min(0) Integer monthlyAmount,
            @Min(0) Integer depositAmount,
            /** 1–28, null = no change. */
            Integer dueDayOfMonth,
            /** >= 0, null = no change. */
            Integer gracePeriodDays
    ) {}

    /** Add a tenant to a unit. */
    public record CreateTenantRequest(
            @NotBlank @Size(max = 255) String name,
            @NotBlank @Size(max = 32) String phone,
            @Email @Size(max = 255) String email,
            String moveInDate,   // ISO date string "2026-11-01", nullable
            /**
             * Optional end date of the current lease (ISO date string "2027-10-31").
             * Null means open-ended / no fixed expiry.
             */
            String leaseEnd
    ) {}

    /**
     * Generate rent charges for a period.
     * The period label must follow "YYYY-MM" format, e.g. "2026-11".
     * Due date defaults to the 5th of the period month if omitted.
     */
    public record GenerateChargesRequest(
            @NotBlank String periodLabel,
            String dueDate   // ISO date string, nullable — defaults to 5th of period month
    ) {}

    /** Manually update a charge's status (e.g. waive it). */
    public record UpdateChargeStatusRequest(
            @NotBlank String status,  // UNPAID | PAID | PARTIAL | WAIVED | OVERDUE
            @Size(max = 1000) String notes
    ) {}

    /** Customer initiates a rent payment from the pay page. */
    public record InitiateRentPaymentRequest(
            @NotBlank @Size(max = 32) String customerPhone,
            @Size(max = 255) String customerName,
            /** "MobileMoney" — only supported method for now. */
            String paymentMethod,
            /**
             * Requested payment amount in the property's currency minor units.
             * Must be > 0 and <= outstanding balance.
             * When null the server defaults to the full outstanding balance
             * (i.e. full-pay shortcut — always valid regardless of partial settings).
             */
            @Min(1) Integer amount
    ) {}

    /** Update core property settings (name, address, payment config, etc.). */
    public record UpdatePropertyRequest(
            @Size(max = 255) String name,
            @Size(max = 512) String address,
            @Size(max = 128) String city,
            @Size(max = 255) String ownerName,
            @Size(max = 64) String ownerMomo,
            @Size(max = 8) String currency,
            @Size(max = 64) String timezone,
            Boolean partialPaymentAllowed,
            @Min(0) Integer minPaymentAmount
    ) {}

    /** Update a tenant's contact info or lease end date. */
    public record UpdateTenantRequest(
            @Size(max = 32) String phone,
            @Size(max = 255) String email,
            /** ISO date string, null = no change. */
            String leaseEnd
    ) {}

    // ═══════════════════════════════════════════════════════════════════════
    // RESPONSES
    // ═══════════════════════════════════════════════════════════════════════

    public record AccountResponse(
            String id,
            String name,
            String email,
            String phone,
            String accessKey,
            Instant createdAt
    ) {
        public static AccountResponse from(RentAccount a) {
            return new AccountResponse(
                    a.getId(), a.getName(), a.getEmail(),
                    a.getPhone(), a.getAccessKey(), a.getCreatedAt());
        }
    }

    public record PropertyResponse(
            String id,
            String name,
            String address,
            String city,
            String ownerName,
            String ownerMomo,
            String currency,
            String timezone,
            boolean partialPaymentAllowed,
            int minPaymentAmount,
            String qrToken,
            String qrCodeUrl,   // full /rent/pay/:qrToken URL for printing
            int unitCount,
            int activeTenantsCount,
            Instant createdAt
    ) {
        public static PropertyResponse from(RentProperty p, String baseUrl) {
            int units = p.getUnits() != null ? p.getUnits().size() : 0;
            long active = p.getUnits() != null
                    ? p.getUnits().stream().filter(u -> u.getActiveTenant() != null).count()
                    : 0;
            return new PropertyResponse(
                    p.getId(), p.getName(), p.getAddress(), p.getCity(),
                    p.getOwnerName(), p.getOwnerMomo(), p.getCurrency(),
                    p.getTimezone(), p.isPartialPaymentAllowed(), p.getMinPaymentAmount(),
                    p.getQrToken(),
                    baseUrl + "/rent/pay/" + p.getQrToken(),
                    units, (int) active, p.getCreatedAt());
        }
    }

    public record PropertyAccessResponse(
            String accountId,
            String accountName,
            String accountEmail,
            String role,
            Instant grantedAt
    ) {
        public static PropertyAccessResponse from(RentPropertyAccess a) {
            return new PropertyAccessResponse(
                    a.getAccount().getId(),
                    a.getAccount().getName(),
                    a.getAccount().getEmail(),
                    a.getRole().name(),
                    a.getGrantedAt());
        }
    }

    public record UnitResponse(
            String id,
            String propertyId,
            String unitNumber,
            String floor,
            int monthlyAmount,
            int depositAmount,
            String currency,
            int dueDayOfMonth,
            int gracePeriodDays,
            String qrToken,
            String qrCodeUrl,
            TenantSummary activeTenant,   // null when vacant
            Instant createdAt
    ) {
        public static UnitResponse from(RentUnit u, String baseUrl) {
            TenantSummary ts = u.getActiveTenant() != null
                    ? TenantSummary.from(u.getActiveTenant()) : null;
            String unitQr = u.getQrToken();
            return new UnitResponse(
                    u.getId(),
                    u.getProperty().getId(),
                    u.getUnitNumber(),
                    u.getFloor(),
                    u.getMonthlyAmount(),
                    u.getDepositAmount(),
                    u.getProperty().getCurrency(),
                    u.getDueDayOfMonth(),
                    u.getGracePeriodDays(),
                    unitQr,
                    unitQr != null ? baseUrl + "/rent/pay/" + unitQr : null,
                    ts,
                    u.getCreatedAt());
        }
    }

    public record TenantSummary(
            String id,
            String name,
            String phone,
            String email,
            String payToken,
            String payUrl,
            LocalDate moveInDate,
            LocalDate leaseEnd,
            boolean active
    ) {
        public static TenantSummary from(RentTenant t) {
            return new TenantSummary(
                    t.getId(), t.getName(), t.getPhone(), t.getEmail(),
                    t.getPayToken(), null,   // payUrl built in full response
                    t.getMoveInDate(), t.getLeaseEnd(), t.isActive());
        }

        public static TenantSummary fromWithUrl(RentTenant t, String baseUrl) {
            return new TenantSummary(
                    t.getId(), t.getName(), t.getPhone(), t.getEmail(),
                    t.getPayToken(),
                    baseUrl + "/rent/pay/" + t.getPayToken(),
                    t.getMoveInDate(), t.getLeaseEnd(), t.isActive());
        }
    }

    public record ChargeResponse(
            Long id,
            String tenantId,
            String tenantName,
            String unitId,
            String unitNumber,
            int amount,
            int paidAmount,
            int outstandingAmount,
            String currency,
            String periodLabel,
            LocalDate dueDate,
            String status,
            String notes,
            List<PaymentSummary> payments,
            Instant createdAt
    ) {
        public static ChargeResponse from(RentCharge c) {
            List<PaymentSummary> pmts = c.getPayments() != null
                    ? c.getPayments().stream().map(PaymentSummary::from).toList()
                    : List.of();
            return new ChargeResponse(
                    c.getId(),
                    c.getTenant().getId(),
                    c.getTenant().getName(),
                    c.getUnit().getId(),
                    c.getUnit().getUnitNumber(),
                    c.getAmount(),
                    c.getPaidAmount(),
                    c.getOutstandingAmount(),
                    c.getCurrency(),
                    c.getPeriodLabel(),
                    c.getDueDate(),
                    c.getStatus().name(),
                    c.getNotes(),
                    pmts,
                    c.getCreatedAt());
        }
    }

    public record PaymentSummary(
            Long id,
            String transactionRef,
            int amount,
            String currency,
            String paymentMethod,
            String status,
            Instant paidAt,
            Instant failedAt,
            String failureReason,
            Instant createdAt
    ) {
        public static PaymentSummary from(RentPayment p) {
            return new PaymentSummary(
                    p.getId(), p.getTransactionRef(),
                    p.getAmount(), p.getCurrency(), p.getPaymentMethod(),
                    p.getStatus().name(),
                    p.getPaidAt(), p.getFailedAt(), p.getFailureReason(),
                    p.getCreatedAt());
        }
    }

    /**
     * Returned to the tenant's pay page when they scan a property or unit QR.
     * Contains just enough to show the payment form — deliberately excludes
     * the owner's phone number and any other tenant's data.
     */
    public record TenantPayContext(
            /** Which token was resolved: "property", "unit", or "tenant". */
            String tokenType,
            String propertyId,
            String propertyName,
            String ownerName,
            String currency,
            /** Non-null when token resolves to a specific unit. */
            String unitId,
            String unitNumber,
            /** Non-null when token resolves to a specific tenant. */
            String tenantId,
            /** Tenant's first name only — no surname exposed. */
            String tenantFirstName,
            // ── Charge / balance ──────────────────────────────────────────────
            /** Full monthly rent amount for the period (minor units). */
            Integer totalRent,
            /** Sum of completed payments so far this period (minor units). */
            Integer paidAmount,
            /** Outstanding balance = totalRent − paidAmount (minor units). */
            Integer balance,
            /** ISO year-month label of the current charge period, e.g. "2026-11". */
            String periodLabel,
            /** ISO date of the charge due date. */
            java.time.LocalDate dueDate,
            /**
             * Days until due date (positive = days remaining, negative = days overdue).
             * Computed server-side using the property's timezone so mobile clients
             * always see the correct countdown regardless of their locale.
             * Null when no active charge exists (property-level token with no unit selected).
             */
            Integer daysRemaining,
            /** Computed charge status — UNPAID, PARTIAL, PAID, OVERDUE, WAIVED. */
            String chargeStatus,
            // ── Payment config ────────────────────────────────────────────────
            /** Whether the tenant may pay less than the full outstanding balance. */
            boolean partialPaymentAllowed,
            /**
             * Minimum partial payment amount (minor units).
             * 0 when partialPaymentAllowed = false or no minimum is configured.
             */
            int minPaymentAmount,
            // ── Recent payments ───────────────────────────────────────────────
            /** Most recent completed payments for this charge period (max 5). */
            List<PaymentSummary> recentPayments,
            // ── Unit picker (property-level token only) ───────────────────────
            /** List of units to pick from when token is property-level. */
            List<UnitPickOption> units
    ) {}

    public record UnitPickOption(
            String unitId,
            String unitNumber,
            String floor,
            int monthlyAmount,
            boolean hasActiveTenant
    ) {}

    /** Result returned after a payment is successfully initiated. */
    public record InitiateRentPaymentResponse(
            boolean success,
            String message,
            String transactionRef,
            String paymentId,
            /** MoMo number the payer should expect a push from. */
            String paymentDestination,
            int amount,
            String currency,
            String periodLabel
    ) {}

    /**
     * Lightweight status response for the frontend polling endpoint.
     * The frontend polls this after initiating a payment to detect completion
     * without trusting a redirect alone.
     */
    public record PaymentStatusResponse(
            String transactionRef,
            /** Pending | Completed | Failed */
            String status,
            int amount,
            String currency,
            java.time.Instant paidAt,
            java.time.Instant failedAt,
            String failureReason
    ) {
        public static PaymentStatusResponse from(com.scanny.entity.RentPayment p) {
            return new PaymentStatusResponse(
                    p.getTransactionRef(),
                    p.getStatus().name(),
                    p.getAmount(),
                    p.getCurrency(),
                    p.getPaidAt(),
                    p.getFailedAt(),
                    p.getFailureReason());
        }
    }

    /**
     * Full property dashboard: units with current-period charges,
     * recent payments, and portfolio-level stats.
     */
    public record PropertyDashboard(
            PropertyResponse property,
            String currentPeriod,       // "2026-11"
            long totalUnits,
            long occupiedUnits,
            long paidThisPeriod,
            long unpaidThisPeriod,
            long overdueCount,
            long totalCollectedThisPeriod,
            List<UnitDashboardRow> units,
            List<PaymentSummary> recentPayments,
            List<PropertyAccessResponse> accessList
    ) {}

    public record UnitDashboardRow(
            UnitResponse unit,
            ChargeResponse currentCharge    // null if no charge generated yet for period
    ) {}

    /** Lightweight portfolio entry — one row per property in the portfolio list. */
    public record PortfolioEntry(
            String propertyId,
            String propertyName,
            String city,
            String role,          // OWNER | MANAGER | OWNER_MANAGER
            int totalUnits,
            int occupiedUnits,
            int overdueCount,
            long totalCollectedThisMonth,
            String currency
    ) {}
}
