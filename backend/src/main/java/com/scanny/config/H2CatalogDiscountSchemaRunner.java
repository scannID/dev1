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
        log.info("Ensured catalog discount + fee-split columns exist (H2)");
    }

    private void ensureColumn(String table, String column, String definition) {
        jdbcTemplate.execute("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS " + column + " " + definition);
    }
}
