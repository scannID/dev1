package com.scanny.service;

import com.scanny.dto.DeviceBindingDtos;
import com.scanny.entity.QrDeviceBinding;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentTenant;
import com.scanny.entity.RentUnit;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.BindingStatus;
import com.scanny.model.enums.TokenType;
import com.scanny.repository.QrDeviceBindingRepository;
import com.scanny.repository.RentPropertyRepository;
import com.scanny.repository.RentTenantRepository;
import com.scanny.repository.RentUnitRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

/**
 * Service for managing QR device bindings.
 * 
 * <p>Security Model:
 * <ul>
 *   <li>One device per QR token</li>
 *   <li>Phone verification required on first scan</li>
 *   <li>Admin revocation for device changes</li>
 *   <li>Auto-expiry on lease end</li>
 * </ul>
 */
@Service
public class QrDeviceBindingService {

    private static final Logger log = LoggerFactory.getLogger(QrDeviceBindingService.class);

    private final QrDeviceBindingRepository bindingRepository;
    private final RentUnitRepository unitRepository;
    private final RentTenantRepository tenantRepository;
    private final RentPropertyRepository propertyRepository;
    private final QrAuditService auditService;

    public QrDeviceBindingService(
            QrDeviceBindingRepository bindingRepository,
            RentUnitRepository unitRepository,
            RentTenantRepository tenantRepository,
            RentPropertyRepository propertyRepository,
            QrAuditService auditService) {
        this.bindingRepository = bindingRepository;
        this.unitRepository = unitRepository;
        this.tenantRepository = tenantRepository;
        this.propertyRepository = propertyRepository;
        this.auditService = auditService;
    }

    /**
     * Check if a device can access a QR token.
     * 
     * @param qrToken The QR token being scanned
     * @param deviceId The device identifier
     * @param request HTTP request for audit logging
     * @return Access decision with context
     */
    @Transactional
    public DeviceBindingDtos.AccessCheckResult checkDeviceAccess(
            String qrToken, 
            String deviceId, 
            HttpServletRequest request) {

        log.debug("Checking device access: token={}, device={}", qrToken, deviceId);

        // Find active binding for this token
        Optional<QrDeviceBinding> bindingOpt = bindingRepository
            .findByQrTokenAndStatus(qrToken, BindingStatus.ACTIVE);

        // No binding exists → first scan
        if (bindingOpt.isEmpty()) {
            log.info("No binding exists for token={}, allowing first scan", qrToken);
            auditService.logSuccess(qrToken, "RENT_PAY", "FIRST_SCAN", request, null);
            return DeviceBindingDtos.AccessCheckResult.firstScan();
        }

        QrDeviceBinding binding = bindingOpt.get();

        // Check if expired
        if (binding.getExpiresAt() != null && Instant.now().isAfter(binding.getExpiresAt())) {
            log.info("Binding expired for token={}, auto-expiring", qrToken);
            expireBinding(binding);
            auditService.logExpired(qrToken, "RENT_PAY", request);
            return DeviceBindingDtos.AccessCheckResult.firstScan(); // Allow rebind
        }

        // Check device match
        if (binding.getDeviceId().equals(deviceId)) {
            // SAME DEVICE → ALLOWED
            log.debug("Device matches binding for token={}, allowing access", qrToken);
            binding.incrementUseCount();
            bindingRepository.save(binding);
            auditService.logSuccess(qrToken, "RENT_PAY", "ACCESS", request, binding.getUnitId());
            return DeviceBindingDtos.AccessCheckResult.allowed(binding);
        }

        // DIFFERENT DEVICE → DENIED
        log.warn("Device mismatch for token={}, denying access. Expected={}, Got={}", 
            qrToken, binding.getDeviceId(), deviceId);
        
        // Get property manager contact info
        DeviceBindingDtos.PropertyManagerContact contact = getPropertyManagerContact(binding.getPropertyId());
        
        auditService.logDenied(qrToken, "RENT_PAY", "ACCESS", request, 
            "Device mismatch - bound to " + binding.getDeviceId());
        
        return DeviceBindingDtos.AccessCheckResult.deviceMismatch(binding, contact);
    }

