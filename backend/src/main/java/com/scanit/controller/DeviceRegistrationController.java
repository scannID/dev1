package com.scanit.controller;

import com.scanit.dto.DeviceRegistrationDtos;
import com.scanit.service.DeviceRegistrationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/devices")
public class DeviceRegistrationController {

    private final DeviceRegistrationService deviceService;

    public DeviceRegistrationController(DeviceRegistrationService deviceService) {
        this.deviceService = deviceService;
    }

    @PostMapping("/register")
    public ResponseEntity<DeviceRegistrationDtos.RegisteredDeviceResponse> registerDevice(
            @RequestBody DeviceRegistrationDtos.RegisterDeviceRequest request) {
        try {
            DeviceRegistrationDtos.RegisteredDeviceResponse response = deviceService.registerDevice(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    @GetMapping("/{deviceId}")
    public ResponseEntity<DeviceRegistrationDtos.RegisteredDeviceResponse> getDevice(
            @PathVariable String deviceId) {
        try {
            DeviceRegistrationDtos.RegisteredDeviceResponse response = deviceService.getDeviceByDeviceId(deviceId);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @GetMapping("/{deviceId}/check")
    public ResponseEntity<Boolean> checkDeviceRegistration(@PathVariable String deviceId) {
        boolean isRegistered = deviceService.isDeviceRegistered(deviceId);
        return ResponseEntity.ok(isRegistered);
    }

    @PostMapping("/{deviceId}/payment-methods")
    public ResponseEntity<DeviceRegistrationDtos.PaymentMethodResponse> addPaymentMethod(
            @PathVariable String deviceId,
            @RequestBody DeviceRegistrationDtos.AddPaymentMethodRequest request) {
        try {
            DeviceRegistrationDtos.PaymentMethodResponse response = 
                deviceService.addPaymentMethod(deviceId, request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    @PostMapping("/{deviceId}/auto-payment")
    public ResponseEntity<DeviceRegistrationDtos.RegisteredDeviceResponse> enableAutoPayment(
            @PathVariable String deviceId,
            @RequestBody DeviceRegistrationDtos.EnableAutoPaymentRequest request) {
        try {
            DeviceRegistrationDtos.RegisteredDeviceResponse response = 
                deviceService.enableAutoPayment(deviceId, request.enabled(), request.pin());
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    @PostMapping("/pay")
    public ResponseEntity<DeviceRegistrationDtos.DevicePaymentResponse> processPayment(
            @RequestBody DeviceRegistrationDtos.DevicePaymentRequest request) {
        try {
            DeviceRegistrationDtos.DevicePaymentResponse response = 
                deviceService.processDevicePayment(request);
            
            if (response.success()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
            }
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    @GetMapping("/{deviceId}/transactions")
    public ResponseEntity<List<DeviceRegistrationDtos.DeviceTransactionResponse>> getTransactions(
            @PathVariable String deviceId) {
        try {
            List<DeviceRegistrationDtos.DeviceTransactionResponse> transactions = 
                deviceService.getDeviceTransactions(deviceId);
            return ResponseEntity.ok(transactions);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}
