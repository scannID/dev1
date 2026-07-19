package com.scanny.service;

import com.scanny.dto.DeviceRegistrationDtos;
import com.scanny.entity.RegisteredDevice;
import com.scanny.repository.DevicePaymentMethodRepository;
import com.scanny.repository.DeviceTransactionRepository;
import com.scanny.repository.RegisteredDeviceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DeviceRegistrationServiceTest {

    private RegisteredDeviceRepository deviceRepository;
    private DevicePaymentMethodRepository paymentMethodRepository;
    private DeviceTransactionRepository transactionRepository;
    private PasswordEncoder passwordEncoder;
    private DeviceRegistrationService service;

    @BeforeEach
    void setUp() {
        deviceRepository = mock(RegisteredDeviceRepository.class);
        paymentMethodRepository = mock(DevicePaymentMethodRepository.class);
        transactionRepository = mock(DeviceTransactionRepository.class);
        passwordEncoder = new BCryptPasswordEncoder();
        service = new DeviceRegistrationService(
                deviceRepository,
                paymentMethodRepository,
                transactionRepository,
                passwordEncoder
        );
    }

    @Test
    void enableAutoPaymentStoresBcryptHash() {
        RegisteredDevice device = new RegisteredDevice();
        device.setId("DEV-1");
        device.setDeviceId("phone-1");
        when(deviceRepository.findByDeviceId("phone-1")).thenReturn(Optional.of(device));
        when(deviceRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentMethodRepository.findByDeviceId(any())).thenReturn(java.util.List.of());
        when(transactionRepository.countByDeviceIdAndStatus(any(), any())).thenReturn(0L);

        service.enableAutoPayment("phone-1", true, "1234");

        assertNotNull(device.getPinHash());
        assertFalse(device.getPinHash().startsWith("HASH:"));
        assertTrue(passwordEncoder.matches("1234", device.getPinHash()));
    }
}
