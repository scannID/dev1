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
        log.info("Ensured catalog_items.discount_percent exists (H2)");
    }
}
