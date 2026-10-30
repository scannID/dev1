package com.scanny.repository.projection;

/**
 * Scalar projection for the per-property occupancy count query.
 * Returns [propertyId, occupiedCount] without loading unit or tenant entities.
 */
public interface PropertyOccupancyProjection {
    String getPropertyId();
    long getOccupiedCount();
}
