package com.scanit.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.scanit.dto.MerchantDtos.QrCodeResponse;
import com.scanit.entity.Merchant;
import com.scanit.exception.ApiException;
import com.scanit.repository.MerchantRepository;
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
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class QrCodeService {

    private static final Logger logger = LoggerFactory.getLogger(QrCodeService.class);
    
    private final MerchantRepository merchantRepository;
    private final JdbcTemplate jdbcTemplate;
    
    @Value("${scanit.scan-base-url:https://scanit.app}")
    private String scanBaseUrl;
    
    public QrCodeService(MerchantRepository merchantRepository, JdbcTemplate jdbcTemplate) {
        this.merchantRepository = merchantRepository;
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
        
        // Build QR code URL
        String qrCodeUrl = scanBaseUrl + "/menu/" + qrToken;
        
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
        
        // Log generation
        logQrCodeGeneration(merchantId, qrToken, qrCodeUrl, reason);
        
        logger.info("Generated QR code for merchant {} ({}): {}", merchantId, reason, qrToken);
        
        return new QrCodeResponse(
            qrToken,
            qrCodeUrl,
            qrCodeDataUrl,
            isNewGeneration,
            merchant.getQrCodeGeneratedAt(),
            merchant.getQrCodePrintCount(),
            qrCodeUrl + "/download"
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
     * Generate unique QR token using database function
     */
    private String generateUniqueToken() {
        String token = jdbcTemplate.queryForObject(
            "SELECT generate_qr_token()",
            String.class
        );
        
        if (token == null || token.isBlank()) {
            throw new ApiException(500, "Failed to generate QR token");
        }
        
        return token;
    }

    /**
     * Log QR code generation to database
     */
    private void logQrCodeGeneration(UUID merchantId, String qrToken, String qrUrl, String reason) {
        jdbcTemplate.update(
            "INSERT INTO qr_code_generations (merchant_id, qr_token, qr_url, generation_reason) VALUES (?, ?, ?, ?)",
            merchantId, qrToken, qrUrl, reason
        );
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
