package com.scanny.service;

import com.scanny.entity.FinancialLedgerEntry;
import com.scanny.entity.Order;
import com.scanny.model.enums.LedgerEntryType;
import com.scanny.repository.FinancialLedgerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Writes immutable {@link FinancialLedgerEntry} rows whenever an order is paid or refunded.
 *
 * <h3>Design principles</h3>
 * <ul>
 *   <li><b>Write-once:</b> a deduplication guard prevents double-writing PAYMENT rows
 *       if {@code confirmPaymentFromGateway} is called more than once for the same order
 *       (e.g. MoMo webhook replays).</li>
 *   <li><b>Negative-row refunds:</b> a REFUND row negates all money fields so that any
 *       {@code SUM(net_amount)} over a date window yields the correct settled figure
 *       without special-casing in queries.</li>
 *   <li><b>Fee freeze:</b> all amounts are copied directly from the {@code Order} entity
 *       at the moment the status transition is observed — the ledger row never references
 *       the live {@code Order} row, so future mutations to the order cannot alter
 *       historical accounting figures.</li>
 *   <li><b>REQUIRES_NEW propagation:</b> the ledger write commits in its own transaction,
 *       so a downstream failure (e.g. inventory, WhatsApp) cannot roll back an already
 *       written ledger entry, and a ledger write failure does not abort the payment
 *       confirmation itself — it is logged and the caller continues.</li>
 * </ul>
 */
@Service
public class LedgerWriterService {

    private static final Logger log = LoggerFactory.getLogger(LedgerWriterService.class);

    private final FinancialLedgerRepository ledgerRepository;

    public LedgerWriterService(FinancialLedgerRepository ledgerRepository) {
        this.ledgerRepository = ledgerRepository;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Freezes a PAYMENT ledger row for a newly-paid order.
     *
     * <p>Idempotent: if a PAYMENT row already exists for this order (e.g. duplicate
     * webhook), this method is a no-op and logs a warning.
     *
     * @param order the fully-saved {@code Order} entity with its final fee fields
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordPayment(Order order) {
        if (ledgerRepository.existsByOrderIdAndEntryType(order.getId(), LedgerEntryType.PAYMENT)) {
            log.warn("LedgerWriterService: PAYMENT row already exists for order {} — skipping duplicate",
                    order.getId());
            return;
        }

        FinancialLedgerEntry entry = FinancialLedgerEntry.payment(
                order.getId(),
                order.getBusiness().getId(),
                resolveGross(order),
                resolveNet(order),
                order.getServiceFee(),
                order.getPsoFee(),
                order.getPlatformFee(),
                order.getCogsTotal(),
                order.getPaymentMethod(),
                Instant.now()
        );

        ledgerRepository.save(entry);
        log.debug("LedgerWriterService: PAYMENT row {} written for order {}", entry.getId(), order.getId());
    }

    /**
     * Writes a negative REFUND row for an order that has transitioned from Paid → Refunded.
     *
     * <p>The original PAYMENT row is never mutated. The negative amounts mean that
     * {@code SUM(net_amount)} over any window automatically nets out to zero for a
     * fully-refunded order.
     *
     * @param order the fully-saved {@code Order} entity at the time of refund
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordRefund(Order order) {
        if (ledgerRepository.existsByOrderIdAndEntryType(order.getId(), LedgerEntryType.REFUND)) {
            log.warn("LedgerWriterService: REFUND row already exists for order {} — skipping duplicate",
                    order.getId());
            return;
        }

        FinancialLedgerEntry entry = FinancialLedgerEntry.refund(
                order.getId(),
                order.getBusiness().getId(),
                resolveGross(order),
                resolveNet(order),
                order.getServiceFee(),
                order.getPsoFee(),
                order.getPlatformFee(),
                order.getCogsTotal(),
                order.getPaymentMethod(),
                Instant.now()
        );

        ledgerRepository.save(entry);
        log.debug("LedgerWriterService: REFUND row {} written for order {}", entry.getId(), order.getId());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Resolves the gross customer-paid amount using the same fallback chain
     * used across the rest of the application.
     */
    private static long resolveGross(Order order) {
        return order.getTotal();
    }

    /**
     * Resolves the merchant net payout using the canonical fallback chain:
     * {@code merchantPayout → subtotal → total}.
     */
    private static long resolveNet(Order order) {
        if (order.getMerchantPayout() > 0) return order.getMerchantPayout();
        if (order.getSubtotal()       > 0) return order.getSubtotal();
        return order.getTotal();
    }
}
