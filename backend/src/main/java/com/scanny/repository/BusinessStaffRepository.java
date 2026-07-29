package com.scanny.repository;

import com.scanny.entity.BusinessStaff;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusinessStaffRepository extends JpaRepository<BusinessStaff, UUID> {

    List<BusinessStaff> findByBusinessIdOrderByDisplayNameAsc(String businessId);

    Optional<BusinessStaff> findByBusinessIdAndEmailIgnoreCase(String businessId, String email);

    @EntityGraph(attributePaths = "business")
    Optional<BusinessStaff> findBySessionTokenAndSessionExpiresAtAfter(String sessionToken, java.time.Instant now);

    @EntityGraph(attributePaths = "business")
    List<BusinessStaff> findByKeycloakUserIdAndActiveTrue(UUID keycloakUserId);

    @EntityGraph(attributePaths = "business")
    Optional<BusinessStaff> findByKeycloakUserIdAndBusinessIdAndActiveTrue(UUID keycloakUserId, String businessId);

    @EntityGraph(attributePaths = "business")
    List<BusinessStaff> findByEmailIgnoreCaseAndActiveTrue(String email);
}
