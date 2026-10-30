package com.scanny.service;

import com.scanny.entity.RentCharge;
import com.scanny.entity.RentNotification;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentTenant;
import com.scanny.entity.RentUnit;
import com.scanny.model.enums.RentChargeStatus;
import com.scanny.repository.RentChargeRepository;
import com.scanny.repository.RentNotificationRepository;
import com.scanny.rent.notification.NotificationSender;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daily scheduler that:
 * <ol>
 *   <li><b>Marks overdue:</b> flips any UNPAID or PARTIAL charge whose
 *       {@code dueDate + gracePeriodDays} has passed to OVERDUE.</li>
 *   <li><b>Upcoming reminders:</b> writes a notification row for each tenant
 *       whose rent is due in exactly 3 days (if still UNPAID / PARTIAL).</li>
 *   <li><b>Overdue chasers:</b> writes notification rows for tenants who are
 *       1, 3, or 7 days past their due date and still haven't fully paid.</li>
 * </ol>
 *
 * <p>Runs at 08:00 every morning in {@code Africa/Kampala}.
 * All three jobs run inside a single scheduled invocation to avoid redundant
 * database round-trips.
 *
 * <p>Notifications are written to the {@code rent_notifications} table — they
 * are NOT sent. The {@link NotificationSender} is called with each row's
 * content for log-only recording; a future delivery worker can dispatch rows
 * whose {@code sentAt} is still null.
 */
