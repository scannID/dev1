package com.scanny.controller;

import com.scanny.dto.DeviceBindingDtos;
import com.scanny.dto.RentDtos;
import com.scanny.exception.ApiException;
import com.scanny.repository.RentPaymentRepository;
import com.scanny.service.QrAuditService;
import com.scanny.service.QrDeviceBindingService;
import com.scanny.service.RentAccountService;
import com.scanny.service.RentPaymentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * Public (no-auth) endpoints for the tenant-facing rent payment flow.
 * All paths are under {@code /api/public/rent/**} which is already
 * whitelisted by {@code SecurityConfig}: {@code GET/POST /api/public/**}.
 *
 * <h3>Endpoints</h3>
 * <ul>
 *   <li>{@code GET  /api/public/rent/pay/:token/check-device}
 *       — check if device can access this token (device binding)</li>
 *   <li>{@code POST /api/public/rent/pay/:token/bind}
 *       — create device binding (first scan with phone verification)</li>
 *   <li>{@code GET  /api/public/rent/pay/:token}
 *       — resolve token → TenantPayContext for the pay page</li>
 *   <li>{@code POST /api/public/rent/pay/:token}
 *       — tenant initiates a MoMo payment</li>
 *   <li>{@code POST /api/public/rent/accounts}
 *       — create a rent account (public onboarding — no Keycloak)</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/public/rent")
public class PublicRentController {

    private final RentPaymentService rentPaymentService;
    private final RentAccountService rentAccountService;
    private final RentPaymentRepository rentPaymentRepository;
    private final QrAuditService qrAuditService;
    private final QrDeviceBindingService deviceBindingService;
    private final com.scanny.service.PropertyViewPaymentService propertyViewPaymentService;

    public PublicRentController(
            RentPaymentService rentPaymentService,
            RentAccountService rentAccountService,
            RentPaymentRepository rentPaymentRepository,
            QrAuditService qrAuditService,
            QrDeviceBindingService deviceBindingService,
            com.scanny.service.PropertyViewPaymentService propertyViewPaymentService) {
        this.rentPaymentService = rentPaymentService;
        this.rentAccountService = rentAccountService;
        this.rentPaymentRepository = rentPaymentRepository;
        this.qrAuditService = qrAuditService;
        this.deviceBindingService = deviceBindingService;
        this.propertyViewPaymentService = propertyViewPaymentService;
    }

    /**
     * Check if this device can access the QR token.
     * 
     * <p>Responses:
     * <ul>
     *   <li>200 OK + AccessCheckResult.ALLOWED → device is bound, show payment page</li>
     *   <li>404 Not Found + AccessCheckResult.FIRST_SCAN → no binding, show phone verification</li>
     *   <li>403 Forbidden + AccessCheckResult.DEVICE_MISMATCH → different device, show error with contact</li>
     * </ul>
     */
    @GetMapping("/pay/{token}/check-device")
    public DeviceBindingDtos.AccessCheckResult checkDeviceAccess(
            @PathVariable String token,
            @RequestHeader(value = "X-Device-ID", required = false) String deviceId,
            HttpServletRequest request) {
        
        if (deviceId == null || deviceId.isBlank()) {
            throw new ApiException(400, "X-Device-ID header is required");
        }

        DeviceBindingDtos.AccessCheckResult result = 
            deviceBindingService.checkDeviceAccess(token, deviceId, request);

        // Return appropriate HTTP status based on decision
        if (result.decision() == DeviceBindingDtos.AccessDecision.DEVICE_MISMATCH) {
            throw new DeviceMismatchException(result);
        }
        
        if (result.decision() == DeviceBindingDtos.AccessDecision.FIRST_SCAN) {
            throw new FirstScanException(result);
        }

        return result; // 200 OK for ALLOWED
    }

    /**
     * Create device binding after phone verification (first scan).
     * 
     * <p>Request body:
     * <pre>
     * {
     *   "phoneNumber": "+256700123456",
     *   "deviceFingerprint": "{\"type\":\"mobile\",\"os\":\"Android 13\",...}"
     * }
     * </pre>
     */
    @PostMapping("/pay/{token}/bind")
    @ResponseStatus(HttpStatus.CREATED)
    public DeviceBindingDtos.BindingCreatedResponse createBinding(
            @PathVariable String token,
            @RequestHeader(value = "X-Device-ID", required = false) String deviceId,
            @Valid @RequestBody DeviceBindingDtos.CreateBindingRequest request,
            HttpServletRequest httpRequest) {
        
        if (deviceId == null || deviceId.isBlank()) {
            throw new ApiException(400, "X-Device-ID header is required");
        }

        var binding = deviceBindingService.createBinding(
            token,
            deviceId,
            request.phoneNumber(),
            request.deviceFingerprint(),
            httpRequest
        );

        return new DeviceBindingDtos.BindingCreatedResponse(
            binding.getId(),
            "Device successfully bound. You can now make payments from this device.",
            binding.getBoundAt(),
            binding.getExpiresAt()
        );
    }

    /**
     * Resolves a pay-page token (property QR, unit QR, or tenant personal link)
     * into the full context needed to render the payment form.
     *
     * <p>Token types:
     * <ul>
     *   <li>Property QR  → {@code tokenType:"property"}, units list populated</li>
     *   <li>Unit QR      → {@code tokenType:"unit"}, unit pre-selected</li>
     *   <li>Tenant token → {@code tokenType:"tenant"}, everything pre-filled</li>
     * </ul>
     */
    @GetMapping("/pay/{token}")
    public RentDtos.TenantPayContext resolvePayContext(
            @PathVariable String token,
            HttpServletRequest request) {
        try {
            RentDtos.TenantPayContext context = rentPaymentService.resolvePayContext(token);
            
            // Audit successful access
            qrAuditService.logSuccess(token, "RENT_PAY", "ACCESS", request, 
                context.propertyId() != null ? context.propertyId() : null);
            
            return context;
        } catch (ApiException e) {
            // Audit failed access
            if (e.getStatus() == 404) {
                qrAuditService.logInvalid(token, "RENT_PAY", request);
            } else if (e.getStatus() == 410) {
                qrAuditService.logExpired(token, "RENT_PAY", request);
            } else {
                qrAuditService.logDenied(token, "RENT_PAY", "ACCESS", request, e.getMessage());
            }
            throw e;
        }
    }

    /**
     * Initiates a MoMo push payment for a rent charge.
     *
     * @param token    pay-page token (any of the three types)
     * @param unitId   required when {@code token} is a property-level QR and
     *                 the tenant picked a unit on the frontend
     * @param chargeId optional — if the frontend has the exact charge ID to pay
     */
    @PostMapping("/pay/{token}")
    public RentDtos.InitiateRentPaymentResponse initiatePayment(
            @PathVariable String token,
            @RequestParam(required = false) String unitId,
            @RequestParam(required = false) Long chargeId,
            @Valid @RequestBody RentDtos.InitiateRentPaymentRequest request,
            HttpServletRequest httpRequest) {
        
        try {
            RentDtos.InitiateRentPaymentResponse response = 
                rentPaymentService.initiatePayment(token, unitId, chargeId, request);
            
            // Audit successful payment initiation
            qrAuditService.logSuccess(token, "RENT_PAY", "PAYMENT", httpRequest,
                unitId != null ? unitId : null);
            
            return response;
        } catch (ApiException e) {
            // Audit failed payment attempt
            qrAuditService.logDenied(token, "RENT_PAY", "PAYMENT", httpRequest, e.getMessage());
            throw e;
        }
    }

    /**
     * Public account creation — called from the landing-page onboarding form.
     * Returns the new (or existing) account including the {@code accessKey}.
     * Idempotent on email: repeated calls for the same email return the same account.
     */
    @PostMapping("/accounts")
    @ResponseStatus(HttpStatus.CREATED)
    public RentDtos.AccountResponse createAccount(
            @Valid @RequestBody RentDtos.CreateAccountRequest request) {
        return rentAccountService.createAccount(request);
    }

    /**
     * Lightweight status-polling endpoint for the pay page.
     * The frontend polls this after initiating a payment instead of trusting the
     * gateway redirect alone. Returns 404 for unknown refs (same generic response
     * as an invalid token — prevents enumeration).
     *
     * <p>GET /api/public/rent/payments/{ref}
     */
    @GetMapping("/payments/{ref}")
    public RentDtos.PaymentStatusResponse getPaymentStatus(@PathVariable String ref) {
        return rentPaymentRepository.findByTransactionRef(ref)
                .map(RentDtos.PaymentStatusResponse::from)
                .orElseThrow(() -> new ApiException(404, "Payment not found"));
    }

    /**
     * Tenant submits a maintenance request via the QR tenant app.
     * Resolved against the pay token to identify the property/unit.
     * Public — no auth required.
     */
    @PostMapping("/maintenance/{token}")
    @ResponseStatus(HttpStatus.CREATED)
    public RentDtos.MaintenanceRequest submitMaintenance(
            @PathVariable String token,
            @RequestBody RentDtos.SubmitMaintenanceRequest req) {
        return rentPaymentService.submitMaintenanceRequest(token, req);
    }

    /**
     * Tenant fetches their own maintenance requests by pay token.
     */
    @GetMapping("/maintenance/{token}")
    public java.util.List<RentDtos.MaintenanceRequest> listMyMaintenance(
            @PathVariable String token) {
        return rentPaymentService.listMaintenanceByToken(token);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Property view payment endpoints
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Check if viewer has already paid to access this property.
     * GET /api/public/rent/property-view/{token}/access?phone=0700123456
     */
    @GetMapping("/property-view/{token}/access")
    public RentDtos.PropertyViewAccessResponse checkPropertyViewAccess(
            @PathVariable String token,
            @RequestParam String phone) {
        return propertyViewPaymentService.checkAccess(token, phone);
    }

    /**
     * Initiate a property viewing payment.
     * POST /api/public/rent/property-view/{token}
     * Body: { "phone": "0700123456" }
     */
    @PostMapping("/property-view/{token}")
    public RentDtos.InitiatePropertyViewPaymentResponse initiatePropertyViewPayment(
            @PathVariable String token,
            @Valid @RequestBody RentDtos.InitiatePropertyViewPaymentRequest request,
            HttpServletRequest httpRequest) {
        
        try {
            RentDtos.InitiatePropertyViewPaymentResponse response = 
                propertyViewPaymentService.initiatePayment(token, request);
            
            // Audit successful payment initiation
            qrAuditService.logSuccess(token, "PROPERTY_VIEW", "PAYMENT", httpRequest, null);
            
            return response;
        } catch (ApiException e) {
            // Audit failed payment attempt
            qrAuditService.logDenied(token, "PROPERTY_VIEW", "PAYMENT", httpRequest, e.getMessage());
            throw e;
        }
    }

    /**
     * Get property view payment status (for frontend polling).
     * GET /api/public/rent/property-view/payments/{ref}
     */
    @GetMapping("/property-view/payments/{ref}")
    public RentDtos.PaymentStatusResponse getPropertyViewPaymentStatus(@PathVariable String ref) {
        return propertyViewPaymentService.getPaymentStatus(ref);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Custom exceptions for device binding HTTP status codes
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Thrown when device doesn't match binding (403 Forbidden).
     * Contains property manager contact info for tenant to call.
     */
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public static class DeviceMismatchException extends RuntimeException {
        private final DeviceBindingDtos.AccessCheckResult result;

        public DeviceMismatchException(DeviceBindingDtos.AccessCheckResult result) {
            super(result.message());
            this.result = result;
        }

        public DeviceBindingDtos.AccessCheckResult getResult() {
            return result;
        }
    }

    /**
     * Thrown when no binding exists yet (404 Not Found).
     * Frontend should show phone verification form.
     */
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public static class FirstScanException extends RuntimeException {
        private final DeviceBindingDtos.AccessCheckResult result;

        public FirstScanException(DeviceBindingDtos.AccessCheckResult result) {
            super(result.message());
            this.result = result;
        }

        public DeviceBindingDtos.AccessCheckResult getResult() {
            return result;
        }
    }
}
