package com.scanny.repository;

import com.scanny.entity.PropertyViewPayment;
import com.scanny.model.enums.RentPaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PropertyViewPaymentRepository extends JpaRepository<PropertyViewPayment, Long> {

    /**
     * Find a property view payment by transaction reference.
     */
    Optional<PropertyViewPayment> findByTransactionRef(String transactionRef);

    /**
     * Check if a viewer has already paid to view this property.
     * Used to prevent duplicate charges and allow re-access.
     */
    Optional<PropertyViewPayment> findByProperty_IdAndViewerPhoneAndStatus(
            String propertyId,
            String viewerPhone,
            RentPaymentStatus status
    );
}
