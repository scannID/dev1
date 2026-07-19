package com.scanny.controller;

import com.scanny.dto.MerchantDtos.*;
import com.scanny.security.MerchantAccessService;
import com.scanny.service.AuditService;
import com.scanny.service.MerchantService;
import com.scanny.service.QrCodeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth/merchant")
public class MerchantAuthController {

    private final MerchantService merchantService;
    private final QrCodeService qrCodeService;
    private final MerchantAccessService merchantAccessService;
    private final AuditService auditService;

    public MerchantAuthController(
            MerchantService merchantService,
            QrCodeService qrCodeService,
            MerchantAccessService merchantAccessService,
            AuditService auditService
    ) {
        this.merchantService = merchantService;
        this.qrCodeService = qrCodeService;
        this.merchantAccessService = merchantAccessService;
        this.auditService = auditService;
    }

    @PostMapping("/register")
    public ResponseEntity<RegisterMerchantResponse> register(@Valid @RequestBody RegisterMerchantRequest request) {
        RegisterMerchantResponse response = merchantService.registerMerchant(request);
        auditService.success("MERCHANT_REGISTER", "merchant", response.merchantId().toString(), Map.of("email", request.email()));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        throw new UnsupportedOperationException("Login is handled by Keycloak OAuth2 / OIDC.");
    }

    @GetMapping("/me")
    public ResponseEntity<MerchantMeResponse> me(
            @org.springframework.security.core.annotation.AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(merchantService.getMe(jwt));
    }

    @GetMapping("/profile")
    public ResponseEntity<MerchantProfile> getProfile(
            @RequestParam(required = false) UUID merchantId
    ) {
        UUID id = resolveMerchantId(merchantId);
        return ResponseEntity.ok(merchantService.getMerchantProfile(id));
    }

    @PatchMapping("/profile")
    public ResponseEntity<MerchantProfile> updateProfile(
            @RequestParam(required = false) UUID merchantId,
            @Valid @RequestBody UpdateMerchantRequest request
    ) {
        UUID id = resolveMerchantId(merchantId);
        MerchantProfile profile = merchantService.updateMerchant(id, request);
        auditService.success("MERCHANT_PROFILE_UPDATE", "merchant", id.toString(), Map.of());
        return ResponseEntity.ok(profile);
    }

    @GetMapping("/onboarding")
    public ResponseEntity<OnboardingStatusResponse> getOnboardingStatus(
            @RequestParam(required = false) UUID merchantId
    ) {
        return ResponseEntity.ok(merchantService.getOnboardingStatus(resolveMerchantId(merchantId)));
    }

    @PostMapping("/onboarding/complete")
    public ResponseEntity<Void> completeOnboarding(@RequestParam(required = false) UUID merchantId) {
        UUID id = resolveMerchantId(merchantId);
        merchantService.completeOnboarding(id);
        auditService.success("MERCHANT_ONBOARDING_COMPLETE", "merchant", id.toString(), Map.of());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/qr-code")
    public ResponseEntity<QrCodeResponse> getQrCode(@RequestParam(required = false) UUID merchantId) {
        return ResponseEntity.ok(qrCodeService.getQrCode(resolveMerchantId(merchantId)));
    }

    @PostMapping("/qr-code/generate")
    public ResponseEntity<QrCodeResponse> generateQrCode(
            @RequestParam(required = false) UUID merchantId,
            @RequestParam(defaultValue = "MANUAL") String reason
    ) {
        UUID id = resolveMerchantId(merchantId);
        QrCodeResponse qrCode = qrCodeService.generateQrCode(id, reason);
        auditService.success("QR_REGENERATE", "merchant", id.toString(), Map.of("reason", reason));
        return ResponseEntity.status(HttpStatus.CREATED).body(qrCode);
    }

    @PostMapping("/qr-code/mark-printed")
    public ResponseEntity<Void> markQrCodePrinted(@RequestParam(required = false) UUID merchantId) {
        qrCodeService.markAsPrinted(resolveMerchantId(merchantId));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/qr-code/print")
    public ResponseEntity<String> getPrintableQrCode(
            @RequestParam(required = false) UUID merchantId,
            @RequestParam(defaultValue = "2048") int size
    ) {
        return ResponseEntity.ok(qrCodeService.generatePrintableQrCode(resolveMerchantId(merchantId), size));
    }

    private UUID resolveMerchantId(UUID merchantId) {
        if (merchantId == null) {
            return merchantAccessService.requireCurrentMerchant().getId();
        }
        return merchantAccessService.requireMerchantById(merchantId).getId();
    }
}
