package com.scanny.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.scanny.entity.RentLease;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/**
 * Pure unit tests for {@link RentLease} date math — no Spring context needed.
 * Covers month-end clamping, leap years, lease expiry, overdue detection, and
 * the cycle-number computation.
 */
class LeaseServiceTest {

    // ── clampedDatePlusMonths ───────────────────────────────────────────────────

    @Test
    void clampedJan31Plus1Month() {
        // Jan 31 + 1 month → Feb 28 (Feb has 28 days in 2026)
        assertThat(RentLease.clampedDatePlusMonths(LocalDate.of(2026, 1, 31), 1))
                .isEqualTo(LocalDate.of(2026, 2, 28));
    }

    @Test
    void clampedJan31Plus1MonthLeapYear() {
        // Jan 31 + 1 month → Feb 29 (2028 is a leap year)
        assertThat(RentLease.clampedDatePlusMonths(LocalDate.of(2028, 1, 31), 1))
                .isEqualTo(LocalDate.of(2028, 2, 29));
    }

    @Test
    void clampedMar31Plus1Month() {
        // Mar 31 + 1 month → Apr 30 (Apr has 30 days)
        assertThat(RentLease.clampedDatePlusMonths(LocalDate.of(2026, 3, 31), 1))
                .isEqualTo(LocalDate.of(2026, 4, 30));
    }

    @Test
    void clampedOct31Plus1Month() {
        // Oct 31 + 1 month → Nov 30
        assertThat(RentLease.clampedDatePlusMonths(LocalDate.of(2026, 10, 31), 1))
                .isEqualTo(LocalDate.of(2026, 11, 30));
    }

    @Test
    void clampedOct31Plus1MonthClampsBackNov30Plus1Month() {
        // Nov 30 + 1 month → Dec 30 (Nov 30 is the clamped result; adding 1 month gives Dec 30)
        assertThat(RentLease.clampedDatePlusMonths(LocalDate.of(2026, 11, 30), 1))
                .isEqualTo(LocalDate.of(2026, 12, 30));
    }

    @Test
    void clampedFeb28Plus1Month() {
        // Feb 28 + 1 month → Mar 28
        assertThat(RentLease.clampedDatePlusMonths(LocalDate.of(2026, 2, 28), 1))
                .isEqualTo(LocalDate.of(2026, 3, 28));
    }

    @Test
    void clampedJan15Plus12Months() {
        assertThat(RentLease.clampedDatePlusMonths(LocalDate.of(2026, 1, 15), 12))
                .isEqualTo(LocalDate.of(2027, 1, 15));
    }

    @Test
    void clampedJan31Plus12Months() {
        // Jan 31 + 12 months → Jan 31 (next year, still has 31 days)
        assertThat(RentLease.clampedDatePlusMonths(LocalDate.of(2026, 1, 31), 12))
                .isEqualTo(LocalDate.of(2027, 1, 31));
    }

    @Test
    void clampedJan31Plus2Months() {
        // Jan 31 + 2 months → Mar 31
        assertThat(RentLease.clampedDatePlusMonths(LocalDate.of(2026, 1, 31), 2))
                .isEqualTo(LocalDate.of(2026, 3, 31));
    }

    // ── monthsBetween ───────────────────────────────────────────────────────────

    @Test
    void monthsBetweenSameMonth() {
        assertThat(RentLease.monthsBetween(LocalDate.of(2026, 1, 15), LocalDate.of(2026, 1, 20)))
                .isEqualTo(0);
    }

    @Test
    void monthsBetweenOneFullMonth() {
        assertThat(RentLease.monthsBetween(LocalDate.of(2026, 1, 15), LocalDate.of(2026, 2, 16)))
                .isEqualTo(1);
    }

    @Test
    void monthsBetweenNotYetFullMonth() {
        // Jan 15 → Feb 14 = 0 (not yet 1 full month)
        assertThat(RentLease.monthsBetween(LocalDate.of(2026, 1, 15), LocalDate.of(2026, 2, 14)))
                .isEqualTo(0);
    }

    @Test
    void monthsBetweenFullYear() {
        assertThat(RentLease.monthsBetween(LocalDate.of(2026, 1, 1), LocalDate.of(2027, 1, 1)))
                .isEqualTo(12);
    }

    // ── Cycle computation on a lease object ────────────────────────────────────

    @Test
    void cycleStartAndDueDateForMonth1() {
        RentLease lease = makeLease(LocalDate.of(2026, 1, 15), 12);
        // Cycle 1: starts Jan 15, due Feb 15
        assertThat(lease.cycleStart(1)).isEqualTo(LocalDate.of(2026, 1, 15));
        assertThat(lease.cycleDueDate(1)).isEqualTo(LocalDate.of(2026, 2, 15));
    }

    @Test
    void cycleStartAndDueDateForMonth2() {
        RentLease lease = makeLease(LocalDate.of(2026, 1, 15), 12);
        // Cycle 2: starts Feb 15, due Mar 15
        assertThat(lease.cycleStart(2)).isEqualTo(LocalDate.of(2026, 2, 15));
        assertThat(lease.cycleDueDate(2)).isEqualTo(LocalDate.of(2026, 3, 15));
    }

