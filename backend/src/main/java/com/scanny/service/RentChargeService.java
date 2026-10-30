package com.scanny.service;

import com.scanny.dto.RentDtos;
import com.scanny.entity.RentAccount;
import com.scanny.entity.RentCharge;
import com.scanny.entity.RentPayment;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentTenant;
import com.scanny.entity.RentUnit;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.RentChargeStatus;
import com.scanny.model.enums.RentPaymentMethod;
import com.scanny.model.enums.RentPaymentStatus;
import com.scanny.repository.RentChargeRepository;
import com.scanny.repository.RentPaymentRepository;
import com.scanny.repository.RentTenantRepository;
import com.scanny.repository.RentUnitRepository;
import com.scanny.rent.gateway.ManualGateway;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages rent charges — generating them for a period, querying them,
 * and updating their status as payments arrive.
 */
@Service
public class RentChargeService {

    private final RentChargeRepository chargeRepository;
    private final RentUnitRepository unitRepository;
    private final RentTenantRepository tenantRepository;
    private final RentPaymentRepository paymentRepository;
    private final RentPropertyService propertyService;
    private final AuditService auditService;
    private final ManualGateway manualGateway;

    public RentChargeService(
            RentChargeRepository chargeRepository,
            RentUnitRepository unitRepository,
            RentTenantRepository tenantRepository,
            RentPaymentRepository paymentRepository,
            RentPropertyService propertyService,
            AuditService auditService,
            ManualGateway manualGateway) {
        this.chargeRepository = chargeRepository;
        this.unitRepository = unitRepository;
        this.tenantRepository = tenantRepository;
        this.paymentRepository = paymentRepository;
        this.propertyService = propertyService;
        this.auditService = auditService;
        this.manualGateway = manualGateway;
    }

    // ── Generate charges ──────────────────────────────────────────────────────

    /**
     * Generates one {@link RentCharge} per active tenant in the property for
     * the requested period. Idempotent: skips tenants that already have a
     * charge for that period.
     * <p>
     * The due date is derived from each unit's {@code dueDayOfMonth}, clamped
     * to the last day of the period month so "day 31 in February" never throws.
     * If the request body includes an explicit {@code dueDate}, that overrides
     * the per-unit due-day for every charge in this batch.
     *
     * @param account       the requesting account (must have manager access)
     * @param propertyId    target property
     * @param req           period + optional explicit due date
     * @return list of created (not skipped) charge responses
     */
    @Transactional
    public List<RentDtos.ChargeResponse> generateCharges(
            RentAccount account,
            String propertyId,
            RentDtos.GenerateChargesRequest req) {

        RentProperty property = propertyService.requireProperty(propertyId);
        propertyService.requireManagerAccess(account, property);

        String periodLabel = parsePeriodLabel(req.periodLabel());
        // Explicit due date from request (optional override)
        LocalDate explicitDueDate = (req.dueDate() != null && !req.dueDate().isBlank())
                ? parseIsoDate(req.dueDate()) : null;

        List<RentUnit> units = unitRepository.findByProperty_IdOrderByUnitNumberAsc(propertyId);
        List<RentDtos.ChargeResponse> created = new ArrayList<>();

        for (RentUnit unit : units) {
            RentTenant tenant = unit.getActiveTenant();
            if (tenant == null) continue;

            // Idempotent — skip if already generated
            if (chargeRepository.existsByTenant_IdAndPeriodLabel(tenant.getId(), periodLabel)) {
                continue;
            }

            // Per-unit due day, clamped to month length; caller may override.
            LocalDate dueDate = (explicitDueDate != null)
                    ? explicitDueDate
                    : unit.dueDateForPeriod(periodLabel);

            RentCharge charge = new RentCharge();
            charge.setTenant(tenant);
            charge.setUnit(unit);
            charge.setAmount(unit.getMonthlyAmount());
            charge.setCurrency(property.getCurrency());
            charge.setPeriodLabel(periodLabel);
            charge.setDueDate(dueDate);
            charge.setStatus(RentChargeStatus.UNPAID);
            charge.setCreatedAt(Instant.now());
            charge.setCreatedBy(account.getEmail());

            created.add(RentDtos.ChargeResponse.from(chargeRepository.save(charge)));
        }

        auditService.success("RENT_CHARGES_GENERATED", "rent_charge", propertyId,
                Map.of("period", periodLabel, "count", created.size(),
                       "by", account.getEmail()));
        return created;
    }

    // ── Generate single unit charge ───────────────────────────────────────────

