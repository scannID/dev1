package com.scanny.repository;

import com.scanny.entity.CustomerPhoneSession;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerPhoneSessionRepository extends JpaRepository<CustomerPhoneSession, String> {

    Optional<CustomerPhoneSession> findBySessionTokenAndSessionExpiresAtAfter(String sessionToken, java.time.Instant now);
}
