package com.scanny.efris;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.scanny.entity.Order;
import com.scanny.entity.OrderLineItem;
import com.scanny.model.enums.ItemKind;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

/**
 * Low-level EFRIS API client.
 *
 * <h3>Stub mode (default)</h3>
 * <p>When {@link EfrisProperties#isEnabled()} is {@code false}, or when the merchant
 * has no {@link EfrisMerchantConfig} row, {@link #submit} returns a
 * {@link EfrisResult} with a fake FDN immediately — no HTTP call, no AES key needed.
 * The full outbox → submission → receipt pipeline runs end-to-end in dev so
 * switching to live mode is purely a config change.
 *
 * <h3>Live mode</h3>
 * <p>Builds the URA invoice JSON, AES-256-ECB encrypts the content block using the
 * per-merchant device key, signs the request, and POSTs to the configured API URL.
 * URA returns a signed fiscal document number (FDN) and a verification QR URL.
 *
 * <h3>AES encryption (URA spec)</h3>
 * <p>URA's EFRIS v3 spec requires:
 * <ul>
 *   <li>Algorithm: AES/ECB/PKCS5Padding</li>
 *   <li>Key: 32-byte (AES-256) device key issued by URA, stored Base64-encoded</li>
 *   <li>The content JSON is encrypted and the result Base64-encoded before wrapping
 *       in the outer request envelope</li>
 * </ul>
 */
@Component
public class EfrisApiClient {

    private static final Logger log = LoggerFactory.getLogger(EfrisApiClient.class);

    // URA EFRIS invoice type codes
    private static final String INVOICE_TYPE_NORMAL   = "1";   // Normal sale
    private static final String INVOICE_TYPE_CREDIT   = "2";   // Credit note (refund)
    private static final String CURRENCY_CODE         = "UGX";
    // goodsServiceFlag is now resolved per line item — see goodsServiceFlagFor()
    private static final String TAX_CATEGORY          = "A";    // A = Standard 18% VAT
    private static final String TAX_RATE              = "18";

    private final EfrisProperties props;
    private final ObjectMapper     mapper;
    private final HttpClient       http;

    public EfrisApiClient(EfrisProperties props, ObjectMapper mapper) {
        this.props  = props;
        this.mapper = mapper;
        this.http   = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(props.getConnectTimeoutMs()))
                .build();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public record EfrisResult(
            boolean success,
            boolean stub,
            String  fdn,
            String  qrUrl,
            String  requestJson,
            String  responseJson,
            int     httpStatus,
            String  errorMessage
    ) {}

