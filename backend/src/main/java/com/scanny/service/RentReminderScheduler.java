package com.scanny.service;

import com.scanny.entity.RentCharge;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentTenant;
import com.scanny.entity.RentUnit;
import com.scanny.model.enums.RentChargeStatus;
import com.scanny.repository.RentChargeRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daily scheduler that:
 * <ol>
 *   <li><b>Marks overdue:</b> flips any UNPAID or PARTIAL charge whose due date
 *       has already passed to OVERDUE.</li>
 *   <li><b>Upcoming reminders:</b> sends a WhatsApp message to tenants whose
 *       rent is due in exactly 3 days (if still UNPAID / PARTIAL).</li>
 *   <li><b>Overdue reminders:</b> sends a WhatsApp message to tenants who are
 *       1, 3, or 7 days past their due date and still haven't fully paid.</li>
 * </ol>
 *
 * <p>Runs at 08:00 every morning (server local time).
 * All three jobs run inside a single scheduled invocation to avoid redundant
 * database round-trips.
 */
@Component
public class RentReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(RentReminderScheduler.class);

    /** Days before due date to send an upcoming reminder. */
    private static final int REMINDER_DAYS_BEFORE = 3;

    /** Days past due date at which we send overdue chaser messages. */
    private static final int[] OVERDUE_CHASER_DAYS = { 1, 3, 7 };

    private final RentChargeRepository chargeRepository;
    private final OutboxService outboxService;

    @Value("${scanny.customer-url:https://scanny.app}")
    private String customerUrl;

    public RentReminderScheduler(
            RentChargeRepository chargeRepository,
            OutboxService outboxService) {
        this.chargeRepository = chargeRepository;
        this.outboxService = outboxService;
    }

    /**
     * Main daily job. Cron: every day at 08:00.
     * Override via {@code scanny.rent.reminder-cron} in application properties.
     */
    @Scheduled(cron = "${scanny.rent.reminder-cron:0 0 8 * * *}")
    @Transactional
    public void runDailyJobs() {
        LocalDate today = LocalDate.now();
        log.info("[Rent] Running daily reminder jobs for {}", today);

        int overdueMarked   = markOverdueCharges(today);
        int upcomingsSent   = sendUpcomingReminders(today);
        int chasersSent     = sendOverdueChasers(today);

        log.info("[Rent] Daily jobs done — overdueMarked={}, upcomingReminders={}, overdueChasers={}",
                overdueMarked, upcomingsSent, chasersSent);
    }

    // ── Job 1: Mark overdue ───────────────────────────────────────────────────

    /**
     * Finds every UNPAID or PARTIAL charge whose due date is before today and
     * flips its status to OVERDUE. Idempotent — charges already OVERDUE are
     * untouched.
     *
     * @return number of charges updated
     */
    private int markOverdueCharges(LocalDate today) {
        List<RentCharge> candidates = chargeRepository.findAllOverdue(today);
        if (candidates.isEmpty()) return 0;

        int count = 0;
        for (RentCharge charge : candidates) {
            charge.setStatus(RentChargeStatus.OVERDUE);
            charge.setUpdatedAt(Instant.now());
            chargeRepository.save(charge);
            count++;
        }
        log.debug("[Rent] Marked {} charges as OVERDUE", count);
        return count;
    }

    // ── Job 2: Upcoming reminders ─────────────────────────────────────────────

    /**
     * Sends a "rent due in 3 days" reminder to each tenant with an UNPAID or
     * PARTIAL charge due on exactly {@code today + REMINDER_DAYS_BEFORE}.
     *
     * @return number of WhatsApp messages enqueued
     */
    private int sendUpcomingReminders(LocalDate today) {
        LocalDate targetDay = today.plusDays(REMINDER_DAYS_BEFORE);
        List<RentCharge> due = chargeRepository.findDueSoon(targetDay, targetDay);
        if (due.isEmpty()) return 0;

        int sent = 0;
        for (RentCharge charge : due) {
            RentTenant tenant = charge.getTenant();
            if (tenant == null || !tenant.isActive()) continue;
            if (isBlank(tenant.getPhone())) continue;

            RentUnit unit       = charge.getUnit();
            RentProperty prop   = unit.getProperty();
            String amount       = formatMoney(charge.getOutstandingAmount(), charge.getCurrency());

            String message = String.format(
                "📅 Rent reminder — %s\n" +
                "Unit %s | Period: %s\n" +
                "Amount due: %s\n" +
                "Due date: %s\n" +
                "Pay now: %s",
                prop.getName(),
                unit.getUnitNumber(),
                charge.getPeriodLabel(),
                amount,
                charge.getDueDate(),
                buildPayUrl(tenant)
            );

            outboxService.enqueueWhatsapp(tenant.getPhone(), message);
            sent++;
        }
        log.debug("[Rent] Enqueued {} upcoming-due reminder(s)", sent);
        return sent;
    }

    // ── Job 3: Overdue chasers ────────────────────────────────────────────────

    /**
     * For each configured chaser day (1, 3, 7 days past due), finds charges
     * that became overdue exactly that many days ago and sends a chaser message.
     * Only sends to tenants whose charge is still UNPAID, PARTIAL, or OVERDUE.
     *
     * @return total number of chaser messages enqueued
     */
    private int sendOverdueChasers(LocalDate today) {
        int sent = 0;
        for (int daysLate : OVERDUE_CHASER_DAYS) {
            LocalDate targetDueDate = today.minusDays(daysLate);
            List<RentCharge> overdue = chargeRepository.findDueSoon(targetDueDate, targetDueDate);

            for (RentCharge charge : overdue) {
                // Skip if already fully paid (PAID / WAIVED)
                if (charge.getStatus() == RentChargeStatus.PAID
                        || charge.getStatus() == RentChargeStatus.WAIVED) {
                    continue;
                }
                RentTenant tenant = charge.getTenant();
                if (tenant == null || !tenant.isActive()) continue;
                if (isBlank(tenant.getPhone())) continue;

                RentUnit unit     = charge.getUnit();
                RentProperty prop = unit.getProperty();
                String amount     = formatMoney(charge.getOutstandingAmount(), charge.getCurrency());

                String message = String.format(
                    "⚠️ Overdue rent — %s\n" +
                    "Unit %s | Period: %s\n" +
                    "Outstanding: %s (%d day%s overdue)\n" +
                    "Please pay as soon as possible:\n%s",
                    prop.getName(),
                    unit.getUnitNumber(),
                    charge.getPeriodLabel(),
                    amount,
                    daysLate,
                    daysLate == 1 ? "" : "s",
                    buildPayUrl(tenant)
                );

                outboxService.enqueueWhatsapp(tenant.getPhone(), message);
                sent++;
            }
        }
        log.debug("[Rent] Enqueued {} overdue chaser message(s)", sent);
        return sent;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String buildPayUrl(RentTenant tenant) {
        return customerUrl + "/rent/pay/" + tenant.getPayToken();
    }

    private static String formatMoney(int amount, String currency) {
        return String.format(Locale.US, "%,d %s", amount, currency != null ? currency : "UGX");
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
