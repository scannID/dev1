package com.scanny.service;

import com.scanny.entity.RentCharge;
import com.scanny.entity.RentTenant;
import com.scanny.entity.RentUnit;
import com.scanny.model.enums.RentChargeStatus;
import com.scanny.repository.RentChargeRepository;
import com.scanny.repository.RentTenantRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs on the 1st of every month at 06:00 and auto-generates a {@link RentCharge}
 * for every active tenant that doesn't already have one for the current period.
 *
 * <p>The due date defaults to the 5th of the current month, matching the
 * manual generation logic in {@link RentChargeService}.
 *
 * <p>This is idempotent — if the manager already generated charges manually
 * (or the scheduler ran twice), tenants with existing charges for the period
 * are skipped via the {@code existsByTenant_IdAndPeriodLabel} check baked into
 * the pre-loaded tenant ID set.
 *
 * <p>Override the cron expression via {@code scanny.rent.charge-gen-cron} in
 * application properties (default: 1st of month at 06:00).
 */
@Component
public class RentChargeScheduler {

    private static final Logger log = LoggerFactory.getLogger(RentChargeScheduler.class);

    private final RentTenantRepository tenantRepository;
    private final RentChargeRepository chargeRepository;

    public RentChargeScheduler(
            RentTenantRepository tenantRepository,
            RentChargeRepository chargeRepository) {
        this.tenantRepository = tenantRepository;
        this.chargeRepository = chargeRepository;
    }

    @Scheduled(cron = "${scanny.rent.charge-gen-cron:0 0 6 1 * *}")
    @Transactional
    public void generateMonthlyCharges() {
        YearMonth month = YearMonth.now();
        String periodLabel = month.toString();           // e.g. "2026-11"

        log.info("[Rent] Auto-generating charges for period {}", periodLabel);

        // Load all active tenants across the platform
        List<RentTenant> activeTenants = tenantRepository.findByActiveTrue();
        if (activeTenants.isEmpty()) {
            log.info("[Rent] No active tenants found — nothing to generate");
            return;
        }

        // Pre-load tenant IDs that already have a charge for this period (idempotency)
        Set<String> alreadyCharged = chargeRepository
                .findTenantIdsWithChargeForPeriod(periodLabel)
                .stream()
                .collect(Collectors.toSet());

        int created = 0;
        int skipped = 0;

        for (RentTenant tenant : activeTenants) {
            if (alreadyCharged.contains(tenant.getId())) {
                skipped++;
                continue;
            }

            RentUnit unit = tenant.getUnit();
            if (unit == null || unit.getMonthlyAmount() <= 0) {
                skipped++;
                continue;
            }

            // Per-unit due day, clamped to month length (e.g. day 31 in Feb → 28)
            LocalDate dueDate = unit.dueDateForPeriod(periodLabel);

            RentCharge charge = new RentCharge();
            charge.setTenant(tenant);
            charge.setUnit(unit);
            charge.setAmount(unit.getMonthlyAmount());
            charge.setCurrency(unit.getProperty() != null
                    ? unit.getProperty().getCurrency() : "UGX");
            charge.setPeriodLabel(periodLabel);
            charge.setDueDate(dueDate);
            charge.setStatus(RentChargeStatus.UNPAID);
            charge.setCreatedAt(Instant.now());

            chargeRepository.save(charge);
            created++;
        }

        log.info("[Rent] Charge generation complete — created={}, skipped={}, period={}",
                created, skipped, periodLabel);
    }
}
