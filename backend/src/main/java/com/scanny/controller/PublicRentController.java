package com.scanny.controller;

import com.scanny.dto.RentDtos;
import com.scanny.exception.ApiException;
import com.scanny.repository.RentPaymentRepository;
import com.scanny.service.RentAccountService;
import com.scanny.service.RentPaymentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public (no-auth) endpoints for the tenant-facing rent payment flow.
 * All paths are under {@code /api/public/rent/**} which is already
 * whitelisted by {@code SecurityConfig}: {@code GET/POST /api/public/**}.
 *
 * <h3>Endpoints</h3>
 * <ul>
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

    public PublicRentController(
            RentPaymentService rentPaymentService,
            RentAccountService rentAccountService,
            RentPaymentRepository rentPaymentRepository) {
        this.rentPaymentService = rentPaymentService;
        this.rentAccountService = rentAccountService;
        this.rentPaymentRepository = rentPaymentRepository;
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
    public RentDtos.TenantPayContext resolvePayContext(@PathVariable String token) {
        return rentPaymentService.resolvePayContext(token);
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
            @Valid @RequestBody RentDtos.InitiateRentPaymentRequest request) {
        return rentPaymentService.initiatePayment(token, unitId, chargeId, request);
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
}
