package com.scanny.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.jdbc.init.DataSourceScriptDatabaseInitializer;
import org.springframework.boot.sql.init.DatabaseInitializationMode;
import org.springframework.boot.sql.init.DatabaseInitializationSettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.util.Collections;

/**
 * Ensures the accounting schema exists BEFORE Hibernate EntityManagerFactory initializes.
 * 
 * Uses DataSourceScriptDatabaseInitializer which runs before JPA initialization.
 * 
 * Only active on the H2 profile where Flyway migrations don't run.
 */
@Configuration
@Profile("h2")
public class AccountingSchemaConfig {

    private static final Logger log = LoggerFactory.getLogger(AccountingSchemaConfig.class);

    static {
        System.out.println("========== [AccountingSchemaConfig] CLASS LOADED ==========");
        log.info("[AccountingSchemaConfig] CLASS LOADED");
    }

    public AccountingSchemaConfig() {
        System.out.println("========== [AccountingSchemaConfig] CONSTRUCTOR CALLED ==========");
        log.info("[AccountingSchemaConfig] Constructor called");
    }

    @Bean
    @Order(Integer.MIN_VALUE) // Run as early as possible
    public DataSourceScriptDatabaseInitializer accountingSchemaInitializer(DataSource dataSource) {
        System.out.println("========== [AccountingSchemaConfig] BEAN METHOD CALLED ==========");
        log.info("[AccountingSchemaConfig] Creating schema initializer bean");
        
        // Create schema before returning the initializer
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE SCHEMA IF NOT EXISTS accounting");
            System.out.println("========== [AccountingSchemaConfig] SCHEMA CREATED ==========");
            log.info("[AccountingSchemaConfig] ✓ Created accounting schema BEFORE Hibernate");
        } catch (Exception e) {
            System.err.println("========== [AccountingSchemaConfig] SCHEMA CREATION FAILED: " + e.getMessage() + " ==========");
            log.error("[AccountingSchemaConfig] ✗ Failed to create schema: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to create accounting schema", e);
        }
        
        // Return a dummy initializer that does nothing (schema already created above)
        DatabaseInitializationSettings settings = new DatabaseInitializationSettings();
        settings.setMode(DatabaseInitializationMode.NEVER);
        settings.setSchemaLocations(Collections.emptyList());
        return new DataSourceScriptDatabaseInitializer(dataSource, settings);
    }
}
