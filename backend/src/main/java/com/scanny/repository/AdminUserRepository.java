package com.scanny.repository;

import com.scanny.entity.AdminUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AdminUserRepository extends JpaRepository<AdminUser, UUID> {

    Optional<AdminUser> findByKeycloakUserId(UUID keycloakUserId);

    Optional<AdminUser> findByEmail(String email);

    List<AdminUser> findAllByOrderByCreatedAtDesc();

    boolean existsByEmail(String email);

    boolean existsByKeycloakUserId(UUID keycloakUserId);
}
