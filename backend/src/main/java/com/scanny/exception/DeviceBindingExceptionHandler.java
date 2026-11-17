package com.scanny.exception;

import com.scanny.controller.PublicRentController;
import com.scanny.dto.DeviceBindingDtos;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Global exception handler for device binding errors.
 * Provides structured JSON responses with proper HTTP status codes.
 */
@RestControllerAdvice
public class DeviceBindingExceptionHandler {

    /**
     * Handle device mismatch (403 Forbidden).
     * Returns access check result with property manager contact.
     */
    @ExceptionHandler(PublicRentController.DeviceMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleDeviceMismatch(
            PublicRentController.DeviceMismatchException ex) {
        
        DeviceBindingDtos.AccessCheckResult result = ex.getResult();
        
        return ResponseEntity
            .status(HttpStatus.FORBIDDEN)
            .body(Map.of(
                "decision", result.decision().name(),
                "message", result.message(),
                "propertyManager", result.propertyManager() != null ? Map.of(
                    "name", result.propertyManager().name(),
                    "phone", result.propertyManager().phone(),
                    "whatsapp", result.propertyManager().whatsapp() != null ? 
                        result.propertyManager().whatsapp() : "",
                    "propertyName", result.propertyManager().propertyName()
                ) : Map.of()
            ));
    }

    /**
     * Handle first scan (404 Not Found).
     * Frontend should show phone verification form.
     */
    @ExceptionHandler(PublicRentController.FirstScanException.class)
    public ResponseEntity<Map<String, Object>> handleFirstScan(
            PublicRentController.FirstScanException ex) {
        
        DeviceBindingDtos.AccessCheckResult result = ex.getResult();
        
        return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(Map.of(
                "decision", result.decision().name(),
                "message", result.message(),
                "action", "VERIFY_PHONE"
            ));
    }
}
