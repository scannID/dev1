package com.scanny.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentUnit;
import com.scanny.exception.ApiException;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import javax.imageio.ImageIO;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Generates QR code images for rent unit payment links.
 *
 * <h3>Outputs</h3>
 * <ul>
 *   <li>{@link #pngBytes(String, int)} — raw PNG bytes for a single QR.</li>
 *   <li>{@link #svgString(String, int)} — inline SVG for browser embedding.</li>
 *   <li>{@link #bulkPdfBytes(RentProperty, List)} — A4 PDF with a grid of all
 *       unit QR codes, each labelled with the unit number.</li>
 * </ul>
 *
 * <p>Error correction level {@code M} is used (≈ 15 % recovery) — a good
 * balance between density and robustness for door-sticker printing.
 */
@Service
public class RentQrService {

    private static final Logger log = LoggerFactory.getLogger(RentQrService.class);

    /** QR size used for the bulk PDF grid cells (points ≈ 1/72 inch). */
    private static final int PDF_QR_PX = 400;

    /** Number of QR columns per A4 page. */
    private static final int COLS = 3;

    /** Vertical space reserved per cell: QR image + label underneath. */
    private static final float CELL_HEIGHT_PT = 180f;
    private static final float CELL_WIDTH_PT  = 180f;
    private static final float PAGE_MARGIN_PT  = 28f;
    private static final float LABEL_HEIGHT_PT = 22f;

    @Value("${scanny.customer-url}")
    private String customerUrl;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Returns PNG bytes for the pay-page URL encoded in a QR code.
     *
     * @param url  the full URL to encode (e.g. {@code https://app/rent/pay/<token>})
     * @param size pixel dimension (width = height)
     */
    public byte[] pngBytes(String url, int size) {
        try {
            BitMatrix matrix = encode(url, size);
            BufferedImage img = MatrixToImageWriter.toBufferedImage(matrix);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, "PNG", out);
            return out.toByteArray();
        } catch (WriterException | IOException e) {
            log.error("[RentQR] PNG generation failed for {}: {}", url, e.getMessage());
            throw new ApiException(500, "QR code generation failed");
        }
    }

    /**
     * Returns an SVG string for the QR code at the given URL.
     * The SVG uses a compact path representation: each module (dark cell) is
     * rendered as a 1×1 {@code <rect>} inside a grouped {@code <g>} element.
     * The viewBox is set to the matrix size so the SVG scales cleanly.
     *
     * @param url  the full URL to encode
     * @param size logical size for the ZXing matrix (also becomes the viewBox size)
     */
    public String svgString(String url, int size) {
        try {
            BitMatrix matrix = encode(url, size);
            int w = matrix.getWidth();
            int h = matrix.getHeight();

            StringBuilder sb = new StringBuilder(w * h * 20);
            sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
              .append("<svg xmlns=\"http://www.w3.org/2000/svg\"")
              .append(" viewBox=\"0 0 ").append(w).append(' ').append(h).append("\"")
              .append(" width=\"").append(size).append("\" height=\"").append(size).append("\"")
              .append(" shape-rendering=\"crispEdges\">\n")
              .append("  <rect width=\"").append(w).append("\" height=\"").append(h)
              .append("\" fill=\"white\"/>\n")
              .append("  <g fill=\"black\">\n");

            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    if (matrix.get(x, y)) {
                        sb.append("    <rect x=\"").append(x).append("\" y=\"").append(y)
                          .append("\" width=\"1\" height=\"1\"/>\n");
                    }
                }
            }

            sb.append("  </g>\n</svg>");
            return sb.toString();
        } catch (WriterException e) {
            log.error("[RentQR] SVG generation failed for {}: {}", url, e.getMessage());
            throw new ApiException(500, "QR code generation failed");
        }
    }

    /**
     * Generates a printable A4 PDF with a grid of QR codes — one per unit.
     * Each cell shows the QR code and the unit number printed below it.
     * The property name appears as a header on every page.
     *
     * @param property the property (used for header text)
     * @param units    list of units to include; vacant units (no qr_token) are skipped
     */
    public byte[] bulkPdfBytes(RentProperty property, List<RentUnit> units) {
        try (PDDocument doc = new PDDocument()) {

            List<RentUnit> withQr = units.stream()
                    .filter(u -> u.getQrToken() != null && !u.getQrToken().isBlank())
                    .toList();

            if (withQr.isEmpty()) {
                // Return a one-page placeholder PDF
                PDPage blankPage = new PDPage(PDRectangle.A4);
                doc.addPage(blankPage);
                try (PDPageContentStream cs = new PDPageContentStream(doc, blankPage)) {
                    writeText(cs, "No unit QR codes available for " + property.getName(),
                            PAGE_MARGIN_PT, PDRectangle.A4.getHeight() - PAGE_MARGIN_PT - 20, 12);
                }
            } else {
                renderGrid(doc, property, withQr);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();

        } catch (IOException e) {
            log.error("[RentQR] Bulk PDF failed for property {}: {}", property.getId(), e.getMessage());
            throw new ApiException(500, "Bulk QR PDF generation failed");
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /** Encodes a URL into a ZXing {@link BitMatrix} with error correction M. */
    private static BitMatrix encode(String url, int size) throws WriterException {
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
        hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
        // QR spec requires a 4-module quiet zone; margin < 4 causes scan failures
        // on strict readers, especially from printed stickers.
        hints.put(EncodeHintType.MARGIN, 4);
        return new QRCodeWriter().encode(url, BarcodeFormat.QR_CODE, size, size, hints);
    }

    /**
     * Lays out the QR grid across as many A4 pages as needed.
     * Grid: {@value #COLS} columns, as many rows as required.
     * Each cell is {@value #CELL_WIDTH_PT} × {@value #CELL_HEIGHT_PT} pt.
     */
    private void renderGrid(PDDocument doc, RentProperty property, List<RentUnit> units)
            throws IOException {

        float pageW = PDRectangle.A4.getWidth();
        float pageH = PDRectangle.A4.getHeight();

        // Usable width divided evenly among columns
        float usableW = pageW - 2 * PAGE_MARGIN_PT;
        float cellW   = usableW / COLS;
        float cellH   = CELL_HEIGHT_PT + LABEL_HEIGHT_PT;

        // Header band height
        float headerH = 32f;
        float contentTop = pageH - PAGE_MARGIN_PT - headerH;

        // How many rows fit on one page
        int rowsPerPage = (int) Math.floor(contentTop / cellH);
        if (rowsPerPage < 1) rowsPerPage = 1;

        PDPage  page = null;
        PDPageContentStream cs = null;
        int col = 0, row = 0;

        for (int i = 0; i < units.size(); i++) {
            RentUnit unit = units.get(i);

            // New page?
            if (page == null || (col == 0 && row == rowsPerPage)) {
                if (cs != null) cs.close();
                row  = 0;
                page = new PDPage(PDRectangle.A4);
                doc.addPage(page);
                cs = new PDPageContentStream(doc, page);
                drawPageHeader(cs, property.getName(), pageW, pageH, PAGE_MARGIN_PT, headerH);
            }

            // Top-left corner of this cell
            float x = PAGE_MARGIN_PT + col * cellW;
            float y = contentTop - row * cellH - cellH; // PDF y-axis is bottom-up

            // ── QR image ─────────────────────────────────────────────────────
            String payUrl = customerUrl + "/rent/pay/" + unit.getQrToken();
            byte[] pngData = pngBytes(payUrl, PDF_QR_PX);
            BufferedImage qrImg = ImageIO.read(new java.io.ByteArrayInputStream(pngData));
            PDImageXObject pdImg = LosslessFactory.createFromImage(doc, qrImg);

            float imgSize = Math.min(cellW, CELL_HEIGHT_PT) - 8f; // 4 pt padding each side
            float imgX = x + (cellW - imgSize) / 2f;
            float imgY = y + LABEL_HEIGHT_PT + (CELL_HEIGHT_PT - imgSize) / 2f;
            cs.drawImage(pdImg, imgX, imgY, imgSize, imgSize);

            // ── Unit label ────────────────────────────────────────────────────
            String label = "Unit " + unit.getUnitNumber();
            writeText(cs, label, x, y + LABEL_HEIGHT_PT - 6, 10);

            // Advance grid position
            col++;
            if (col >= COLS) {
                col = 0;
                row++;
            }
        }

        if (cs != null) cs.close();
    }

    /** Draws the property name as a page header. */
    private void drawPageHeader(PDPageContentStream cs, String title,
            float pageW, float pageH, float margin, float headerH) throws IOException {
        writeText(cs, title, margin, pageH - margin - headerH + 10, 14);
    }

    /**
     * Writes a single line of text using PDFBox's built-in Helvetica font.
     * PDFBox 3.x requires a try-with-resources or explicit beginText/endText.
     */
    private void writeText(PDPageContentStream cs, String text,
            float x, float y, float fontSize) throws IOException {
        cs.beginText();
        cs.setFont(
            new PDType1Font(Standard14Fonts.FontName.HELVETICA),
            fontSize);
        cs.newLineAtOffset(x, y);
        // Sanitise to Latin-1 to avoid encoding issues with Helvetica Type1
        String safe = text.replaceAll("[^\\x00-\\xFF]", "?");
        cs.showText(safe);
        cs.endText();
    }
}
