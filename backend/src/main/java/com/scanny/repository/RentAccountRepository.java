package com.scanny.repository;

import com.scanny.entity.RentAccount;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RentAccountRepository extends JpaRepository<RentAccount, String> {

    Optional<RentAccount> findByAccessKey(String accessKey);

    Optional<RentAccount> findByEmail(String email);

    Optional<RentAccount> findByKeycloakUserId(UUID keycloakUserId);

    boolean existsByEmail(String email);

    boolean existsByAccessKey(String accessKey);
}
