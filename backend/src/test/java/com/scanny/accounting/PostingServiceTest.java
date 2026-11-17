package com.scanny.accounting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.scanny.accounting.entity.JournalEntry;
import com.scanny.accounting.repository.AccountRepository;
import com.scanny.accounting.repository.AccountingPeriodRepository;
import com.scanny.accounting.repository.JournalEntryRepository;
import com.scanny.accounting.repository.JournalLineRepository;
import com.scanny.accounting.repository.PostingFailureRepository;
import com.scanny.accounting.repository.PostingRuleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Integration tests for {@link PostingService}.
 * 
 * <h3>Test Coverage</h3>
 * <ul>
 *   <li>✓ Idempotency: duplicate events silently ignored</li>
 *   <li>✓ Missing posting rule throws PostingException</li>
 *   <li>✓ Balance validation enforced by DB trigger</li>
 * </ul>
 * 
 * <p>These tests use the real database schema (H2) with seeded posting rules from V67 migration.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PostingServiceTest {

    @Autowired private PostingService postingService;
    @Autowired private JournalEntryRepository entryRepo;
    @Autowired private JournalLineRepository lineRepo;
    @Autowired private AccountingPeriodRepository periodRepo;
    @Autowired private PostingRuleRepository ruleRepo;

    // ─────────────────────────────────────────────────────────────────────────
    // Test: Idempotency (duplicate events ignored)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void post_whenDuplicateEvent_shouldIgnoreSilently() {
        // Given: an event
        AccountingEvent event = new AccountingEvent(
                "evt-test-12345",                                    // eventId (unique)
                "ORDER_PAID",                                        // eventType
                "RESTAURANTS",                                       // sourceModule
                "ord-67890",                                         // sourceRecordId
                100_000L, 15_000L, 85_000L, 0L, 0L, 0L,            // amounts
                "merch-001", null, null, null, "MOBILE_MONEY",     // dimensions
                "Duplicate order payment test",                     // description
                Map.of()                                            // extras
        );

        // When: post first time
        postingService.post(event);
        
        // Then: entry created
        Optional<JournalEntry> first = entryRepo.findBySourceModuleAndSourceEventId("RESTAURANTS", "evt-test-12345");
        assertThat(first).isPresent();
        long entryCountAfterFirst = entryRepo.count();

        // When: post second time (duplicate eventId)
        postingService.post(event);

        // Then: no new entry created (idempotent)
        long entryCountAfterSecond = entryRepo.count();
        assertThat(entryCountAfterSecond).isEqualTo(entryCountAfterFirst);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test: Missing posting rule
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void post_whenNoPostingRule_shouldThrowPostingException() {
        // Given: no rule configured for UNKNOWN_MODULE / UNKNOWN_EVENT
        AccountingEvent event = new AccountingEvent(
                "evt-unknown-11111",                                 // eventId
                "UNKNOWN_EVENT",                                     // eventType (no rule)
                "UNKNOWN_MODULE",                                    // sourceModule (no rule)
                "rec-11111",                                         // sourceRecordId
                50_000L, 5_000L, 45_000L, 0L, 0L, 0L,              // amounts
                null, null, null, null, null,                       // dimensions
                "Event with no posting rule",                        // description
                Map.of()                                            // extras
        );

        // When/Then: should throw PostingException
        assertThatThrownBy(() -> postingService.post(event))
                .isInstanceOf(PostingException.class)
                .hasMessageContaining("No active posting rule for UNKNOWN_MODULE / UNKNOWN_EVENT");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test: Successful posting creates balanced entry
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void post_restaurantOrderPaid_shouldCreateBalancedEntry() {
        // Given: ORDER_PAID event (uses seeded posting rule from V67 migration)
        // Note: The seeded rule is agent-treatment (commission only), not principal.
        // After V68 migration applies, this test will use the new principal-treatment rule.
        AccountingEvent event = new AccountingEvent(
                "evt-integration-99999",                             // eventId
                "ORDER_PAID",                                        // eventType
                "RESTAURANTS",                                       // sourceModule
                "ord-integration-99999",                             // sourceRecordId
                100_000L,                                            // grossAmountUgx
                15_000L,                                             // platformCommissionUgx
                85_000L,                                             // payeeAmountUgx
                0L, 0L, 0L,                                         // psp/late/deposit fees
                "merch-integration-001",                             // merchantId
                null, null, null,                                    // property/tenant/event
                "MOBILE_MONEY",                                      // paymentMethod
                "Integration test restaurant order",                 // description
                Map.of("order_total_ugx", 100_000L,                 // extras (for V68+ rules)
                       "merchant_net_ugx", 85_000L)
        );

        // When
        postingService.post(event);

        // Then: entry created with POSTED status
        Optional<JournalEntry> result = entryRepo.findBySourceModuleAndSourceEventId("RESTAURANTS", "evt-integration-99999");
        assertThat(result).isPresent();
        
        JournalEntry entry = result.get();
        assertThat(entry.getStatus()).isEqualTo("POSTED");
        assertThat(entry.getSourceEventType()).isEqualTo("ORDER_PAID");
        assertThat(entry.getDimMerchantId()).isEqualTo("merch-integration-001");
        assertThat(entry.getEntryHash()).isNotNull();
        assertThat(entry.getEntryHash()).isNotEqualTo("PENDING"); // hash computed
        
        // Verify DB balance check passed (if it failed, transaction would have rolled back)
        assertThat(entry.getId()).isNotNull(); // successfully persisted
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test: Hash chain integrity
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void post_secondEntry_shouldLinkToPreviousHash() {
        // Given: first entry
        AccountingEvent first = new AccountingEvent(
                "evt-chain-001", "ORDER_PAID", "RESTAURANTS", "ord-001",
                100_000L, 15_000L, 85_000L, 0L, 0L, 0L,
                "merch-001", null, null, null, "MOBILE_MONEY",
                "First entry in chain", Map.of()
        );
        postingService.post(first);
        
        JournalEntry firstEntry = entryRepo.findBySourceModuleAndSourceEventId("RESTAURANTS", "evt-chain-001")
                .orElseThrow();

        // When: second entry posted
        AccountingEvent second = new AccountingEvent(
                "evt-chain-002", "ORDER_PAID", "RESTAURANTS", "ord-002",
                200_000L, 30_000L, 170_000L, 0L, 0L, 0L,
                "merch-002", null, null, null, "MOBILE_MONEY",
                "Second entry in chain", Map.of()
        );
        postingService.post(second);

        // Then: second entry should link to first entry's hash
        JournalEntry secondEntry = entryRepo.findBySourceModuleAndSourceEventId("RESTAURANTS", "evt-chain-002")
                .orElseThrow();
        
        assertThat(secondEntry.getPrevEntryHash()).isNotNull();
        assertThat(secondEntry.getPrevEntryHash()).isEqualTo(firstEntry.getEntryHash());
        assertThat(secondEntry.getEntryHash()).isNotEqualTo(firstEntry.getEntryHash()); // different hashes
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test: Balance validation (V68 regression test)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void post_restaurantOrderWithV68Rule_shouldBeBalanced() {
        // Given: ORDER_PAID event with V68 principal treatment amounts
        // This test verifies the V68 migration produces balanced entries
        AccountingEvent event = new AccountingEvent(
                "evt-balance-test",                                  // eventId
                "ORDER_PAID",                                        // eventType
                "RESTAURANTS",                                       // sourceModule
                "ord-balance-test",                                  // sourceRecordId
                100_000L,                                            // order_total_ugx (gross)
                15_000L,                                             // platform_commission_ugx
                85_000L,                                             // merchant_net_ugx
                0L, 0L, 0L,                                         // psp/late/deposit
                "merch-balance-test",                                // merchantId
                null, null, null, "MOBILE_MONEY",                   // dimensions
                "Balance verification test",                         // description
                Map.of("order_total_ugx", 100_000L,                 // extras
                       "merchant_net_ugx", 85_000L)
        );

        // When: post event (should not throw)
        postingService.post(event);

        // Then: entry created successfully (balance check passed)
        Optional<JournalEntry> result = entryRepo.findBySourceModuleAndSourceEventId("RESTAURANTS", "evt-balance-test");
        assertThat(result).isPresent();
        
        JournalEntry entry = result.get();
        assertThat(entry.getStatus()).isEqualTo("POSTED");
        
        // Verify debits = credits (application-level check)
        List<com.scanny.accounting.entity.JournalLine> lines = 
            lineRepo.findByEntryIdOrderById(entry.getId());
        
        long totalDebits = lines.stream()
            .filter(l -> "DEBIT".equals(l.getSide()))
            .mapToLong(com.scanny.accounting.entity.JournalLine::getAmount)
            .sum();
        
        long totalCredits = lines.stream()
            .filter(l -> "CREDIT".equals(l.getSide()))
            .mapToLong(com.scanny.accounting.entity.JournalLine::getAmount)
            .sum();
        
        assertThat(totalDebits).isEqualTo(totalCredits)
            .withFailMessage("V68 posting rule must be balanced: DR=%d CR=%d", totalDebits, totalCredits);
    }
}
