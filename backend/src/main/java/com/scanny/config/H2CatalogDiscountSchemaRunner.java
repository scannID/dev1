package com.scanny.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * H2 file DBs skip Flyway; Hibernate update can miss new columns on existing files.
 * Ensure catalog discount column exists before the app serves traffic.
 */
@Component
@Profile("h2")
@Order(-10)
public class H2CatalogDiscountSchemaRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(H2CatalogDiscountSchemaRunner.class);

    private final JdbcTemplate jdbcTemplate;

    public H2CatalogDiscountSchemaRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.execute(
            "ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS discount_percent INT NOT NULL DEFAULT 0"
        );
        ensureColumn("orders", "subtotal", "INT NOT NULL DEFAULT 0");
        ensureColumn("orders", "service_fee", "INT NOT NULL DEFAULT 0");
        ensureColumn("orders", "pso_fee", "INT NOT NULL DEFAULT 0");
        ensureColumn("orders", "platform_fee", "INT NOT NULL DEFAULT 0");
        ensureColumn("orders", "merchant_payout", "INT NOT NULL DEFAULT 0");
        ensureColumn("orders", "merchant_momo_destination", "VARCHAR(64) NOT NULL DEFAULT ''");
        ensureColumn("payment_intents", "subtotal", "INT NOT NULL DEFAULT 0");
        ensureColumn("payment_intents", "service_fee", "INT NOT NULL DEFAULT 0");
        ensureColumn("payment_intents", "pso_fee", "INT NOT NULL DEFAULT 0");
        ensureColumn("payment_intents", "platform_fee", "INT NOT NULL DEFAULT 0");
        ensureColumn("payment_intents", "merchant_payout", "INT NOT NULL DEFAULT 0");
        ensureColumn("payment_intents", "merchant_momo_destination", "VARCHAR(64) NOT NULL DEFAULT ''");
        ensureColumn("payment_intents", "scanny_fee_destination", "VARCHAR(64) NOT NULL DEFAULT ''");

        // New columns added to existing entities — must be pre-created with defaults so
        // Hibernate's UPDATE DDL (which can't add NOT NULL columns to populated tables) is a no-op.
        ensureColumn("businesses", "geo_query", "VARCHAR(255) NOT NULL DEFAULT ''");
        ensureColumn("admin_users", "pending", "BOOLEAN NOT NULL DEFAULT TRUE");

        // ── Rent model extensions (V59) ───────────────────────────────────────
        // Flyway is disabled on H2; manually ensure new rent columns exist.
        ensureColumn("rent_units",      "due_day_of_month",       "SMALLINT NOT NULL DEFAULT 5");
        ensureColumn("rent_units",      "grace_period_days",      "SMALLINT NOT NULL DEFAULT 0");
        ensureColumn("rent_properties", "timezone",               "VARCHAR(64) NOT NULL DEFAULT 'Africa/Kampala'");
        ensureColumn("rent_properties", "partial_payment_allowed","BOOLEAN NOT NULL DEFAULT TRUE");
        ensureColumn("rent_properties", "min_payment_amount",     "INTEGER NOT NULL DEFAULT 0");
        ensureColumn("rent_tenants",    "lease_end",              "DATE");

        // ── Fix BusinessType enum casing ──────────────────────────────────────
        // Old H2 data has PascalCase values (e.g. 'Hotel', 'Restaurant').
        // The enum now uses UPPER_CASE. Normalise once so findAll() doesn't crash.
        jdbcTemplate.execute("UPDATE businesses SET type = UPPER(type) WHERE type != UPPER(type)");
        jdbcTemplate.execute("UPDATE merchants SET business_type = UPPER(business_type) WHERE business_type IS NOT NULL AND business_type != UPPER(business_type)");

        log.info("Ensured catalog discount + fee-split columns exist (H2)");
    }

    private void ensureColumn(String table, String column, String definition) {
        jdbcTemplate.execute("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS " + column + " " + definition);
    }
}
