package com.scanny.repository.projection;

import com.scanny.model.enums.PropertyAccessRole;

/**
 * Scalar projection for the portfolio listing query.
 * Returns per-property summary data in a single JOIN query — no lazy loading.
 */
public interface PortfolioSummaryProjection {
    String getPropertyId();
    String getPropertyName();
    String getCity();
    String getCurrency();
    PropertyAccessRole getRole();
    long getTotalUnits();
}