    /**
     * Generates a charge for the active tenant of a specific unit.
     * Idempotent — returns the existing charge if one already exists for the period.
     */
    @Transactional
    public RentDtos.ChargeResponse generateChargeForUnit(
            RentAccount account,
            String propertyId,
            String unitId,
            RentDtos.GenerateChargesRequest req) {

        RentProperty property = propertyService.requireProperty(propertyId);
        propertyService.requireManagerAccess(account, property);

        String periodLabel = parsePeriodLabel(req.periodLabel());
        LocalDate explicitDueDate = (req.dueDate() != null && !req.dueDate().isBlank())
                ? parseIsoDate(req.dueDate()) : null;

        RentUnit unit = unitRepository.findById(unitId)
                .filter(u -> u.getProperty().getId().equals(propertyId))
                .orElseThrow(() -> new ApiException(404, "Unit not found"));

        RentTenant tenant = unit.getActiveTenant();
        if (tenant == null) {
            throw new ApiException(409, "Unit has no active tenant — cannot generate charge");
        }

        return chargeRepository.findByTenant_IdAndPeriodLabel(tenant.getId(), periodLabel)
                .map(RentDtos.ChargeResponse::from)
                .orElseGet(() -> {
                    LocalDate dueDate = (explicitDueDate != null)
                            ? explicitDueDate
                            : unit.dueDateForPeriod(periodLabel);

                    RentCharge charge = new RentCharge();
                    charge.setTenant(tenant);
                    charge.setUnit(unit);
                    charge.setAmount(unit.getMonthlyAmount());
                    charge.setCurrency(property.getCurrency());
                    charge.setPeriodLabel(periodLabel);
                    charge.setDueDate(dueDate);
                    charge.setStatus(RentChargeStatus.UNPAID);
                    charge.setCreatedAt(Instant.now());
                    charge.setCreatedBy(account.getEmail());

                    RentDtos.ChargeResponse result = RentDtos.ChargeResponse.from(
                            chargeRepository.save(charge));
                    auditService.success("RENT_CHARGE_GENERATED_SINGLE", "rent_charge",
                            unitId, Map.of("period", periodLabel, "by", account.getEmail()));
                    return result;
                });
    }