@Component
public class RentReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(RentReminderScheduler.class);
    private static final ZoneId KAMPALA = ZoneId.of("Africa/Kampala");

    /** Days before due date to send an upcoming reminder. */
    private static final int REMINDER_DAYS_BEFORE = 3;

    /** Days past due date at which we send overdue chaser messages. */
    private static final int[] OVERDUE_CHASER_DAYS = { 1, 3, 7 };

    private final RentChargeRepository chargeRepository;
    private final RentNotificationRepository notificationRepository;
    private final NotificationSender notificationSender;

    @Value("${scanny.customer-url:https://scanny.app}")
    private String customerUrl;

    public RentReminderScheduler(
            RentChargeRepository chargeRepository,
            RentNotificationRepository notificationRepository,
            NotificationSender notificationSender) {
        this.chargeRepository = chargeRepository;
        this.notificationRepository = notificationRepository;
        this.notificationSender = notificationSender;
    }

    /**
     * Main daily job. Cron: every day at 08:00 Africa/Kampala.
     * Override via {@code scanny.rent.reminder-cron} in application properties.
     */
    @Scheduled(cron = "${scanny.rent.reminder-cron:0 0 8 * * *}", zone = "Africa/Kampala")
    @Transactional
    public void runDailyJobs() {
        LocalDate today = LocalDate.now(KAMPALA);
        log.info("[Rent] Running daily reminder jobs for {} (Africa/Kampala)", today);

        int overdueMarked   = markOverdueCharges(today);
        int upcomingsCreated = createUpcomingReminders(today);
        int chasersCreated   = createOverdueChasers(today);

        log.info("[Rent] Daily jobs done — overdueMarked={}, upcomingNotifications={}, overdueChasers={}",
                overdueMarked, upcomingsCreated, chasersCreated);
    }

    // ── Job 1: Mark overdue ───────────────────────────────────────────────────

    /**
     * Finds every UNPAID or PARTIAL charge whose
     * {@code dueDate + unit.gracePeriodDays} is before today and flips its
     * status to OVERDUE. Idempotent — charges already OVERDUE are untouched.
     *
     * @return number of charges updated
     */
    private int markOverdueCharges(LocalDate today) {
        List<RentCharge> candidates = chargeRepository.findAllOverdue(today);
        if (candidates.isEmpty()) return 0;

        int count = 0;
        for (RentCharge charge : candidates) {
            // Honour per-unit grace period: charge becomes OVERDUE only after
            // dueDate + gracePeriodDays has passed.
            int grace = charge.getUnit().getGracePeriodDays();
            LocalDate effectiveOverdueDate = charge.getDueDate().plusDays(grace);
            if (!effectiveOverdueDate.isBefore(today)) {
                continue; // still within grace window
            }

            charge.setStatus(RentChargeStatus.OVERDUE);
            charge.setUpdatedAt(Instant.now());
            chargeRepository.save(charge);
            count++;
        }
        log.debug("[Rent] Marked {} charges as OVERDUE (after grace)", count);
        return count;
    }

    // ── Job 2: Upcoming reminders ─────────────────────────────────────────────

    /**
     * Creates a notification row for each tenant with an UNPAID or PARTIAL
     * charge due on exactly {@code today + REMINDER_DAYS_BEFORE}.
     *
     * @return number of notification rows created (de-duped by event_type)
     */
    private int createUpcomingReminders(LocalDate today) {
        LocalDate targetDay = today.plusDays(REMINDER_DAYS_BEFORE);
        List<RentCharge> due = chargeRepository.findDueSoon(targetDay, targetDay);
        if (due.isEmpty()) return 0;

        String eventType = "UPCOMING_3D";
        int created = 0;
        for (RentCharge charge : due) {
            RentTenant tenant = charge.getTenant();
            if (tenant == null || !tenant.isActive()) continue;
            if (isBlank(tenant.getPhone())) continue;

            // De-duplicate: skip if we already have a notification of this type
            if (notificationRepository.existsByCharge_IdAndEventType(charge.getId(), eventType)) {
                continue;
            }

            RentUnit unit     = charge.getUnit();
            RentProperty prop = unit.getProperty();
            String amount     = formatMoney(charge.getOutstandingAmount(), charge.getCurrency());

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

            saveNotification(charge, eventType, tenant.getPhone(), message);
            created++;
        }
        log.debug("[Rent] Created {} upcoming-due notification(s)", created);
        return created;
    }

    // ── Job 3: Overdue chasers ────────────────────────────────────────────────

    /**
     * For each configured chaser day (1, 3, 7 days past due), finds charges
     * that became overdue exactly that many days ago and creates a chaser
     * notification row. Only for charges still UNPAID, PARTIAL, or OVERDUE.
     *
     * @return total number of chaser notification rows created
     */
    private int createOverdueChasers(LocalDate today) {
        int created = 0;
        for (int daysLate : OVERDUE_CHASER_DAYS) {
            LocalDate targetDueDate = today.minusDays(daysLate);
            List<RentCharge> overdue = chargeRepository.findDueSoon(targetDueDate, targetDueDate);
            String eventType = "OVERDUE_" + daysLate + "D";

            for (RentCharge charge : overdue) {
                // Skip if already fully paid (PAID / WAIVED)
                if (charge.getStatus() == RentChargeStatus.PAID
                        || charge.getStatus() == RentChargeStatus.WAIVED) {
                    continue;
                }
                RentTenant tenant = charge.getTenant();
                if (tenant == null || !tenant.isActive()) continue;
                if (isBlank(tenant.getPhone())) continue;

                // De-duplicate
                if (notificationRepository.existsByCharge_IdAndEventType(charge.getId(), eventType)) {
                    continue;
                }

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

                saveNotification(charge, eventType, tenant.getPhone(), message);
                created++;
            }
        }
        log.debug("[Rent] Created {} overdue chaser notification(s)", created);
        return created;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Persists a notification row and immediately invokes the
     * {@link NotificationSender} (log-only by default).  The sender is called
     * so the content is captured in logs, but {@code sentAt} is only set if
     * the sender reports success — for {@link com.scanny.rent.notification.LogOnlyNotificationSender}
     * this is always the case.
     */
    private void saveNotification(RentCharge charge, String eventType,
                                  String recipient, String body) {
        RentNotification notif = new RentNotification();
        notif.setId(UUID.randomUUID().toString());
        notif.setCharge(charge);
        notif.setEventType(eventType);
        notif.setChannel("WHATSAPP");
        notif.setRecipient(recipient);
        notif.setBody(body);
        notif.setCreatedAt(Instant.now());
        notificationRepository.save(notif);

        // Log-only dispatch — does not actually send anything
        notificationSender.send("WHATSAPP", recipient, "", body,
                "RENT_NOTIF:" + notif.getId());
        notif.setSentAt(Instant.now());
        notificationRepository.save(notif);
    }

    private String buildPayUrl(RentTenant tenant) {
        return customerUrl + "/rent/pay/" + tenant.getPayToken();
    }

    private static String formatMoney(long amount, String currency) {
        return String.format(Locale.US, "%,d %s", amount, currency != null ? currency : "UGX");
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
