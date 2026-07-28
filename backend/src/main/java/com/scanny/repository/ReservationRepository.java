package com.scanny.repository;

import com.scanny.entity.Reservation;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReservationRepository extends JpaRepository<Reservation, UUID> {

    List<Reservation> findByBusinessIdAndReservedAtAfterOrderByReservedAtAsc(String businessId, Instant after);
}