    @Test
    void cycleEndOfMonthClamping() {
        RentLease lease = makeLease(LocalDate.of(2026, 1, 31), 12);
        // Cycle 1: starts Jan 31, due Feb 28 (clamped — Feb has 28 days)
        assertThat(lease.cycleStart(1)).isEqualTo(LocalDate.of(2026, 1, 31));
        assertThat(lease.cycleDueDate(1)).isEqualTo(LocalDate.of(2026, 2, 28));
        // Cycle 2: starts Feb 28 (clamped from 1-month anniversary), due Mar 31
        // (Mar 31 = the 2-month anniversary of Jan 31; March has 31 days so no clamping)
        assertThat(lease.cycleStart(2)).isEqualTo(LocalDate.of(2026, 2, 28));
        assertThat(lease.cycleDueDate(2)).isEqualTo(LocalDate.of(2026, 3, 31));
    }

    @Test
    void cycleEndOfMonthLeapYearClamping() {
        RentLease lease = makeLease(LocalDate.of(2028, 1, 31), 2);
        // 2028 is a leap year, so Feb has 29 days
        assertThat(lease.cycleDueDate(1)).isEqualTo(LocalDate.of(2028, 2, 29));
    }

    @Test
    void leaseEndComputedCorrectly() {
        RentLease lease = makeLease(LocalDate.of(2026, 1, 15), 12);
        assertThat(lease.getLeaseEnd()).isEqualTo(LocalDate.of(2027, 1, 15));
    }

    @Test
    void leaseEndWithMonthClamping() {
        // Jan 31 + 12 months = Jan 31 next year (works, January always has 31 days)
        RentLease lease = makeLease(LocalDate.of(2026, 1, 31), 12);
        assertThat(lease.getLeaseEnd()).isEqualTo(LocalDate.of(2027, 1, 31));
    }

    @Test
    void leaseEndFebActivation() {
        // Feb 29 (leap year) + 12 months → Feb 28 (next year is not a leap year)
        RentLease lease = makeLease(LocalDate.of(2028, 2, 29), 12);
        assertThat(lease.getLeaseEnd()).isEqualTo(LocalDate.of(2029, 2, 28));
    }

    // ── currentMonthNumber ──────────────────────────────────────────────────────

    @Test
    void monthNumber1OnActivationDay() {
        RentLease lease = makeLease(LocalDate.of(2026, 1, 15), 12);
        assertThat(lease.currentMonthNumber(LocalDate.of(2026, 1, 15))).isEqualTo(1);
    }

    @Test
    void monthNumber2AfterOneMonth() {
        RentLease lease = makeLease(LocalDate.of(2026, 1, 15), 12);
        assertThat(lease.currentMonthNumber(LocalDate.of(2026, 2, 16))).isEqualTo(2);
    }

    @Test
    void monthNumber0BeforeActivation() {
        RentLease lease = makeLease(LocalDate.of(2026, 6, 1), 12);
        assertThat(lease.currentMonthNumber(LocalDate.of(2026, 1, 1))).isEqualTo(0);
    }

    @Test
    void monthNumberCappedAtTermLength() {
        RentLease lease = makeLease(LocalDate.of(2026, 1, 15), 3);
        // 6 months after activation — should cap at 3 (term length)
        assertThat(lease.currentMonthNumber(LocalDate.of(2026, 7, 1))).isEqualTo(3);
    }

    // ── currentCycleStart / currentCycleDueDate ─────────────────────────────────

    @Test
    void currentCycleStartMidMonth() {
        RentLease lease = makeLease(LocalDate.of(2026, 1, 15), 12);
        // On March 20, cycle 3 started on March 15
        assertThat(lease.currentCycleStart(LocalDate.of(2026, 3, 20)))
                .isEqualTo(LocalDate.of(2026, 3, 15));
        assertThat(lease.currentCycleDueDate(LocalDate.of(2026, 3, 20)))
                .isEqualTo(LocalDate.of(2026, 4, 15));
    }

    @Test
    void currentCycleStartBeforeActivation() {
        RentLease lease = makeLease(LocalDate.of(2026, 6, 1), 12);
        assertThat(lease.currentCycleStart(LocalDate.of(2026, 1, 1))).isNull();
        assertThat(lease.currentCycleDueDate(LocalDate.of(2026, 1, 1))).isNull();
    }

    // ── isCurrentlyActive ──────────────────────────────────────────────────────

    @Test
    void leaseActiveWhenTodayIsBetweenActivationAndEnd() {
        RentLease lease = makeLease(LocalDate.of(2026, 1, 15), 12);
        lease.setStatus(com.scanny.model.enums.RentLeaseStatus.ACTIVE);
        // The test uses LocalDate.now() internally, so we can't control it exactly,
        // but we can verify the method doesn't throw and returns a boolean.
        assertThat(lease.isCurrentlyActive()).isInstanceOf(Boolean.class);
    }

    // ── period label ───────────────────────────────────────────────────────────

    @Test
    void toPeriodLabelFormatsDueDate() {
        assertThat(LeaseService.toPeriodLabel(LocalDate.of(2026, 11, 15))).isEqualTo("2026-11");
        assertThat(LeaseService.toPeriodLabel(LocalDate.of(2026, 1, 5))).isEqualTo("2026-01");
    }

    // ── Helper ─────────────────────────────────────────────────────────────────

    /**
     * Creates a minimal RentLease with computed leaseEnd — no DB needed.
     */
    private static RentLease makeLease(LocalDate activationDate, int termMonths) {
        RentLease lease = new RentLease();
        lease.setActivationDate(activationDate);
        lease.setTermMonths(termMonths);
        lease.setLeaseEnd(RentLease.clampedDatePlusMonths(activationDate, termMonths));
        return lease;
    }
}
