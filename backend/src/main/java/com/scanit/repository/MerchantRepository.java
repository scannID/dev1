package com.scanit.repository;

import com.scanit.entity.Merchant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MerchantRepository extends JpaRepository<Merchant, UUID> {

    // Find by email
    Optional<Merchant> findByEmail(String email);

    // Find by Keycloak user ID
    Optional<Merchant> findByKeycloakUserId(UUID keycloakUserId);

    // Find by QR code token
    Optional<Merchant> findByQrCodeToken(String qrCodeToken);

    // Find by referral code
    Optional<Merchant> findByReferralCode(String referralCode);

    // Check if email exists
    boolean existsByEmail(String email);

    // Check if Keycloak user exists
    boolean existsByKeycloakUserId(UUID keycloakUserId);

    // Find merchants by status
    List<Merchant> findByStatusOrderByCreatedAtDesc(Merchant.MerchantStatus status);

    // Find merchants by business type
    List<Merchant> findByBusinessTypeOrderByCreatedAtDesc(Merchant.BusinessType businessType);

    // Find merchants by plan
    List<Merchant> findByPlanOrderByCreatedAtDesc(Merchant.SubscriptionPlan plan);

    // Find merchants with incomplete onboarding
    List<Merchant> findByOnboardingCompletedFalseOrderByCreatedAtDesc();

    // Find merchants created after a date
    List<Merchant> findByCreatedAtAfterOrderByCreatedAtDesc(LocalDateTime createdAt);

    // Find active merchants
    @Query("SELECT m FROM Merchant m WHERE m.status = 'ACTIVE' ORDER BY m.createdAt DESC")
    List<Merchant> findActiveMerchants();

    // Find merchants with expired plans
    @Query("SELECT m FROM Merchant m WHERE m.planExpiresAt < :now AND m.status = 'ACTIVE'")
    List<Merchant> findMerchantsWithExpiredPlans(@Param("now") LocalDateTime now);

    // Find merchants without QR codes
    @Query("SELECT m FROM Merchant m WHERE m.qrCodeToken IS NULL")
    List<Merchant> findMerchantsWithoutQrCodes();

    // Count merchants by status
    Long countByStatus(Merchant.MerchantStatus status);

    // Count merchants by plan
    Long countByPlan(Merchant.SubscriptionPlan plan);

    // Count merchants created today
    @Query("SELECT COUNT(m) FROM Merchant m WHERE m.createdAt >= :startOfDay")
    Long countMerchantsCreatedToday(@Param("startOfDay") LocalDateTime startOfDay);

    // Find merchants referred by a code
    List<Merchant> findByReferredByOrderByCreatedAtDesc(String referredBy);

    // Search merchants by business name
    @Query("SELECT m FROM Merchant m WHERE LOWER(m.businessName) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    List<Merchant> searchByBusinessName(@Param("searchTerm") String searchTerm);

    // Find merchants with recent logins
    @Query("SELECT m FROM Merchant m WHERE m.lastLoginAt >= :since ORDER BY m.lastLoginAt DESC")
    List<Merchant> findMerchantsWithRecentLogins(@Param("since") LocalDateTime since);
}
