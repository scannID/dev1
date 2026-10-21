package com.scanny.service;

import com.scanny.dto.PaymentDtos;
import com.scanny.dto.RentDtos;
import com.scanny.entity.RentCharge;
import com.scanny.entity.RentPayment;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentTenant;
import com.scanny.entity.RentUnit;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.RentChargeStatus;
import com.scanny.model.enums.RentPaymentStatus;
import com.scanny.payment.PaymentContext;
import com.scanny.payment.service.PaymentGatewayService;
import com.scanny.repository.RentChargeRepository;
import com.scanny.repository.RentPaymentRepository;
import com.scanny.repository.RentPropertyRepository;
import com.scanny.repository.RentTenantRepository;
import com.scanny.repository.RentUnitRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.YearMonth;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Handles tenant-facing payment initiation and gateway-callback completion
 * for rent payments.
 *
 * <h3>Flow</h3>
 * <ol>
 *   <li>Tenant opens pay page → frontend resolves token →
 *       {@link #resolvePayContext} returns {@link RentDtos.TenantPayContext}.</li>
 *   <li>Tenant submits phone → {@link #initiatePayment} creates a
 *       {@link RentPayment} and calls {@link PaymentGatewayService} with
 *       {@code PaymentContext.RENT}.</li>
 *   <li>Gateway confirms → {@link #completePayment} is called by
 *       {@code PaymentIntentService.onPaid} → charge status recomputed.</li>
 * </ol>
 */
@Service
public class RentPaymentService {

    private static final Logger log = LoggerFactory.getLogger(RentPaymentService.class);

    private final RentPaymentRepository paymentRepository;
    private final RentChargeRepository chargeRepository;
    private final RentUnitRepository unitRepository;
    private final RentTenantRepository tenantRepository;
    private final RentPropertyRepository propertyRepository;
    private final RentPropertyService propertyService;
    private final RentChargeService chargeService;
    private final PaymentGatewayService paymentGatewayService;
    private final OutboxService outboxService;
    private final AuditService auditService;

    @Value("${scanny.customer-url:http://localhost:5173}")
    private String customerUrl;

    public RentPaymentService(
            RentPaymentRepository paymentRepository,
            RentChargeRepository chargeRepository,
            RentUnitRepository unitRepository,
            RentTenantRepository tenantRepository,
            RentPropertyRepository propertyRepository,
            RentPropertyService propertyService,
            RentChargeService chargeService,
            PaymentGatewayService paymentGatewayService,
            OutboxService outboxService,
            AuditService auditService) {
        this.paymentRepository = paymentRepository;
        this.chargeRepository = chargeRepository;
        this.unitRepository = unitRepository;
        this.tenantRepository = tenantRepository;
        this.propertyRepository = propertyRepository;
        this.propertyService = propertyService;
        this.chargeService = chargeService;
        this.paymentGatewayService = paymentGatewayService;
        this.outboxService = outboxService;
        this.auditService = auditService;
    }

    // ── Resolve pay context ───────────────────────────────────────────────────

    /**
     * Resolves a token (property QR, unit QR, or tenant pay token) into the
     * full context needed to render the payment page.
     */
    @Transactional(readOnly = true)
    public RentDtos.TenantPayContext resolvePayContext(String token) {
        if (token == null || token.isBlank()) {
            throw new ApiException(400, "Token is required");
        }

        // 1. Try tenant pay token (most specific — personal link)
        var tenantOpt = tenantRepository.findByPayToken(token);
        if (tenantOpt.isPresent()) {
            return buildTenantContext(tenantOpt.get());
        }

        // 2. Try unit QR token
        var unitOpt = unitRepository.findByQrToken(token);
        if (unitOpt.isPresent()) {
            return buildUnitContext(unitOpt.get());
        }

        // 3. Try property QR token
        RentProperty property = propertyService.requirePropertyByToken(token);
        return buildPropertyContext(property);
    }

    private RentDtos.TenantPayContext buildTenantContext(RentTenant tenant) {
        if (!tenant.isActive()) {
            throw new ApiException(410, "This tenant is no longer active");
        }
        RentUnit unit     = tenant.getUnit();
        RentProperty prop = unit.getProperty();

        String period = currentPeriod();
        RentCharge charge = chargeRepository
                .findByTenant_IdAndPeriodLabel(tenant.getId(), period)
                .orElse(null);

        int totalRent  = (charge != null) ? charge.getAmount()    : unit.getMonthlyAmount();
        int paid       = (charge != null) ? charge.getPaidAmount() : 0;
        int balance    = (charge != null) ? charge.getOutstandingAmount() : totalRent;
        LocalDate due  = (charge != null) ? charge.getDueDate()
                                          : unit.dueDateForPeriod(period);
        String status  = (charge != null) ? charge.getStatus().name() : "UNPAID";

        List<RentDtos.PaymentSummary> recent = recentPayments(charge);

        // First name only — never expose full name to public token holder
        String firstName = firstWord(tenant.getName());

        return new RentDtos.TenantPayContext(
                "tenant",
                prop.getId(), prop.getName(), prop.getOwnerName(), prop.getCurrency(),
                unit.getId(), unit.getUnitNumber(),
                tenant.getId(), firstName,
                totalRent, paid, balance,
                period, due,
                computeDaysRemaining(due, prop.getTimezone(), unit.getGracePeriodDays()),
                status,
                prop.isPartialPaymentAllowed(), prop.getMinPaymentAmount(),
                recent,
                List.of());
    }

    private RentDtos.TenantPayContext buildUnitContext(RentUnit unit) {
        RentProperty prop  = unit.getProperty();
        RentTenant tenant  = unit.getActiveTenant();

        String period = currentPeriod();
        RentCharge charge = (tenant != null)
                ? chargeRepository.findByTenant_IdAndPeriodLabel(tenant.getId(), period).orElse(null)
                : null;

        int totalRent  = (charge != null) ? charge.getAmount()
                       : (tenant != null ? unit.getMonthlyAmount() : 0);
        int paid       = (charge != null) ? charge.getPaidAmount() : 0;
        int balance    = (charge != null) ? charge.getOutstandingAmount() : totalRent;
        LocalDate due  = (charge != null) ? charge.getDueDate()
                                          : unit.dueDateForPeriod(period);
        String status  = (charge != null) ? charge.getStatus().name()
                       : (tenant != null ? "UNPAID" : null);

        List<RentDtos.PaymentSummary> recent = recentPayments(charge);
        String firstName = (tenant != null) ? firstWord(tenant.getName()) : null;

        return new RentDtos.TenantPayContext(
                "unit",
                prop.getId(), prop.getName(), prop.getOwnerName(), prop.getCurrency(),
                unit.getId(), unit.getUnitNumber(),
                tenant != null ? tenant.getId() : null,
                firstName,
                totalRent, paid, balance,
                period, due,
                tenant != null
                        ? computeDaysRemaining(due, prop.getTimezone(), unit.getGracePeriodDays())
                        : null,
                status,
                prop.isPartialPaymentAllowed(), prop.getMinPaymentAmount(),
                recent,
                List.of());
    }

    private RentDtos.TenantPayContext buildPropertyContext(RentProperty prop) {
        List<RentUnit> units = unitRepository.findByProperty_IdOrderByUnitNumberAsc(prop.getId());
        List<RentDtos.UnitPickOption> options = units.stream().map(u ->
                new RentDtos.UnitPickOption(
                        u.getId(), u.getUnitNumber(), u.getFloor(),
                        u.getMonthlyAmount(), u.getActiveTenant() != null))
                .toList();

        // No unit selected yet — balance/days fields are null at property level
        return new RentDtos.TenantPayContext(
                "property",
                prop.getId(), prop.getName(), prop.getOwnerName(), prop.getCurrency(),
                null, null, null, null,
                null, null, null,
                currentPeriod(), null, null, null,
                prop.isPartialPaymentAllowed(), prop.getMinPaymentAmount(),
                List.of(), options);
    }

    // ── Initiate payment ──────────────────────────────────────────────────────

    /**
     * Creates a pending {@link RentPayment} and calls the MoMo gateway.
     *
     * <p>Security rules enforced here (never trusted from the client):
     * <ul>
     *   <li>If {@code chargeId} is provided, it must belong to the unit resolved
     *       from {@code token}/{@code unitId} — prevents cross-tenant payment.</li>
     *   <li>{@code amount} must be {@code > 0} and {@code <= outstanding}.</li>
     *   <li>If {@code partialPaymentAllowed = false} on the property, the amount
     *       must equal the full outstanding balance.</li>
     *   <li>If {@code minPaymentAmount > 0}, the amount must meet the floor.</li>
     * </ul>
     *
     * @param token    pay-page token (property / unit / tenant QR)
     * @param unitId   required when token is property-level
     * @param chargeId optional — client may supply the charge ID it resolved earlier
     * @param req      phone, name, optional amount
     */
    @Transactional
    public RentDtos.InitiateRentPaymentResponse initiatePayment(
            String token,
            String unitId,
            Long chargeId,
            RentDtos.InitiateRentPaymentRequest req) {

        // 1. Resolve the unit first (needed for chargeId security check)
        RentUnit unit = resolveUnit(token, unitId);
        RentProperty property = unit.getProperty();

        // 2. Resolve or auto-create the charge — verify it belongs to this unit
        RentCharge charge = resolveOrCreateCharge(unit, chargeId);

        int outstanding = charge.getOutstandingAmount();
        if (outstanding <= 0) {
            throw new ApiException(400, "This charge is already fully paid");
        }

        // 3. Determine and validate the requested amount (server-side — never trust client)
        int requestedAmount = (req.amount() != null) ? req.amount() : outstanding;

        if (requestedAmount <= 0) {
            throw new ApiException(400, "Payment amount must be greater than zero");
        }
        if (requestedAmount > outstanding) {
            throw new ApiException(400,
                    "Payment amount " + requestedAmount + " exceeds outstanding balance " + outstanding);
        }
        if (!property.isPartialPaymentAllowed() && requestedAmount < outstanding) {
            throw new ApiException(400,
                    "Partial payments are not allowed for this property. "
                    + "Please pay the full balance of " + outstanding + " " + property.getCurrency());
        }
        int minAmount = property.getMinPaymentAmount();
        if (minAmount > 0 && requestedAmount < minAmount) {
            throw new ApiException(400,
                    "Minimum payment is " + minAmount + " " + property.getCurrency());
        }

        String transactionRef = generateTransactionRef();
        String period = charge.getPeriodLabel();

        // 4. Create pending payment record
        RentPayment payment = new RentPayment();
        payment.setCharge(charge);
        payment.setTransactionRef(transactionRef);
        payment.setAmount(requestedAmount);
        payment.setCurrency(property.getCurrency());
        payment.setPaymentMethod(req.paymentMethod() != null ? req.paymentMethod() : "MobileMoney");
        payment.setStatus(RentPaymentStatus.Pending);
        payment.setCreatedAt(Instant.now());
        paymentRepository.save(payment);

        // 5. Call gateway
        PaymentDtos.InitiateResponse gatewayResponse;
        try {
            gatewayResponse = paymentGatewayService.initiate(new PaymentDtos.InitiateRequest(
                    PaymentContext.RENT,
                    transactionRef,
                    req.paymentMethod(),
                    requestedAmount,
                    property.getCurrency(),
                    req.customerPhone().trim(),
                    req.customerName() != null ? req.customerName().trim() : "",
                    null,   // businessId — rent has no Scanny business entity
                    "Rent — " + unit.getUnitNumber() + " · " + period
            ));
        } catch (Exception e) {
            log.error("[Rent] Gateway error for {}: {}", transactionRef, e.getMessage());
            payment.setStatus(RentPaymentStatus.Failed);
            payment.setFailedAt(Instant.now());
            payment.setFailureReason(e.getMessage());
            paymentRepository.save(payment);
            throw new ApiException(502, "Could not start payment: " + e.getMessage());
        }

        return new RentDtos.InitiateRentPaymentResponse(
                true,
                gatewayResponse.message(),
                transactionRef,
                gatewayResponse.paymentId(),
                property.getOwnerMomo(),
                requestedAmount,
                property.getCurrency(),
                period);
    }

    // ── Complete payment (gateway callback) ───────────────────────────────────

    /**
     * Called by {@code PaymentIntentService.onPaid} via the RENT context case.
     *
     * <p>Idempotency and double-processing prevention:
     * <ol>
     *   <li>Acquires a pessimistic write lock on the payment row before reading
     *       its status — prevents two concurrent webhook deliveries from both
     *       marking the payment Completed.</li>
     *   <li>If the row is already {@code Completed} it returns immediately
     *       without re-sending receipts.</li>
     * </ol>
     *
     * @param transactionRef gateway transaction reference
     * @param confirmedAmount amount confirmed by the gateway (minor units).
     *                        Pass {@code null} if the gateway callback doesn't
     *                        include amount (will skip amount verification).
     */
    @Transactional
    public void completePayment(String transactionRef, Integer confirmedAmount) {
        // Lock the row immediately — prevents concurrent completion
        RentPayment payment = paymentRepository
                .findByTransactionRefForUpdate(transactionRef)
                .orElse(null);

        if (payment == null) {
            log.warn("[Rent] completePayment: no payment found for ref {}", transactionRef);
            return;
        }

        // Idempotent — already processed
        if (payment.getStatus() == RentPaymentStatus.Completed) {
            log.debug("[Rent] completePayment: already completed for ref {}", transactionRef);
            return;
        }

        // Verify the gateway-confirmed amount matches what we recorded
        if (confirmedAmount != null && confirmedAmount != payment.getAmount()) {
            log.error("[Rent] Amount mismatch for {}: recorded={} confirmed={}",
                    transactionRef, payment.getAmount(), confirmedAmount);
            // Mark failed — do not credit an amount we didn't expect
            payment.setStatus(RentPaymentStatus.Failed);
            payment.setFailedAt(Instant.now());
            payment.setFailureReason("Amount mismatch: expected " + payment.getAmount()
                    + ", gateway confirmed " + confirmedAmount);
            paymentRepository.save(payment);
            return;
        }

        payment.setStatus(RentPaymentStatus.Completed);
        payment.setPaidAt(Instant.now());
        paymentRepository.save(payment);

        // Reload charge with payments to recompute status correctly
        RentCharge charge = chargeRepository.findById(payment.getCharge().getId()).orElse(null);
        if (charge != null) {
            chargeService.recomputeStatus(charge);
            sendPaymentReceipts(payment, charge);
        }
    }

    /**
     * Backward-compatible overload — called when confirmed amount is not available.
     */
    @Transactional
    public void completePayment(String transactionRef) {
        completePayment(transactionRef, null);
    }

    /**
     * Sends a WhatsApp receipt to the tenant and a collection alert to the
     * landlord / property owner. Both are best-effort — failures are logged but
     * do not roll back the payment.
     */
    private void sendPaymentReceipts(RentPayment payment, RentCharge charge) {
        try {
            RentUnit unit        = charge.getUnit();
            RentTenant tenant    = charge.getTenant();
            RentProperty property = unit.getProperty();

            String period  = charge.getPeriodLabel();
            String amount  = String.format(Locale.US, "%,d %s", payment.getAmount(), payment.getCurrency());
            String txnRef  = payment.getTransactionRef();
            String unitNum = unit.getUnitNumber();
            String propName = property.getName();

            // ── Tenant receipt ────────────────────────────────────────────────
            if (tenant.getPhone() != null && !tenant.getPhone().isBlank()) {
                String tenantMsg = String.format(
                    "✅ Rent paid — %s\n" +
                    "Unit %s\n" +
                    "Period: %s\n" +
                    "Amount: %s\n" +
                    "Ref: %s\n" +
                    "Thank you!",
                    propName, unitNum, period, amount, txnRef
                );
                outboxService.enqueueWhatsapp(tenant.getPhone(), tenantMsg);
            }

            // ── Landlord / owner alert ────────────────────────────────────────
            if (property.getOwnerMomo() != null && !property.getOwnerMomo().isBlank()) {
                String ownerMsg = String.format(
                    "🏠 Rent received — %s\n" +
                    "Tenant: %s, Unit %s\n" +
                    "Period: %s\n" +
                    "Amount: %s\n" +
                    "Ref: %s",
                    propName, tenant.getName(), unitNum, period, amount, txnRef
                );
                // Owner MoMo is their payment number; if they have a separate
                // account phone, use that — fall back to ownerMomo as contact.
                String ownerPhone = property.getOwnerAccount() != null
                        && property.getOwnerAccount().getPhone() != null
                        && !property.getOwnerAccount().getPhone().isBlank()
                        ? property.getOwnerAccount().getPhone()
                        : property.getOwnerMomo();
                outboxService.enqueueWhatsapp(ownerPhone, ownerMsg);
            }
        } catch (Exception e) {
            log.warn("[Rent] Failed to enqueue payment receipt WhatsApp messages for {}: {}",
                    payment.getTransactionRef(), e.getMessage());
        }
    }

    /**
     * Called by {@code PaymentIntentService.onFailed}.
     */
    @Transactional
    public void failPayment(String transactionRef, String reason) {
        paymentRepository.findByTransactionRef(transactionRef).ifPresent(payment -> {
            if (payment.getStatus() == RentPaymentStatus.Completed) return;
            payment.setStatus(RentPaymentStatus.Failed);
            payment.setFailedAt(Instant.now());
            payment.setFailureReason(reason);
            paymentRepository.save(payment);
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Resolves the charge to pay against, given the already-resolved unit.
     *
     * <p>Security: when the client supplies a {@code chargeId}, we verify it
     * belongs to the current active tenant of this unit — a tenant cannot pay
     * another unit's charge even if they guessed the charge ID.
     */
    private RentCharge resolveOrCreateCharge(RentUnit unit, Long chargeId) {
        RentTenant tenant = unit.getActiveTenant();
        if (tenant == null) {
            throw new ApiException(400, "No active tenant in unit " + unit.getUnitNumber());
        }

        if (chargeId != null) {
            RentCharge charge = chargeService.requireCharge(chargeId);
            // Security check — charge must belong to this unit's active tenant
            if (!charge.getUnit().getId().equals(unit.getId())
                    || !charge.getTenant().getId().equals(tenant.getId())) {
                throw new ApiException(403, "Charge does not belong to this unit");
            }
            return charge;
        }

        String period = currentPeriod();
        return chargeRepository.findByTenant_IdAndPeriodLabel(tenant.getId(), period)
                .orElseGet(() -> {
                    // Auto-create charge if none exists (prevents blocking payment)
                    RentCharge autoCharge = new RentCharge();
                    autoCharge.setTenant(tenant);
                    autoCharge.setUnit(unit);
                    autoCharge.setAmount(unit.getMonthlyAmount());
                    autoCharge.setCurrency(unit.getProperty().getCurrency());
                    autoCharge.setPeriodLabel(period);
                    autoCharge.setDueDate(unit.dueDateForPeriod(period));
                    autoCharge.setStatus(RentChargeStatus.UNPAID);
                    autoCharge.setCreatedAt(Instant.now());
                    return chargeRepository.save(autoCharge);
                });
    }

    /**
     * Resolves the unit from a token or explicit unitId.
     * Also handles tenant pay tokens — resolves to the tenant's unit.
     */
    private RentUnit resolveUnit(String token, String unitId) {
        if (unitId != null && !unitId.isBlank()) {
            return unitRepository.findById(unitId)
                    .orElseThrow(() -> new ApiException(404, "Unit not found: " + unitId));
        }
        // Try unit QR token first
        var unitOpt = unitRepository.findByQrToken(token);
        if (unitOpt.isPresent()) return unitOpt.get();
        // Try tenant pay token
        var tenantOpt = tenantRepository.findByPayToken(token);
        if (tenantOpt.isPresent()) return tenantOpt.get().getUnit();
        throw new ApiException(400, "Unit ID required for property-level QR payments");
    }

    private String currentPeriod() {
        return YearMonth.now().toString(); // "2026-11"
    }

    private String generateTransactionRef() {
        return "RENT-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
    }

    /**
     * Computes the signed number of days between today (in the property's
     * timezone) and the charge due date, adjusted for the grace period.
     *
     * <ul>
     *   <li>Positive → days still remaining before the charge becomes overdue.</li>
     *   <li>Zero     → last day of grace period (due today).</li>
     *   <li>Negative → number of days the charge is overdue.</li>
     * </ul>
     *
     * @param dueDate         the charge due date
     * @param ianaTimezone    IANA zone id string, e.g. "Africa/Kampala"
     * @param gracePeriodDays extra days after due date before OVERDUE status
     */
    private static Integer computeDaysRemaining(
            LocalDate dueDate, String ianaTimezone, int gracePeriodDays) {
        if (dueDate == null) return null;
        ZoneId zone;
        try {
            zone = ZoneId.of(ianaTimezone != null ? ianaTimezone : "Africa/Kampala");
        } catch (Exception e) {
            zone = ZoneId.of("Africa/Kampala");
        }
        LocalDate today = LocalDate.now(zone);
        LocalDate overdueDate = dueDate.plusDays(gracePeriodDays);
        return (int) ChronoUnit.DAYS.between(today, overdueDate);
    }

    /**
     * Returns the most recent completed payments for a charge, capped at 5.
     * Returns an empty list when the charge is null or has no completed payments.
     */
    private List<RentDtos.PaymentSummary> recentPayments(RentCharge charge) {
        if (charge == null || charge.getPayments() == null) return List.of();
        return charge.getPayments().stream()
                .filter(p -> p.getStatus() == RentPaymentStatus.Completed)
                .limit(5)
                .map(RentDtos.PaymentSummary::from)
                .toList();
    }

    /** Returns the first whitespace-delimited word of a name string. */
    private static String firstWord(String name) {
        if (name == null || name.isBlank()) return null;
        int space = name.indexOf(' ');
        return space > 0 ? name.substring(0, space) : name;
    }
}
