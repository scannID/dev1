package com.scanny.dto;

import java.util.List;

/**
 * DTOs for the merchant accounting / financial ledger endpoints.
 *
 * <p>All monetary values are in UGX (integer, smallest unit = 1 UGX).
 */
public class AccountingDtos {

    // ── Summary ──────────────────────────────────────────────────────────────

    /**
     * Aggregate financial summary for a business over a date range.
     */
    public record AccountingSummary(
            /** Total customer-paid amount (subtotal + serviceFee). */
            long grossRevenue,
            /** Merchant's net credit: subtotal + any merchant share of the fee. */
            long netRevenue,
            /** Platform service fees collected across all paid orders. */
            long totalServiceFees,
            /** PSO portion of the service fees. */
            long totalPsoFees,
            /** Scanny platform portion of the service fees. */
            long totalPlatformFees,
            /** Recipe / COGS cost locked at payment time. */
            long totalCogs,
            /** netRevenue − totalCogs */
            long grossProfit,
            /** (grossProfit / netRevenue) × 100, 0 when netRevenue = 0 */
            double marginPercent,

            /** Number of paid orders included in these totals. */
            long paidOrderCount,
            /** Number of unpaid (outstanding) orders. */
            long unpaidOrderCount,
            /** Number of refunded orders. */
            long refundedOrderCount,
            /** Total orders in range (all statuses). */
            long totalOrderCount,

            /** Net revenue from cash orders only. */
            long cashNetRevenue,
            /** Number of paid cash orders. */
            long cashOrderCount,
            /** Net revenue from MoMo orders only. */
            long momoNetRevenue,
            /** Number of paid MoMo orders. */
            long momoOrderCount,

            /** Outstanding amount not yet collected (unpaid merchantPayout). */
            long outstandingRevenue,

            /** ISO-8601 start of the queried window (inclusive), or null for "all time". */
            String from,
            /** ISO-8601 end of the queried window (exclusive), or null for "all time". */
            String to
    ) {}

    // ── Ledger row ───────────────────────────────────────────────────────────

    /**
     * One row in the transaction ledger — one order per row.
     */
    public record LedgerEntry(
            String orderId,
            /** Shorter public-facing reference shown to customers. */
            String publicId,
            /** ISO-8601 creation timestamp. */
            String createdAt,
            String customerName,
            String customerPhone,
            /** Table / location label. */
            String location,
            /** "MOMO" | "CASH" */
            String paymentMethod,
            /** "Paid" | "Unpaid" | "Refunded" */
            String paymentStatus,
            /** "Pending" | "Preparing" | "Ready" | "Completed" | "Cancelled" */
            String orderStatus,
            /** What the customer paid (subtotal + serviceFee). */
            int grossAmount,
            /** Service fee charged on this order. */
            int serviceFee,
            /** Merchant's net credit on this order. */
            int netAmount,
            /** Recipe COGS locked at payment time. */
            int cogs,
            /** netAmount − cogs */
            int profit,
            /** MoMo payment reference / transaction ref. */
            String paymentReference,
            /** Comma-separated item summary e.g. "2× Chips, 1× Soda". */
            String itemsSummary
    ) {}

    // ── Paged ledger response ────────────────────────────────────────────────

    public record AccountingLedgerResponse(
            List<LedgerEntry> entries,
            long totalEntries,
            int page,
            int size,
            int totalPages
    ) {}

    // ── Daily revenue series (for sparklines / mini charts) ─────────────────

    public record DailyRevenueSeries(
            /** ISO date labels, e.g. "Oct 1". */
            List<String> labels,
            /** Net revenue per day (UGX). */
            List<Long> netRevenue,
            /** Order count per day. */
            List<Integer> orderCount
    ) {}
}