    /**
     * Submits an order to EFRIS (or returns a stub result in dev mode).
     *
     * @param order   the fully-paid order
     * @param config  the merchant's EFRIS credentials (null → stub)
     * @param attempt 1-based attempt number for idempotency key generation
     */
    public EfrisResult submit(Order order, EfrisMerchantConfig config, int attempt) {
        // ── Stub mode ──────────────────────────────────────────────────────────
        boolean useStub = !props.isEnabled() || config == null;
        if (useStub) {
            String fakeFdn = "STUB-" + order.getId().toUpperCase().replace("-", "").substring(0, 12);
            String fakeQr  = "https://efris.ura.go.ug/verify?fdn=" + fakeFdn;
            log.info("EfrisApiClient: STUB mode — fake FDN {} for order {}", fakeFdn, order.getId());
            return new EfrisResult(true, true, fakeFdn, fakeQr, null, "{\"stub\":true}", 0, null);
        }

        // ── Live mode ──────────────────────────────────────────────────────────
        try {
            String contentJson  = buildInvoiceContent(order, config);
            String encryptedB64 = aesEncrypt(contentJson, config.getDeviceKey());
            String requestJson  = buildRequestEnvelope(config, encryptedB64, order.getId(), attempt);

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(props.getApiUrl()))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .timeout(Duration.ofMillis(props.getReadTimeoutMs()))
                    .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            int statusCode = resp.statusCode();
            String body    = resp.body();

            if (statusCode == 200) {
                JsonNode root = mapper.readTree(body);
                // URA response structure: { "returnStateInfo": { "returnCode": "00", ... },
                //                           "data": { "content": "<base64-encrypted-response>" } }
                String returnCode = root.path("returnStateInfo").path("returnCode").asText();
                if ("00".equals(returnCode)) {
                    // Decrypt the response content to get FDN + QR URL
                    String encContent = root.path("data").path("content").asText();
                    String decrypted  = aesDecrypt(encContent, config.getDeviceKey());
                    JsonNode content  = mapper.readTree(decrypted);
                    String fdn   = content.path("basicInformation").path("invoiceNo").asText();
                    String qrUrl = content.path("summary").path("qrCode").asText();
                    return new EfrisResult(true, false, fdn, qrUrl, requestJson, body, statusCode, null);
                } else {
                    String msg = root.path("returnStateInfo").path("returnMessage").asText("URA error");
                    return new EfrisResult(false, false, null, null, requestJson, body, statusCode, msg);
                }
            } else {
                return new EfrisResult(false, false, null, null, requestJson, body, statusCode,
                        "HTTP " + statusCode);
            }
        } catch (Exception ex) {
            log.error("EfrisApiClient: exception for order {}: {}", order.getId(), ex.getMessage(), ex);
            return new EfrisResult(false, false, null, null, null, ex.getMessage(), 0, ex.getMessage());
        }
    }

    // ── Invoice payload builders ──────────────────────────────────────────────

    /**
     * Builds the EFRIS invoice content JSON according to the URA v3 spec.
     * This is the plain-text JSON that gets AES-encrypted before sending.
     */
    private String buildInvoiceContent(Order order, EfrisMerchantConfig config) throws Exception {
        ObjectNode root = mapper.createObjectNode();

        // ── Basic information ──────────────────────────────────────────────────
        ObjectNode basic = root.putObject("basicInformation");
        basic.put("deviceNo",          config.getDeviceNumber());
        basic.put("operatorId",        config.getTin());
        basic.put("currency",          CURRENCY_CODE);
        basic.put("taxpayerName",      config.getLegalName() != null ? config.getLegalName() : "");
        basic.put("invoiceType",       INVOICE_TYPE_NORMAL);
        basic.put("issuedDate",        efrisTimestamp(order.getCreatedAt()
                .atZone(ZoneId.of("Africa/Kampala"))));
        basic.put("operator",          config.getTin());
        basic.put("buyerName",         order.getCustomerName());
        basic.put("buyerTin",          "");  // optional for B2C
        basic.put("buyerAddress",      order.getCustomerLocation() != null ? order.getCustomerLocation() : "");
        basic.put("buyerPhoneNumber",  order.getCustomerPhone() != null ? order.getCustomerPhone() : "");
        basic.put("paymentMode",       "CASH".equalsIgnoreCase(order.getPaymentMethod()) ? "102" : "101"); // 101=MoMo, 102=Cash
        basic.put("remarks",           "Order " + order.getId());

        // ── Line items ─────────────────────────────────────────────────────────
        ArrayNode goods = root.putArray("goodsDetails");
        double vatRate = props.getVatRate();
        int itemIndex  = 1;
        for (OrderLineItem item : order.getItems()) {
            ObjectNode g = goods.addObject();
            long unitPrice = item.getPrice();
            long qty       = item.getQuantity();
            long lineTotal = item.getLineTotal();
            // Tax-inclusive decomposition: tax = total × rate / (1 + rate)
            long taxAmt    = Math.round(lineTotal * vatRate / (1 + vatRate));
            long netAmt    = lineTotal - taxAmt;

            g.put("item",              itemIndex++);
            g.put("itemCode",          item.getId() != null ? String.valueOf(item.getId()) : "ITEM" + itemIndex);
            g.put("itemName",          item.getName());
            g.put("quantity",          qty);
            // UOM is now resolved per ItemKind (EA, PKG, DAY, HUR) rather than
            // hard-coding "PKG" for every business type.
            g.put("unitOfMeasure",     item.getItemKind() != null ? item.getItemKind().uraUom() : "EA");
            g.put("unitPrice",         unitPrice);
            g.put("total",             lineTotal);
            g.put("taxRate",           TAX_RATE);
            g.put("taxAmount",         taxAmt);
            g.put("netAmount",         netAmt);
            g.put("goodsServiceFlag",  goodsServiceFlagFor(item.getItemKind()));
            g.put("taxCategory",       TAX_CATEGORY);
        }

        // ── Summary totals ─────────────────────────────────────────────────────
        long grossTotal = order.getTotal();
        long totalTax   = Math.round(grossTotal * vatRate / (1 + vatRate));
        long netTotal   = grossTotal - totalTax;

        ObjectNode summary = root.putObject("summary");
        summary.put("netAmount",   netTotal);
        summary.put("taxAmount",   totalTax);
        summary.put("grossAmount", grossTotal);
        summary.put("itemCount",   order.getItems().size());

        return mapper.writeValueAsString(root);
    }

    /**
     * Wraps the AES-encrypted invoice content in the URA outer request envelope.
     */
    private String buildRequestEnvelope(
            EfrisMerchantConfig config, String encryptedContent, String orderId, int attempt
    ) throws Exception {
        ObjectNode root = mapper.createObjectNode();

        ObjectNode data = root.putObject("data");
        data.put("content",          encryptedContent);
        data.put("signature",        "");   // URA sandbox accepts empty signature
        data.put("dataDescription",  mapper.createObjectNode()
                .put("codeType", "0")       // 0 = JSON
                .put("encryptCode", "1")    // 1 = AES-256
                .put("zipCode", "0")
                .toString());

        ObjectNode globalInfo = root.putObject("globalInfo");
        globalInfo.put("appId",          "AP04");
        globalInfo.put("version",        "1.1.20191201");
        // Stable idempotency key: SHA-256(orderId + ":" + attempt), truncated to 18 hex chars.
        // URA uses this to deduplicate re-sent envelopes — a retry with the same key returns
        // the existing FDN rather than issuing a second fiscal document.
        globalInfo.put("dataExchangeId", stableExchangeId(orderId, attempt));
        globalInfo.put("interfaceCode",  "T101");      // T101 = issue invoice
        globalInfo.put("requestCode",    "TP");
        globalInfo.put("requestTime",    efrisTimestamp(ZonedDateTime.now(ZoneId.of("Africa/Kampala"))));
        globalInfo.put("responseCode",   "");
        globalInfo.put("userId",         config.getTin());
        globalInfo.put("tin",            config.getTin());
        globalInfo.put("deviceNo",       config.getDeviceNumber());
        globalInfo.put("brn",            "");
        globalInfo.put("taxpayerID",     config.getTin());
        globalInfo.put("longitude",      "32.5825");   // Kampala default — update with real coords later
        globalInfo.put("latitude",       "0.3476");
        globalInfo.put("mac",            "");
        globalInfo.put("fromAction",     "1");
        globalInfo.put("requestSource",  "2");         // 2 = EFD (electronic fiscal device)

        return mapper.writeValueAsString(root);
    }

    // ── Crypto ────────────────────────────────────────────────────────────────

    /**
     * AES-256-ECB encrypt (URA spec). The device key is stored Base64-encoded.
     */
    private static String aesEncrypt(String plainText, String base64Key) throws Exception {
        byte[] keyBytes = Base64.getDecoder().decode(base64Key);
        SecretKeySpec key = new SecretKeySpec(keyBytes, "AES");
        Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        return Base64.getEncoder().encodeToString(cipher.doFinal(plainText.getBytes("UTF-8")));
    }

    /** AES-256-ECB decrypt — used to unpack the URA response content block. */
    private static String aesDecrypt(String base64Ciphertext, String base64Key) throws Exception {
        byte[] keyBytes    = Base64.getDecoder().decode(base64Key);
        byte[] cipherBytes = Base64.getDecoder().decode(base64Ciphertext);
        SecretKeySpec key  = new SecretKeySpec(keyBytes, "AES");
        Cipher cipher      = Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(Cipher.DECRYPT_MODE, key);
        return new String(cipher.doFinal(cipherBytes), "UTF-8");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static final DateTimeFormatter EFRIS_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private static String efrisTimestamp(ZonedDateTime dt) {
        return dt.format(EFRIS_FMT);
    }

    /**
     * Maps an {@link ItemKind} to the URA EFRIS {@code goodsServiceFlag}:
     * <ul>
     *   <li>{@code "1"} — Goods (physical products sold by retail/boutique merchants)</li>
     *   <li>{@code "2"} — Services (food, lodging, salon, parking, events — anything
     *       that is consumed rather than physically taken away)</li>
     * </ul>
     * Defaults to {@code "2"} (Services) for any unknown/null kind so that existing
     * business types continue to work without code changes.
     */
    private static String goodsServiceFlagFor(ItemKind kind) {
        if (kind == ItemKind.PRODUCT) return "1";  // physical goods
        return "2";                                 // services (food, lodging, etc.)
    }

    /**
     * Derives a stable 18-character hex idempotency key from the order ID and
     * attempt number using the first 9 bytes of SHA-256(orderId + ":" + attempt).
     *
     * <p>Using the same key on a retry means URA can recognise the duplicate
     * envelope and return the already-issued FDN rather than creating a second
     * fiscal document — the core defence against the lost-response duplicate-receipt
     * scenario.
     */
    private static String stableExchangeId(String orderId, int attempt) {
        try {
            String input = orderId + ":" + attempt;
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(input.getBytes(StandardCharsets.UTF_8));
            // 9 bytes → 18 hex chars, matching the field length URA expects
            StringBuilder sb = new StringBuilder(18);
            for (int i = 0; i < 9; i++) {
                sb.append(String.format("%02x", digest[i] & 0xff));
            }
            return sb.toString();
        } catch (Exception ex) {
            // SHA-256 is always available on any JVM; this branch is unreachable
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}
