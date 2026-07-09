package com.scanit.controller;

import com.scanit.dto.MerchantDtos.*;
import com.scanit.service.MerchantService;
import com.scanit.service.QrCodeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/auth/merchant")
public class MerchantAuthController {

    private final MerchantService merchantService;
    private final QrCodeService qrCodeService;

    public MerchantAuthController(MerchantService merchantService, QrCodeService qrCodeService) {
        this.merchantService = merchantService;
        this.qrCodeService = qrCodeService;
    }

    /**
     * Register a new merchant
     * POST /api/auth/merchant/register
     */
    @PostMapping("/register")
    public ResponseEntity<RegisterMerchantResponse> register(@Valid @RequestBody RegisterMerchantRequest request) {
        RegisterMerchantResponse response = merchantService.registerMerchant(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Simulate login (will be replaced with Keycloak OAuth2)
     * POST /api/auth/merchant/login
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        // TODO: Implement actual Keycloak authentication
        // For now, just find merchant by email
        
        // This is a placeholder - will be replaced with real Keycloak integration
        throw new UnsupportedOperationException("Login will be implemented with Keycloak OAuth2 integration");
    }

    /**
     * Get merchant profile
     * GET /api/auth/merchant/profile
     */
    @GetMapping("/profile")
    public ResponseEntity<MerchantProfile> getProfile(@RequestParam UUID merchantId) {
        MerchantProfile profile = merchantService.getMerchantProfile(merchantId);
        return ResponseEntity.ok(profile);
    }

    /**
     * Update merchant profile
     * PATCH /api/auth/merchant/profile
     */
    @PatchMapping("/profile")
    public ResponseEntity<MerchantProfile> updateProfile(
            @RequestParam UUID merchantId,
            @Valid @RequestBody UpdateMerchantRequest request) {
        MerchantProfile profile = merchantService.updateMerchant(merchantId, request);
        return ResponseEntity.ok(profile);
    }

    /**
     * Get onboarding status
     * GET /api/auth/merchant/onboarding
     */
    @GetMapping("/onboarding")
    public ResponseEntity<OnboardingStatusResponse> getOnboardingStatus(@RequestParam UUID merchantId) {
        OnboardingStatusResponse status = merchantService.getOnboardingStatus(merchantId);
        return ResponseEntity.ok(status);
    }

    /**
     * Complete onboarding
     * POST /api/auth/merchant/onboarding/complete
     */
    @PostMapping("/onboarding/complete")
    public ResponseEntity<Void> completeOnboarding(@RequestParam UUID merchantId) {
        merchantService.completeOnboarding(merchantId);
        return ResponseEntity.ok().build();
    }

    /**
     * Get QR code
     * GET /api/auth/merchant/qr-code
     */
    @GetMapping("/qr-code")
    public ResponseEntity<QrCodeResponse> getQrCode(@RequestParam UUID merchantId) {
        QrCodeResponse qrCode = qrCodeService.getQrCode(merchantId);
        return ResponseEntity.ok(qrCode);
    }

    /**
     * Generate/regenerate QR code
     * POST /api/auth/merchant/qr-code/generate
     */
    @PostMapping("/qr-code/generate")
    public ResponseEntity<QrCodeResponse> generateQrCode(
            @RequestParam UUID merchantId,
            @RequestParam(defaultValue = "MANUAL") String reason) {
        QrCodeResponse qrCode = qrCodeService.generateQrCode(merchantId, reason);
        return ResponseEntity.status(HttpStatus.CREATED).body(qrCode);
    }

    /**
     * Mark QR code as printed
     * POST /api/auth/merchant/qr-code/mark-printed
     */
    @PostMapping("/qr-code/mark-printed")
    public ResponseEntity<Void> markQrCodePrinted(@RequestParam UUID merchantId) {
        qrCodeService.markAsPrinted(merchantId);
        return ResponseEntity.ok().build();
    }

    /**
     * Get high-resolution QR code for printing
     * GET /api/auth/merchant/qr-code/print
     */
    @GetMapping("/qr-code/print")
    public ResponseEntity<String> getPrintableQrCode(
            @RequestParam UUID merchantId,
            @RequestParam(defaultValue = "2048") int size) {
        String qrCode = qrCodeService.generatePrintableQrCode(merchantId, size);
        return ResponseEntity.ok(qrCode);
    }
}