    // ── Query ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<RentDtos.ChargeResponse> getChargesForProperty(
            RentAccount account, String propertyId, String periodLabel) {

        RentProperty property = propertyService.requireProperty(propertyId);
        propertyService.requireAnyAccess(account, property);

        return chargeRepository.findByPropertyIdAndPeriodLabel(propertyId, periodLabel)
                .stream()
                .map(RentDtos.ChargeResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RentDtos.ChargeResponse> getChargesForTenant(String tenantId) {
        return chargeRepository.findByTenant_IdOrderByDueDateDesc(tenantId)
                .stream()
                .map(RentDtos.ChargeResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public RentCharge requireCharge(Long chargeId) {
        return chargeRepository.findById(chargeId)
                .orElseThrow(() -> new ApiException(404, "Charge not found: " + chargeId));
    }

    // ── Status update ─────────────────────────────────────────────────────────

    @Transactional
    public RentDtos.ChargeResponse updateStatus(
            RentAccount account,
            String propertyId,
            Long chargeId,
            RentDtos.UpdateChargeStatusRequest req) {

        RentProperty property = propertyService.requireProperty(propertyId);
        propertyService.requireManagerAccess(account, property);

        RentCharge charge = requireCharge(chargeId);

        // Guard: charge must belong to this property
        if (!charge.getUnit().getProperty().getId().equals(propertyId)) {
            throw new ApiException(403, "Charge does not belong to this property");
        }

        RentChargeStatus newStatus;
        try {
            newStatus = RentChargeStatus.valueOf(req.status().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(400, "Invalid status: " + req.status());
        }

        // Require a note for manual overrides (WAIVE or mark-as-PAID)
        if ((newStatus == RentChargeStatus.WAIVED || newStatus == RentChargeStatus.PAID)
                && (req.notes() == null || req.notes().isBlank())) {
            throw new ApiException(400,
                    "A note is required when overriding status to " + newStatus);
        }

        charge.setStatus(newStatus);
        if (req.notes() != null) charge.setNotes(req.notes().trim());
        charge.setUpdatedAt(Instant.now());
        charge.setCreatedBy(account.getEmail());

        RentDtos.ChargeResponse result = RentDtos.ChargeResponse.from(chargeRepository.save(charge));
        auditService.success("RENT_CHARGE_STATUS_UPDATED", "rent_charge",
                String.valueOf(chargeId),
                Map.of("newStatus", newStatus.name(), "propertyId", propertyId,
                       "by", account.getEmail()));
        return result;
    }

    /**
     * Called by {@link RentPaymentService} after a payment is confirmed.
     * Recomputes charge status based on total paid vs amount.
     */
    @Transactional
    public void recomputeStatus(RentCharge charge) {
        long paid = charge.getPaidAmount();
        if (paid <= 0) {
            // no change if no completed payment yet
            return;
        }
        RentChargeStatus newStatus = paid >= charge.getAmount()
                ? RentChargeStatus.PAID
                : RentChargeStatus.PARTIAL;
        charge.setStatus(newStatus);
        charge.setUpdatedAt(Instant.now());
        chargeRepository.save(charge);
    }

    // ── Manual payment recording ──────────────────────────────────────────────

    /**
     * Records a manual payment (cash, MoMo transfer, bank deposit, etc.) against
     * a charge.  Uses the {@link com.scanny.rent.gateway.ManualGateway} to generate
     * a transaction reference, then creates a {@link RentPayment} row with
     * status {@code COMPLETED} and recomputes the charge status.
     *
     * <p>Overpayment is rejected unless {@code carryCredit = true}.
     *
     * @param account   the recording manager (must have manager access)
     * @param propertyId target property
     * @param chargeId   the charge to pay against
     * @param req        amount, method, reference, carryCredit flag
     * @return the created payment summary
     */
    @Transactional
    public RentDtos.PaymentSummary recordManualPayment(
            RentAccount account,
            String propertyId,
            Long chargeId,
            RentDtos.RecordManualPaymentRequest req) {

        RentProperty property = propertyService.requireProperty(propertyId);
        propertyService.requireManagerAccess(account, property);

        RentCharge charge = requireCharge(chargeId);
        if (!charge.getUnit().getProperty().getId().equals(propertyId)) {
            throw new ApiException(403, "Charge does not belong to this property");
        }

        // Parse payment method
        RentPaymentMethod method;
        try {
            method = RentPaymentMethod.valueOf(req.method().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(400,
                    "Invalid payment method: " + req.method() + ". Must be CASH, MOMO, BANK, or OTHER");
        }

        // Overpayment guard
        long outstanding = charge.getOutstandingAmount();
        if (req.amount() > outstanding && !req.carryCredit()) {
            throw new ApiException(400,
                    "Payment amount (" + req.amount() + ") exceeds outstanding balance ("
                    + outstanding + "). Set carryCredit=true to accept the surplus as credit.");
        }

        // Use ManualGateway to generate a transaction reference
        var gatewayResult = manualGateway.initiate(
                new com.scanny.rent.gateway.RentPaymentGateway.GatewayCommand(
                        charge,
                        charge.getTenant() != null ? charge.getTenant().getPhone() : "",
                        charge.getTenant() != null ? charge.getTenant().getName() : "",
                        req.amount(),
                        req.reference(),
                        account.getId()));

        RentPayment payment = new RentPayment();
        payment.setCharge(charge);
        payment.setTransactionRef(gatewayResult.transactionRef());
        payment.setAmount(req.amount());
        payment.setCurrency(charge.getCurrency());
        payment.setPaymentMethod(method);
        payment.setStatus(RentPaymentStatus.Completed);
        payment.setPaidAt(Instant.now());
        payment.setRecordedBy(account.getId());
        payment.setCreatedBy(account.getEmail());

        RentPayment saved = paymentRepository.save(payment);

        // Add to the charge's in-memory payments list so recomputeStatus sees it
        charge.getPayments().add(saved);

        // Recompute charge status
        recomputeStatus(charge);

        auditService.success("RENT_MANUAL_PAYMENT_RECORDED", "rent_payment",
                String.valueOf(saved.getId()),
                Map.of("chargeId", String.valueOf(chargeId),
                       "amount", req.amount(),
                       "method", method.name(),
                       "by", account.getEmail()));

        return RentDtos.PaymentSummary.from(saved);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Validates and normalises the period label to "YYYY-MM".
     */
    private String parsePeriodLabel(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ApiException(400, "Period label is required (e.g. '2026-11')");
        }
        String trimmed = raw.trim();
        if (!trimmed.matches("\\d{4}-\\d{2}")) {
            throw new ApiException(400, "Period label must be in YYYY-MM format, got: " + trimmed);
        }
        return trimmed;
    }

    /**
     * Parses a strict ISO date string (YYYY-MM-DD).
     * Throws 400 if the format is wrong.
     */
    private LocalDate parseIsoDate(String rawDate) {
        try {
            return LocalDate.parse(rawDate.trim());
        } catch (DateTimeParseException e) {
            throw new ApiException(400, "Invalid date format (expected YYYY-MM-DD): " + rawDate);
        }
    }
}
