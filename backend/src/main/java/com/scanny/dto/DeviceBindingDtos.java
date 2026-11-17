package com.scanny.dto;

import com.scanny.entity.QrDeviceBinding;
import com.scanny.model.enums.BindingStatus;
import java.time.Instant;

/**
 * DTOs for device binding API responses
 */
public class DeviceBindingDtos {

    /**
     * Result of checking device access to a QR token
     */
    public record AccessCheckResult(
        AccessDecision decision,
        String message,
        QrDeviceBinding binding,
        PropertyManagerContact propertyManager
    ) {
        public static AccessCheckResult allowed(QrDeviceBinding binding) {
            return new AccessCheckResult(
                AccessDecision.ALLOWED,
                "Device is bound to this QR code",
                binding,
                null
            );
        }

        public static AccessCheckResult firstScan() {
            return new AccessCheckResult(
                AccessDecision.FIRST_SCAN,
                "No device binding exists. Please verify your phone number.",
                null,
                null
            );
        }

        public static AccessCheckResult deviceMismatch(QrDeviceBinding existingBinding, 
                                                        PropertyManagerContact contact) {
            return new AccessCheckResult(
                AccessDecision.DEVICE_MISMATCH,
                "This payment link is already bound to another device. Contact your property manager to reset access.",
                existingBinding,
                contact
            );
        }
    }

    public enum AccessDecision {
        ALLOWED,         // Device matches, allow access
        FIRST_SCAN,      // No binding exists, need phone verification
        DEVICE_MISMATCH  // Different device, deny access
    }

    /**
     * Property manager contact information shown when device mismatch occurs
     */
    public record PropertyManagerContact(
        String name,
        String phone,
        String whatsapp,
        String propertyName
    ) {}

    /**
     * Device binding information for admin dashboard
     */
    public record DeviceBindingInfo(
        Long id,
        String qrToken,
        String deviceId,
        String deviceName, // Friendly name from fingerprint
        String phoneNumber,
        String tenantName,
        String unitNumber,
        BindingStatus status,
        Instant boundAt,
        Instant lastUsedAt,
        Integer useCount,
        Instant expiresAt,
        String revokedReason
    ) {
        public static DeviceBindingInfo from(QrDeviceBinding binding, String tenantName, String unitNumber) {
            return new DeviceBindingInfo(
                binding.getId(),
                binding.getQrToken(),
                binding.getDeviceId(),
                extractDeviceName(binding.getDeviceFingerprint()),
                binding.getPhoneNumber(),
                tenantName,
                unitNumber,
                binding.getStatus(),
                binding.getBoundAt(),
                binding.getLastUsedAt(),
                binding.getUseCount(),
                binding.getExpiresAt(),
                binding.getRevokedReason()
            );
        }

        private static String extractDeviceName(String fingerprint) {
            if (fingerprint == null) return "Unknown Device";
            // Parse JSON and extract meaningful device name
            // {"type":"mobile","os":"Android 13","browser":"Chrome 120","model":"Samsung Galaxy A53"}
            // → "Samsung Galaxy A53 (Android 13)"
            try {
                // Simple extraction - can be improved with JSON parsing
                if (fingerprint.contains("\"model\":")) {
                    String model = fingerprint.split("\"model\":\"")[1].split("\"")[0];
                    String os = fingerprint.contains("\"os\":") ? 
                        fingerprint.split("\"os\":\"")[1].split("\"")[0] : "";
                    return os.isEmpty() ? model : model + " (" + os + ")";
                }
                return "Unknown Device";
            } catch (Exception e) {
                return "Unknown Device";
            }
        }
    }

    /**
     * Request to create first device binding
     */
    public record CreateBindingRequest(
        String phoneNumber,
        String deviceFingerprint
    ) {}

    /**
     * Response after creating binding
     */
    public record BindingCreatedResponse(
        Long bindingId,
        String message,
        Instant boundAt,
        Instant expiresAt
    ) {}

    /**
     * Request to revoke a device binding (admin action)
     */
    public record RevokeBindingRequest(
        String reason
    ) {}

    /**
     * Statistics for property dashboard
     */
    public record PropertyBindingStats(
        int activeBindings,
        int revokedBindings,
        int expiredBindings,
        int recentRevocations,
        double avgScansPerDevice,
        int unitsWithBindings
    ) {}
}