    /**
     * Create a new device binding after phone verification.
     * 
     * @param qrToken QR token being bound
     * @param deviceId Device identifier
     * @param phoneNumber Tenant's phone number (must match unit tenant)
     * @param deviceFingerprint Optional JSON with device details
     * @param request HTTP request for IP and User-Agent
     * @return Created binding
     */
    @Transactional
    public QrDeviceBinding createBinding(
            String qrToken,
            String deviceId,
            String phoneNumber,
            String deviceFingerprint,
            HttpServletRequest request) {

        log.info("Creating device binding: token={}, device={}, phone={}", qrToken, deviceId, phoneNumber);

        // 1. Check for race condition - another request might have created binding
        if (bindingRepository.existsByQrTokenAndStatus(qrToken, BindingStatus.ACTIVE)) {
            throw new ApiException(409, "Device binding already exists for this QR code");
        }

        // 2. Find unit from QR token
        RentUnit unit = unitRepository.findByQrToken(qrToken)
            .orElseThrow(() -> new ApiException(404, "Invalid QR code"));

        // 3. Verify phone matches active tenant
        RentTenant tenant = unit.getActiveTenant();
        if (tenant == null) {
            throw new ApiException(400, "No active tenant for this unit");
        }

        String normalizedInput = normalizePhone(phoneNumber);
        String normalizedTenant = normalizePhone(tenant.getPhone());
        
        if (!normalizedInput.equals(normalizedTenant)) {
            log.warn("Phone number mismatch: expected={}, got={}", normalizedTenant, normalizedInput);
            auditService.logDenied(qrToken, "RENT_PAY", "BIND", request, 
                "Phone number does not match tenant");
            throw new ApiException(403, 
                "Phone number does not match the tenant registered for this unit");
        }

        // 4. Create binding
        QrDeviceBinding binding = new QrDeviceBinding();
        binding.setQrToken(qrToken);
        binding.setTokenType(TokenType.UNIT);
        binding.setDeviceId(deviceId);
        binding.setDeviceFingerprint(deviceFingerprint);
        binding.setPhoneNumber(phoneNumber);
        binding.setTenantId(tenant.getId());
        binding.setUnitId(unit.getId());
        binding.setPropertyId(unit.getProperty().getId());
        binding.setBoundAt(Instant.now());
        binding.setStatus(BindingStatus.ACTIVE);
        binding.setCreatedIp(extractIp(request));
        binding.setCreatedUserAgent(extractUserAgent(request));

        // 5. Set expiry to lease end + 7 day grace period
        if (tenant.getLeaseEnd() != null) {
            LocalDate expiryDate = tenant.getLeaseEnd().plusDays(7);
            binding.setExpiresAt(
                expiryDate.atStartOfDay(ZoneId.systemDefault()).toInstant()
            );
            log.debug("Binding will expire on {}", expiryDate);
        }

        QrDeviceBinding saved = bindingRepository.save(binding);

        // 6. Audit log
        auditService.logSuccess(qrToken, "RENT_PAY", "BIND", request, unit.getId());

        log.info("Device binding created: id={}, token={}, device={}, unit={}, tenant={}", 
            saved.getId(), qrToken, deviceId, unit.getId(), tenant.getId());

        return saved;
    }

    /**
     * Admin revokes a device binding.
     * Tenant must scan QR again to rebind with new/same device.
     * 
     * @param bindingId ID of binding to revoke
     * @param adminId ID of admin performing the action
     * @param reason Why the binding is being revoked
     */
    @Transactional
    public void revokeBinding(Long bindingId, String adminId, String reason) {
        log.info("Revoking device binding: id={}, admin={}, reason={}", bindingId, adminId, reason);

        QrDeviceBinding binding = bindingRepository.findById(bindingId)
            .orElseThrow(() -> new ApiException(404, "Binding not found"));

        if (binding.getStatus() != BindingStatus.ACTIVE) {
            throw new ApiException(400, "Binding is not active (current status: " + binding.getStatus() + ")");
        }

        // Revoke it
        binding.setStatus(BindingStatus.REVOKED);
        binding.setRevokedAt(Instant.now());
        binding.setRevokedBy(adminId);
        binding.setRevokedReason(reason);

        bindingRepository.save(binding);

        log.info("Device binding revoked: id={}, unit={}, tenant={}, admin={}, reason={}", 
            bindingId, binding.getUnitId(), binding.getTenantId(), adminId, reason);
    }

