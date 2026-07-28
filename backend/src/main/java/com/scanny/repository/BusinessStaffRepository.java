package com.scanny.repository;

import com.scanny.entity.BusinessStaff;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusinessStaffRepository extends JpaRepository<BusinessStaff, UUID> {

    List<BusinessStaff> findByBusinessIdOrderByDisplayNameAsc(String businessId);

    Optional<BusinessStaff> findByBusinessIdAndEmailIgnoreCase(String businessId, String email);

    Optional<BusinessStaff> findBySessionTokenAndSessionExpiresAtAfter(String sessionToken, java.time.Instant now);
}
