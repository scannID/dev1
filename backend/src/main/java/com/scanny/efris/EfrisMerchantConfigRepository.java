package com.scanny.efris;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EfrisMerchantConfigRepository extends JpaRepository<EfrisMerchantConfig, String> {

    /** Lookup by merchantId — used before every submission to check opt-in status. */
    Optional<EfrisMerchantConfig> findByMerchantIdAndEnabledTrue(String merchantId);
}
