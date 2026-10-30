package com.scanny.service;

import com.scanny.dto.RentDtos;
import com.scanny.entity.RentCharge;
import com.scanny.entity.RentLease;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentTenant;
import com.scanny.entity.RentUnit;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.RentChargeStatus;
import com.scanny.model.enums.RentLeaseStatus;
import com.scanny.repository.RentChargeRepository;
import com.scanny.repository.RentLeaseRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages the full lifecycle of {@link RentLease} records and the rent charges
 * they generate.
 *
 * <h3>Lifecycle</h3>
 * <ol>
 *   <li>{@link #createLease} — called from {@code RentPropertyService.addTenant};
 *       creates a PENDING lease (or immediately ACTIVE if today ≥ activationDate).</li>
 *   <li>{@link #generateLeaseCharges} — generates one {@link RentCharge} per cycle
 *       up to today.  Idempotent (skips existing charges).</li>
 *   <li>{@link #runDailyLeaseJobs} — daily scheduler at 06:30 Africa/Kampala;
 *       activates PENDING leases and expires ACTIVE ones.</li>
 * </ol>
 *
 * <h3>Date math</h3>
 * All cycle-boundary arithmetic is delegated to
 * {@link RentLease#clampedDatePlusMonths} so short-month clamping (e.g.
 * activated on the 31st → Feb due date clamps to 28th/29th) is applied
 * consistently everywhere.
 */
@Service
public class LeaseService {

    private static final Logger log = LoggerFactory.getLogger(LeaseService.class);
    private static final ZoneId KAMPALA = ZoneId.of("Africa/Kampala");

    private final RentLeaseRepository leaseRepository;
    private final RentChargeRepository chargeRepository;

    public LeaseService(
            RentLeaseRepository leaseRepository,
            RentChargeRepository chargeRepository) {
        this.leaseRepository = leaseRepository;
        this.chargeRepository = chargeRepository;
    }

    // ── Create lease ──────────────────────────────────────────────────────────

    /**
     * Creates a {@link RentLease} for the given tenant/unit pair.
     *
     * <p>The monthly rent amount is snapshotted from {@code unit.monthlyAmount}
     * at the time of creation so future unit price changes don't rewrite this
     * lease's charges.
     *
     * <p>If {@code activationDate} is today or in the past, the lease is set to
     * ACTIVE immediately and all past cycles (up to today) are generated.
     * Otherwise the lease stays PENDING until the daily scheduler activates it.
     *
     * @param tenant         the tenant being assigned
     * @param unit           the unit being leased
     * @param property       the property (for currency)
     * @param activationDate the date rent cycles start (may be today, past, or future)
     * @param termMonths     lease duration in whole months (minimum 1; default 12)
     * @param createdBy      audit trail identifier (manager email)
     * @return the persisted lease
     */
    @Transactional
    public RentLease createLease(
            RentTenant tenant,
            RentUnit unit,
            RentProperty property,
            LocalDate activationDate,
            int termMonths,
            String createdBy) {

        if (termMonths < 1) {
            throw new ApiException(400, "Lease term must be at least 1 month");
        }

        LocalDate leaseEnd = RentLease.clampedDatePlusMonths(activationDate, termMonths);

        RentLease lease = new RentLease();
        lease.setId(generateLeaseId());
        lease.setTenant(tenant);
        lease.setUnit(unit);
        lease.setMonthlyAmountSnapshot(unit.getMonthlyAmount());
        lease.setCurrency(property.getCurrency());
        lease.setActivationDate(activationDate);
        lease.setTermMonths(termMonths);
        lease.setLeaseEnd(leaseEnd);
        lease.setCreatedAt(Instant.now());
        lease.setCreatedBy(createdBy);

        LocalDate today = LocalDate.now(KAMPALA);
        if (!today.isBefore(activationDate)) {
            lease.setStatus(RentLeaseStatus.ACTIVE);
        } else {
            lease.setStatus(RentLeaseStatus.PENDING);
        }

        lease = leaseRepository.save(lease);

        // Generate any charges already due (covers today's and all past cycles)
        if (lease.getStatus() == RentLeaseStatus.ACTIVE) {
            generateLeaseCharges(lease, today, createdBy);
        }

        log.info("[Lease] Created lease {} for tenant {} in unit {} — status={} activation={} end={}",
                lease.getId(), tenant.getId(), unit.getId(),
                lease.getStatus(), activationDate, leaseEnd);
        return lease;
    }

    // ── Generate charges for a lease ─────────────────────────────────────────

    /**
     * Generates all overdue/current {@link RentCharge} rows for a lease up to
     * {@code upToDate} (inclusive of the cycle containing that date).
     *
     * <p>A charge is generated for each cycle N where:
     * <ul>
     *   <li>N ≤ lease.termMonths, and</li>
     *   <li>the cycle's due date ≤ upToDate + some look-ahead (we generate
     *       the current cycle before it is due so the pay page can show it).</li>
     * </ul>
     *
     * <p>Idempotent: existing charges for a period label are skipped.
     *
     * @param lease     the lease to generate charges for
     * @param upToDate  generate charges for cycles whose period start ≤ upToDate
     * @param createdBy audit trail
     * @return list of newly created charges
     */
    @Transactional
    public List<RentCharge> generateLeaseCharges(RentLease lease, LocalDate upToDate, String createdBy) {
        List<RentCharge> created = new ArrayList<>();

        for (int n = 1; n <= lease.getTermMonths(); n++) {
            LocalDate cycleStart = lease.cycleStart(n);
            // Only generate charges for cycles that have started by upToDate
            if (cycleStart.isAfter(upToDate)) break;

            LocalDate dueDate = lease.cycleDueDate(n);
            String periodLabel = toPeriodLabel(dueDate);

            // Idempotent: skip if this cycle already has a charge
            boolean exists = chargeRepository.existsByTenant_IdAndPeriodLabel(
                    lease.getTenant().getId(), periodLabel);
            if (exists) continue;

            RentCharge charge = new RentCharge();
            charge.setLease(lease);
            charge.setTenant(lease.getTenant());
            charge.setUnit(lease.getUnit());
            charge.setAmount(lease.getMonthlyAmountSnapshot());
            charge.setCurrency(lease.getCurrency());
            charge.setPeriodLabel(periodLabel);
            charge.setPeriodStart(cycleStart);
            charge.setDueDate(dueDate);
            charge.setStatus(RentChargeStatus.UNPAID);
            charge.setCreatedAt(Instant.now());
            charge.setCreatedBy(createdBy);

            created.add(chargeRepository.save(charge));
        }

        if (!created.isEmpty()) {
            log.debug("[Lease] Generated {} charge(s) for lease {}", created.size(), lease.getId());
        }
        return created;
    }

    // ── Activate / expire leases ──────────────────────────────────────────────

    /**
     * Daily scheduler at 06:30 Africa/Kampala.
     * <ol>
     *   <li>Activates PENDING leases whose activationDate has arrived.</li>
     *   <li>Expires ACTIVE leases whose leaseEnd date has passed.</li>
     *   <li>For each newly active lease, generates any outstanding charges.</li>
     * </ol>
     */
    @Scheduled(cron = "${scanny.rent.lease-job-cron:0 30 6 * * *}", zone = "Africa/Kampala")
    @Transactional
    public void runDailyLeaseJobs() {
        LocalDate today = LocalDate.now(KAMPALA);
        log.info("[Lease] Running daily lease jobs for {}", today);

        int activated = 0;
        int expired   = 0;

        // Activate PENDING leases
        for (RentLease lease : leaseRepository.findPendingDueForActivation(today)) {
            lease.setStatus(RentLeaseStatus.ACTIVE);
            lease.setUpdatedAt(Instant.now());
            leaseRepository.save(lease);
            generateLeaseCharges(lease, today, "scheduler");
            activated++;
        }

        // Expire ACTIVE leases whose end date has passed
        for (RentLease lease : leaseRepository.findExpiredActive(today)) {
            lease.setStatus(RentLeaseStatus.EXPIRED);
            lease.setUpdatedAt(Instant.now());
            leaseRepository.save(lease);
            expired++;
        }

        log.info("[Lease] Daily lease jobs done — activated={}, expired={}", activated, expired);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    /**
     * Returns the active lease for a unit, or empty if the unit is vacant/
     * has no active lease.
     */
    @Transactional(readOnly = true)
    public Optional<RentLease> findActiveLease(String unitId) {
        return leaseRepository.findByUnit_IdAndStatus(unitId, RentLeaseStatus.ACTIVE);
    }

    /**
     * Returns the active lease for a tenant (by tenant ID), or empty.
     * Scans the tenant's leases and returns the one with ACTIVE status.
     */
    @Transactional(readOnly = true)
    public Optional<RentLease> findActiveLeaseForTenant(String tenantId) {
        return leaseRepository.findByTenant_IdOrderByActivationDateDesc(tenantId)
                .stream()
                .filter(l -> l.getStatus() == RentLeaseStatus.ACTIVE)
                .findFirst();
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    /**
     * Converts a {@link RentLease} to a {@link RentDtos.LeaseResponse} DTO.
     */
    public RentDtos.LeaseResponse toResponse(RentLease lease) {
        LocalDate today = LocalDate.now(KAMPALA);
        int monthNo = lease.currentMonthNumber(today);
        long daysLeft = lease.getStatus() == RentLeaseStatus.ACTIVE
                ? today.until(lease.getLeaseEnd(), java.time.temporal.ChronoUnit.DAYS)
                : 0;
        return new RentDtos.LeaseResponse(
                lease.getId(),
                lease.getTenant().getId(),
                lease.getUnit().getId(),
                lease.getMonthlyAmountSnapshot(),
                lease.getCurrency(),
                lease.getActivationDate(),
                lease.getTermMonths(),
                lease.getLeaseEnd(),
                lease.getStatus().name(),
                monthNo,
                daysLeft);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Returns the "YYYY-MM" period label for a due date.
     * The period label is the year-month of the due date.
     */
    static String toPeriodLabel(LocalDate dueDate) {
        return String.format("%04d-%02d", dueDate.getYear(), dueDate.getMonthValue());
    }

    private static String generateLeaseId() {
        return "RL-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
    }
}
