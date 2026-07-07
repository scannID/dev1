package com.scanit.service;

import com.scanit.dto.DeviceRegistrationDtos;
import com.scanit.entity.DevicePaymentMethod;
import com.scanit.entity.DeviceTransaction;
import com.scanit.entity.RegisteredDevice;
import com.scanit.model.enums.DeviceStatus;
import com.scanit.model.enums.TransactionStatus;
import com.scanit.repository.DevicePaymentMethodRepository;
import com.scanit.repository.DeviceTransactionRepository;
import com.scanit.repository.RegisteredDeviceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DeviceRegistrationService {

    private final RegisteredDeviceRepository deviceRepository;
    private final DevicePaymentMethodRepository paymentMethodRepository;
    private final DeviceTransactionRepository transactionRepository;

    public DeviceRegistrationService(
            RegisteredDeviceRepository deviceRepository,
            DevicePaymentMethodRepository paymentMethodRepository,
            DeviceTransactionRepository transactionRepository) {
        this.deviceRepository = deviceRepository;
        this.paymentMethodRepository = paymentMethodRepository;
        this.transactionRepository = transactionRepository;
    }

    @Transactional
    public DeviceRegistrationDtos.RegisteredDeviceResponse registerDevice(
            DeviceRegistrationDtos.RegisterDeviceRequest request) {
        
        // Check if device already exists
        if (deviceRepository.existsByDeviceId(request.deviceId())) {
            throw new RuntimeException("Device already registered: " + request.deviceId());
        }

        RegisteredDevice device = new RegisteredDevice();
        device.setId(generateDeviceRecordId());
        device.setDeviceId(request.deviceId());
        device.setDeviceName(request.deviceName() != null ? request.deviceName() : "");
        device.setDeviceModel(request.deviceModel() != null ? request.deviceModel() : "");
        device.setDeviceOs(request.deviceOs() != null ? request.deviceOs() : "");
        device.setDeviceFingerprint(request.deviceFingerprint());
        device.setPrimaryPhone(request.primaryPhone());
        device.setCustomerName(request.customerName() != null ? request.customerName() : "");
        device.setCustomerEmail(request.customerEmail() != null ? request.customerEmail() : "");
        device.setStatus(DeviceStatus.Active);
        device.setAutoPaymentEnabled(false);

        device = deviceRepository.save(device);

        // Automatically add primary phone as first payment method
        DevicePaymentMethod paymentMethod = new DevicePaymentMethod();
        paymentMethod.setDevice(device);
        paymentMethod.setPhoneNumber(request.primaryPhone());
        paymentMethod.setPaymentProvider("MobileMoney");
        paymentMethod.setAccountName(request.customerName() != null ? request.customerName() : "");
        paymentMethod.setDefault(true);
        paymentMethod.setVerified(false);
        
        paymentMethodRepository.save(paymentMethod);

        return mapToDeviceResponse(device);
    }

    @Transactional(readOnly = true)
    public DeviceRegistrationDtos.RegisteredDeviceResponse getDeviceByDeviceId(String deviceId) {
        RegisteredDevice device = deviceRepository.findByDeviceId(deviceId)
            .orElseThrow(() -> new RuntimeException("Device not registered: " + deviceId));
        return mapToDeviceResponse(device);
    }

    @Transactional(readOnly = true)
    public boolean isDeviceRegistered(String deviceId) {
        return deviceRepository.existsByDeviceId(deviceId);
    }

    @Transactional
    public DeviceRegistrationDtos.PaymentMethodResponse addPaymentMethod(
            String deviceId,
            DeviceRegistrationDtos.AddPaymentMethodRequest request) {
        
        RegisteredDevice device = deviceRepository.findByDeviceId(deviceId)
            .orElseThrow(() -> new RuntimeException("Device not registered: " + deviceId));

        // Check if phone number already added
        if (paymentMethodRepository.existsByDeviceIdAndPhoneNumber(device.getId(), request.phoneNumber())) {
            throw new RuntimeException("Payment method already exists");
        }

        // Limit to 2 payment methods
        List<DevicePaymentMethod> existing = paymentMethodRepository.findByDeviceId(device.getId());
        if (existing.size() >= 2) {
            throw new RuntimeException("Maximum 2 payment methods allowed per device");
        }

        DevicePaymentMethod paymentMethod = new DevicePaymentMethod();
        paymentMethod.setDevice(device);
        paymentMethod.setPhoneNumber(request.phoneNumber());
        paymentMethod.setPaymentProvider(request.paymentProvider() != null ? request.paymentProvider() : "MobileMoney");
        paymentMethod.setAccountName(request.accountName() != null ? request.accountName() : "");
        paymentMethod.setDefault(request.isDefault());
        paymentMethod.setVerified(false);

        // If set as default, unset other defaults
        if (request.isDefault()) {
            existing.forEach(pm -> {
                pm.setDefault(false);
                paymentMethodRepository.save(pm);
            });
        }

        paymentMethod = paymentMethodRepository.save(paymentMethod);

        // Update secondary phone if this is the second method
        if (existing.size() == 1) {
            device.setSecondaryPhone(request.phoneNumber());
            device.setUpdatedAt(Instant.now());
            deviceRepository.save(device);
        }

        return mapToPaymentMethodResponse(paymentMethod);
    }

    @Transactional
    public DeviceRegistrationDtos.RegisteredDeviceResponse enableAutoPayment(
            String deviceId,
            boolean enabled,
            String pin) {
        
        RegisteredDevice device = deviceRepository.findByDeviceId(deviceId)
            .orElseThrow(() -> new RuntimeException("Device not registered: " + deviceId));

        device.setAutoPaymentEnabled(enabled);
        
        if (enabled && pin != null) {
            // In production, use proper password hashing (BCrypt, Argon2, etc.)
            device.setPinHash(hashPin(pin));
        } else if (!enabled) {
            device.setPinHash(null);
        }
        
        device.setUpdatedAt(Instant.now());
        device = deviceRepository.save(device);

        return mapToDeviceResponse(device);
    }

    @Transactional
    public DeviceRegistrationDtos.DevicePaymentResponse processDevicePayment(
            DeviceRegistrationDtos.DevicePaymentRequest request) {
        
        RegisteredDevice device = deviceRepository.findByDeviceId(request.deviceId())
            .orElseThrow(() -> new RuntimeException("Device not registered: " + request.deviceId()));

        // Verify PIN if auto-payment enabled
        if (request.useAutoPayment() && device.isAutoPaymentEnabled()) {
            if (request.pin() == null || !verifyPin(request.pin(), device.getPinHash())) {
                return new DeviceRegistrationDtos.DevicePaymentResponse(
                    false,
                    "Invalid PIN",
                    null,
                    null
                );
            }
        }

        // Get payment method
        DevicePaymentMethod paymentMethod = null;
        String phoneNumber = device.getPrimaryPhone();
        
        if (request.paymentMethodId() != null) {
            paymentMethod = paymentMethodRepository.findById(request.paymentMethodId())
                .orElse(null);
            if (paymentMethod != null) {
                phoneNumber = paymentMethod.getPhoneNumber();
            }
        }

        // Create transaction record
        DeviceTransaction transaction = new DeviceTransaction();
        transaction.setDevice(device);
        transaction.setTransactionType("Payment");
        transaction.setReferenceId(request.referenceId());
        transaction.setReferenceType(request.referenceType());
        transaction.setAmount(request.amount());
        transaction.setCurrency(request.currency() != null ? request.currency() : "UGX");
        transaction.setPaymentMethod(paymentMethod);
        transaction.setPhoneNumber(phoneNumber);
        transaction.setStatus(TransactionStatus.Pending);
        transaction.setAutoPayment(request.useAutoPayment());

        transaction = transactionRepository.save(transaction);

        // Update device last used
        device.setLastUsedAt(Instant.now());
        device.setUpdatedAt(Instant.now());
        deviceRepository.save(device);

        // Update payment method last used
        if (paymentMethod != null) {
            paymentMethod.setLastUsedAt(Instant.now());
            paymentMethodRepository.save(paymentMethod);
        }

        return new DeviceRegistrationDtos.DevicePaymentResponse(
            true,
            "Payment initiated successfully",
            transaction.getId().toString(),
            mapToTransactionResponse(transaction)
        );
    }

    @Transactional(readOnly = true)
    public List<DeviceRegistrationDtos.DeviceTransactionResponse> getDeviceTransactions(String deviceId) {
        RegisteredDevice device = deviceRepository.findByDeviceId(deviceId)
            .orElseThrow(() -> new RuntimeException("Device not registered: " + deviceId));
        
        return transactionRepository.findByDeviceIdOrderByCreatedAtDesc(device.getId()).stream()
            .map(this::mapToTransactionResponse)
            .collect(Collectors.toList());
    }

    private DeviceRegistrationDtos.RegisteredDeviceResponse mapToDeviceResponse(RegisteredDevice device) {
        List<DeviceRegistrationDtos.PaymentMethodResponse> paymentMethods = 
            paymentMethodRepository.findByDeviceId(device.getId()).stream()
                .map(this::mapToPaymentMethodResponse)
                .collect(Collectors.toList());

        long totalTransactions = transactionRepository.countByDeviceIdAndStatus(
            device.getId(), TransactionStatus.Completed);
        long completedTransactions = totalTransactions;

        return new DeviceRegistrationDtos.RegisteredDeviceResponse(
            device.getId(),
            device.getDeviceId(),
            device.getDeviceName(),
            device.getDeviceModel(),
            device.getDeviceOs(),
            device.getStatus(),
            device.getPrimaryPhone(),
            device.getSecondaryPhone(),
            device.getCustomerName(),
            device.getCustomerEmail(),
            device.isAutoPaymentEnabled(),
            device.getLastUsedAt(),
            device.getCreatedAt(),
            device.getUpdatedAt(),
            paymentMethods,
            (int) totalTransactions,
            (int) completedTransactions
        );
    }

    private DeviceRegistrationDtos.PaymentMethodResponse mapToPaymentMethodResponse(DevicePaymentMethod pm) {
        return new DeviceRegistrationDtos.PaymentMethodResponse(
            pm.getId(),
            pm.getPhoneNumber(),
            pm.getPaymentProvider(),
            pm.getAccountName(),
            pm.isDefault(),
            pm.isVerified(),
            pm.getVerifiedAt(),
            pm.getAddedAt(),
            pm.getLastUsedAt()
        );
    }

    private DeviceRegistrationDtos.DeviceTransactionResponse mapToTransactionResponse(DeviceTransaction tx) {
        return new DeviceRegistrationDtos.DeviceTransactionResponse(
            tx.getId(),
            tx.getDevice().getDeviceId(),
            tx.getTransactionType(),
            tx.getReferenceId(),
            tx.getReferenceType(),
            tx.getAmount(),
            tx.getCurrency(),
            tx.getPhoneNumber(),
            tx.getStatus(),
            tx.isAutoPayment(),
            tx.getCreatedAt(),
            tx.getCompletedAt()
        );
    }

    private String generateDeviceRecordId() {
        return "DEV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private String hashPin(String pin) {
        // In production, use BCrypt or Argon2
        // For now, simple hash (NOT SECURE FOR PRODUCTION)
        return "HASH:" + pin;
    }

    private boolean verifyPin(String pin, String hash) {
        // In production, use proper password verification
        return hash != null && hash.equals("HASH:" + pin);
    }
}
