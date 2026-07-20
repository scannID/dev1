package com.scanny.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.scanny.dto.MerchantDtos.QrCodeResponse;
import com.scanny.entity.Merchant;
import com.scanny.exception.ApiException;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.MerchantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service
public class QrCodeService {

    private static final Logger logger = LoggerFactory.getLogger(QrCodeService.class);
    
    private final MerchantRepository merchantRepository;
    private final BusinessRepository businessRepository;
    private final JdbcTemplate jdbcTemplate;
    
    @Value("${scanny.scan-base-url:http://localhost:5173}")
    private String scanBaseUrl;
    
    public QrCodeService(
            MerchantRepository merchantRepository,
            BusinessRepository businessRepository,
            JdbcTemplate jdbcTemplate
    ) {
        this.merchantRepository = merchantRepository;
        this.businessRepository = businessRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Generate QR code for a merchant on first login or regenerate
     */
    @Transactional
    public QrCodeResponse generateQrCode(UUID merchantId, String reason) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ApiException(404, "Merchant not found"));
        
        boolean isNewGeneration = merchant.getQrCodeToken() == null;
        
        // Generate unique token using database function
        String qrToken = generateUniqueToken();

        // Prefer deep link that the Vite customer menu understands
        String businessId = businessRepository.findByMerchantId(merchantId.toString())
                .map(b -> b.getId())
                .orElse(null);
        String qrCodeUrl = businessId != null
                ? scanBaseUrl + "/b/" + businessId + "?qr=" + qrToken
                : scanBaseUrl + "/b?qr=" + qrToken;
        
        // Generate QR code image as base64
        String qrCodeDataUrl = generateQrCodeImage(qrCodeUrl, 512);
        
        // Update merchant
        merchant.setQrCodeToken(qrToken);
        merchant.setQrCodeUrl(qrCodeUrl);
        merchant.setQrCodeGeneratedAt(LocalDateTime.now());
        
        // Update onboarding step if this is first generation
        if (isNewGeneration && merchant.getOnboardingStep() < 2) {
            merchant.setOnboardingStep(2);
        }
        
        merchantRepository.save(merchant);

        // Keep ordering business QR in sync when it already exists
        businessRepository.findByMerchantId(merchantId.toString()).ifPresent(business -> {
            business.setQrToken(qrToken);
            businessRepository.save(business);
            merchant.setQrCodeUrl(scanBaseUrl + "/b/" + business.getId() + "?qr=" + qrToken);
            merchantRepository.save(merchant);
        });
        
        // Log generation
        logQrCodeGeneration(merchantId, qrToken, qrCodeUrl, reason);
        
        logger.info("Generated QR code for merchant {} ({}): {}", merchantId, reason, qrToken);
        
        return new QrCodeResponse(
            merchant.getQrCodeToken(),
            merchant.getQrCodeUrl(),
            qrCodeDataUrl,
            isNewGeneration,
            merchant.getQrCodeGeneratedAt(),
            merchant.getQrCodePrintCount(),
            merchant.getQrCodeUrl() + "/download"
        );
    }

    /**
     * Get existing QR code for a merchant
     */
    @Transactional(readOnly = true)
    public QrCodeResponse getQrCode(UUID merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ApiException(404, "Merchant not found"));
        
        if (merchant.getQrCodeToken() == null) {
            throw new ApiException(404, "QR code not generated yet. Please generate one first.");
        }
        
        // Generate QR code image
        String qrCodeDataUrl = generateQrCodeImage(merchant.getQrCodeUrl(), 512);
        
        return new QrCodeResponse(
            merchant.getQrCodeToken(),
            merchant.getQrCodeUrl(),
            qrCodeDataUrl,
            false,
            merchant.getQrCodeGeneratedAt(),
            merchant.getQrCodePrintCount(),
            merchant.getQrCodeUrl() + "/download"
        );
    }

    /**
     * Mark QR code as printed
     */
    @Transactional
    public void markAsPrinted(UUID merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ApiException(404, "Merchant not found"));
        
        if (merchant.getQrCodeToken() == null) {
            throw new ApiException(400, "No QR code to mark as printed");
        }
        
        merchant.setQrCodePrinted(true);
        merchant.setQrCodePrintCount(merchant.getQrCodePrintCount() + 1);
        merchantRepository.save(merchant);
        
        logger.info("Marked QR code as printed for merchant {}", merchantId);
    }

    /**
     * Generate QR code image as base64 data URL
     */
    private String generateQrCodeImage(String url, int size) {
        try {
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            
            // Configure QR code hints
            Map<EncodeHintType, Object> hints = new HashMap<>();
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.H);
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
            hints.put(EncodeHintType.MARGIN, 2);
            
            // Generate QR code bit matrix
            BitMatrix bitMatrix = qrCodeWriter.encode(url, BarcodeFormat.QR_CODE, size, size, hints);
            
            // Convert to buffered image
            BufferedImage bufferedImage = MatrixToImageWriter.toBufferedImage(bitMatrix);
            
            // Convert to base64
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(bufferedImage, "PNG", baos);
            byte[] imageBytes = baos.toByteArray();
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            
            // Return as data URL
            return "data:image/png;base64," + base64Image;
            
        } catch (WriterException | IOException e) {
            logger.error("Failed to generate QR code image", e);
            throw new ApiException(500, "Failed to generate QR code image: " + e.getMessage());
        }
    }

    /**
     * Generate a unique QR token in-app so H2 and Postgres both work.
     * Format matches the Postgres helper: QR-{12 hex}-{epoch seconds}
     */
    private String generateUniqueToken() {
        SecureRandom random = new SecureRandom();
        for (int attempt = 0; attempt < 20; attempt++) {
            byte[] bytes = new byte[6];
            random.nextBytes(bytes);
            String token = "QR-"
                    + HexFormat.of().withUpperCase().formatHex(bytes)
                    + "-"
                    + Instant.now().getEpochSecond();
            if (!merchantRepository.findByQrCodeToken(token).isPresent()) {
                return token;
            }
        }
        throw new ApiException(500, "Failed to generate QR token");
    }

    /**
     * Log QR code generation to database when the audit table exists.
     */
    private void logQrCodeGeneration(UUID merchantId, String qrToken, String qrUrl, String reason) {
        try {
            jdbcTemplate.update(
                "INSERT INTO qr_code_generations (merchant_id, qr_token, qr_url, generation_reason) VALUES (?, ?, ?, ?)",
                merchantId, qrToken, qrUrl, reason
            );
        } catch (Exception e) {
            logger.warn("Skipping QR generation audit log: {}", e.getMessage());
        }
    }

    /**
     * Get QR code by token (for public menu access)
     */
    @Transactional(readOnly = true)
    public Merchant getMerchantByQrToken(String qrToken) {
        return merchantRepository.findByQrCodeToken(qrToken)
                .orElseThrow(() -> new ApiException(404, "Invalid QR code"));
    }

    /**
     * Generate high-resolution QR code for printing
     */
    public String generatePrintableQrCode(UUID merchantId, int size) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ApiException(404, "Merchant not found"));
        
        if (merchant.getQrCodeUrl() == null) {
            throw new ApiException(400, "QR code not generated yet");
        }
        
        // Generate high-res QR code (e.g., 2048x2048 for print)
        return generateQrCodeImage(merchant.getQrCodeUrl(), size);
    }
}
