package com.scanny.repository;

import com.scanny.entity.RentNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RentNotificationRepository extends JpaRepository<RentNotification, String> {

    /** Check whether a notification of this type was already created for this charge. */
    boolean existsByCharge_IdAndEventType(Long chargeId, String eventType);

    /** All unsent notifications — useful for a future delivery worker. */
    @Query("SELECT n FROM RentNotification n WHERE n.sentAt IS NULL ORDER BY n.createdAt ASC")
    List<RentNotification> findUnsent();

    /** All notifications for a specific charge, newest first. */
    List<RentNotification> findByCharge_IdOrderByCreatedAtDesc(Long chargeId);
}