    /**
     * Get all bindings for a property (admin dashboard).
     * 
     * @param propertyId Property ID
     * @return List of binding info DTOs
     */
    @Transactional(readOnly = true)
    public List<DeviceBindingDtos.DeviceBindingInfo> getPropertyBindings(String propertyId) {
        List<QrDeviceBinding> bindings = bindingRepository.findByPropertyIdOrderByBoundAtDesc(propertyId);
        
        return bindings.stream().map(binding -> {
            // Fetch tenant and unit names for display
            RentUnit unit = unitRepository.findById(binding.getUnitId()).orElse(null);
            RentTenant tenant = tenantRepository.findById(binding.getTenantId()).orElse(null);
            
            String unitNumber = unit != null ? unit.getUnitNumber() : "Unknown";
            String tenantName = tenant != null ? tenant.getName() : "Unknown";
            
            return DeviceBindingDtos.DeviceBindingInfo.from(binding, tenantName, unitNumber);
        }).toList();
    }

    /**
     * Get binding statistics for a property.
     * 
     * @param propertyId Property ID
     * @return Statistics summary
     */
    @Transactional(readOnly = true)
    public DeviceBindingDtos.PropertyBindingStats getPropertyStats(String propertyId) {
        java.util.Map<String, Object> stats = bindingRepository.getPropertyStatistics(propertyId);
        
        Instant weekAgo = Instant.now().minus(7, ChronoUnit.DAYS);
        List<QrDeviceBinding> recentRevocations = bindingRepository.findRecentRevocations(propertyId, weekAgo);
        
        long activeCount = bindingRepository.countByPropertyIdAndStatus(propertyId, BindingStatus.ACTIVE);
        
        return new DeviceBindingDtos.PropertyBindingStats(
            (int) activeCount,
            ((Number) stats.getOrDefault("revoked", 0)).intValue(),
            ((Number) stats.getOrDefault("expired", 0)).intValue(),
            recentRevocations.size(),
            ((Number) stats.getOrDefault("avgUseCount", 0.0)).doubleValue(),
            (int) bindingRepository.findByPropertyIdAndStatusOrderByBoundAtDesc(propertyId, BindingStatus.ACTIVE)
                .stream()
                .map(QrDeviceBinding::getUnitId)
                .distinct()
                .count()
        );
    }

    /**
     * Scheduled job: Auto-expire bindings past their expiry date.
     * Runs daily at 2 AM.
     */
    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void expireOldBindings() {
        log.info("Running scheduled expiry of old device bindings");
        
        List<QrDeviceBinding> expired = bindingRepository
            .findExpiredBindings(BindingStatus.ACTIVE, Instant.now());

        for (QrDeviceBinding binding : expired) {
            expireBinding(binding);
        }

        if (!expired.isEmpty()) {
            bindingRepository.saveAll(expired);
            log.info("Expired {} old device bindings", expired.size());
        } else {
            log.debug("No bindings to expire");
        }
    }

    /**
     * Cleanup old revoked/expired bindings (keep for audit, but delete after 1 year).
     * Runs monthly.
     */
    @Scheduled(cron = "0 0 3 1 * *") // 3 AM on 1st of each month
    @Transactional
    public void cleanupOldBindings() {
        Instant cutoff = Instant.now().minus(365, ChronoUnit.DAYS);
        int deleted = bindingRepository.deleteOldBindings(cutoff);
        log.info("Cleaned up {} old device bindings (>1 year)", deleted);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Private helper methods
    // ────────────────────────────────────────────────────────────────────────────

    private void expireBinding(QrDeviceBinding binding) {
        binding.setStatus(BindingStatus.EXPIRED);
        binding.setRevokedAt(Instant.now());
        binding.setRevokedBy("SYSTEM");
        binding.setRevokedReason("Binding expired (lease ended)");
    }

    private DeviceBindingDtos.PropertyManagerContact getPropertyManagerContact(String propertyId) {
        RentProperty property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null) {
            return new DeviceBindingDtos.PropertyManagerContact(
                "Property Manager",
                "N/A",
                null,
                "Your Property"
            );
        }

        return new DeviceBindingDtos.PropertyManagerContact(
            property.getOwnerName(),
            property.getOwnerMomo(),
            property.getOwnerMomo(), // Could add separate WhatsApp field
            property.getName()
        );
    }

    private String normalizePhone(String phone) {
        if (phone == null) return "";
        // Remove all non-digit characters except +
        return phone.replaceAll("[^0-9+]", "");
    }

    private String extractIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip != null ? ip : "unknown";
    }

    private String extractUserAgent(HttpServletRequest request) {
        String ua = request.getHeader("User-Agent");
        if (ua == null || ua.isBlank()) {
            return "unknown";
        }
        return ua.length() > 512 ? ua.substring(0, 512) : ua;
    }
}
