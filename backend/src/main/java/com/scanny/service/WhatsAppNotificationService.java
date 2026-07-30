package com.scanny.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.scanny.entity.Ticket;
import com.scanny.util.PhoneUtils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class WhatsAppNotificationService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppNotificationService.class);
    private static final Pattern PHONE_ID_IN_URL = Pattern.compile("/(\\d+)/messages/?$");

    /**
     * Custom ticket+QR template (submitted to Meta as kode_event_ticket_v1).
     * Until Meta marks it APPROVED, we send the known-working order_confirmation sample
     * with the ticket link (QR opens from that link).
     */
    private static final String TICKET_TEMPLATE = "kode_event_ticket_v1";
    private static final String RELIABLE_FALLBACK_TEMPLATE = "jaspers_market_order_confirmation_v1";
    private static final String IMAGE_FALLBACK_TEMPLATE = "jaspers_market_image_cta_v1";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiUrl;
    private final String apiToken;
    private final String mediaUploadUrl;
    private final String configuredTemplate;
    private final boolean enabled;

    public WhatsAppNotificationService(
            @Value("${scanny.whatsapp.api-url:}") String apiUrl,
            @Value("${scanny.whatsapp.api-token:}") String apiToken,
            @Value("${scanny.whatsapp.from-number:}") String fromNumber,
            @Value("${scanny.whatsapp.enabled:false}") boolean enabled,
            @Value("${scanny.whatsapp.ticket-template:}") String ticketTemplate,
            ObjectMapper objectMapper
    ) {
        this.apiUrl = apiUrl;
        this.apiToken = apiToken;
        this.enabled = enabled;
        this.objectMapper = objectMapper;
        this.configuredTemplate = ticketTemplate == null ? "" : ticketTemplate.trim();
        this.restClient = RestClient.create();
        this.mediaUploadUrl = deriveMediaUploadUrl(apiUrl);
    }

    public void sendText(String toPhone, String message) {
        log.info("WhatsApp text skipped (templates only) to {}: {}", PhoneUtils.normalize(toPhone), message);
    }

    public void sendOrderStatusUpdate(String toPhone, String businessName, String orderId, String status) {
        sendText(toPhone, businessName + ": your order " + orderId + " is now " + status + ".");
    }

    /**
     * Ticket delivery:
     * 1) Try kode_event_ticket_v1 (QR image header) when Meta has approved it.
     * 2) Otherwise open the chat with Meta's sample order template (farm wording — unavoidable).
     * 3) Then send free-form ticket text + gate QR image inside the open customer-care window.
     */
    public void sendAttendeeTicket(Ticket ticket, String viewUrl, String gateQrPayload) {
        String phone = PhoneUtils.normalize(ticket.getHolderPhone());
        if (phone.isBlank()) {
            log.warn("Skipping WhatsApp ticket delivery for {} — no phone", ticket.getId());
            return;
        }
        String name = blank(ticket.getHolderName(), "there");
        String event = blank(ticket.getEventName(), "your event");
        String ticketClass = blank(ticket.getTicketType(), "General");
        String ticketId = blank(ticket.getId(), "ticket");
        String link = blank(viewUrl, "");
        String qrContent = blank(gateQrPayload, ticket.getQrToken());

        if (!enabled || apiUrl.isBlank() || apiToken.isBlank()) {
            log.info("WhatsApp ticket (dry-run) to {} template={} qrLen={}", phone, preferredTemplate(),
                    qrContent == null ? 0 : qrContent.length());
            return;
        }

        try {
            byte[] png = renderQrPng(qrContent, 512);
            String mediaId = uploadMedia(png, "ticket-" + ticketId + ".png");
            String primary = preferredTemplate();
            boolean usedCustomTicketTemplate = false;

            log.info("WhatsApp ticket template send to {} ticket={} template={} mediaId={} link={}",
                    phone, ticket.getId(), primary, mediaId, link);
            writeDebug("SEND start phone=" + phone + " ticket=" + ticket.getId()
                    + " template=" + primary + " mediaId=" + mediaId
                    + " url=" + apiUrl + " tokenLen=" + apiToken.length() + " link=" + link);

            try {
                String response = sendTicketTemplate(phone, primary, mediaId, name, event, ticketClass, ticketId, link);
                usedCustomTicketTemplate = TICKET_TEMPLATE.equals(primary)
                        || (!configuredTemplate.isBlank() && configuredTemplate.equals(primary)
                        && !RELIABLE_FALLBACK_TEMPLATE.equals(primary)
                        && !IMAGE_FALLBACK_TEMPLATE.equals(primary));
                log.info("WhatsApp ticket template OK to {} for {} response={}", phone, ticket.getId(), response);
                writeDebug("SEND ok ticket=" + ticket.getId() + " template=" + primary + " response=" + response);
                System.out.println("WHATSAPP_OK " + ticket.getId() + " " + phone + " " + primary);
            } catch (org.springframework.web.client.RestClientResponseException primaryEx) {
                if (!RELIABLE_FALLBACK_TEMPLATE.equals(primary) && isTemplateUnavailable(primaryEx)) {
                    log.warn("Primary template {} unavailable; falling back to {}", primary, RELIABLE_FALLBACK_TEMPLATE);
                    writeDebug("SEND fallback ticket=" + ticket.getId() + " from=" + primary
                            + " to=" + RELIABLE_FALLBACK_TEMPLATE + " cause=" + primaryEx.getResponseBodyAsString());
                    String orderLine = ticketId + " / " + event + " / " + ticketClass;
                    String response = sendOrderConfirmationTemplate(phone, name, orderLine, blank(link, "open ticket page"));
                    log.info("WhatsApp ticket fallback OK to {} for {} response={}", phone, ticket.getId(), response);
                    writeDebug("SEND ok ticket=" + ticket.getId() + " template=" + RELIABLE_FALLBACK_TEMPLATE
                            + " response=" + response);
                    System.out.println("WHATSAPP_OK " + ticket.getId() + " " + phone + " " + RELIABLE_FALLBACK_TEMPLATE);
                } else {
                    throw primaryEx;
                }
            }

            // After any sample/fallback template, push the real ticket copy + scannable QR.
            if (!usedCustomTicketTemplate) {
                sendSessionTicketFollowUp(phone, name, event, ticketClass, ticketId, link, mediaId);
            }
        } catch (org.springframework.web.client.RestClientResponseException ex) {
            String err = "HTTP " + ex.getStatusCode().value() + " — " + ex.getResponseBodyAsString();
            log.warn("WhatsApp ticket template FAILED for {}: {}", phone, err);
            writeDebug("SEND fail ticket=" + ticket.getId() + " " + err);
            System.err.println("WHATSAPP_FAIL " + err);
        } catch (Exception ex) {
            log.warn("WhatsApp ticket template FAILED for {}: {}", phone, ex.toString());
            writeDebug("SEND fail ticket=" + ticket.getId() + " " + ex);
            System.err.println("WHATSAPP_FAIL " + ex);
        }
    }

    private void sendSessionTicketFollowUp(
            String phone,
            String name,
            String event,
            String ticketClass,
            String ticketId,
            String link,
            String mediaId
    ) {
        String text = "Kode ticket for " + name + "\n"
                + "Event: " + event + "\n"
                + "Class: " + ticketClass + "\n"
                + "Ticket: " + ticketId + "\n"
                + (link.isBlank() ? "" : ("Open: " + link + "\n"))
                + "Show the QR in the next message at the gate.";
        try {
            Map<String, Object> textBody = new LinkedHashMap<>();
            textBody.put("messaging_product", "whatsapp");
            textBody.put("to", phone);
            textBody.put("type", "text");
            textBody.put("text", Map.of("body", truncate(text, 900)));
            String textResp = restClient.post()
                    .uri(apiUrl)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(textBody)
                    .retrieve()
                    .body(String.class);
            writeDebug("FOLLOWUP text ok phone=" + phone + " response=" + textResp);

            Map<String, Object> image = new LinkedHashMap<>();
            image.put("id", mediaId);
            image.put("caption", "Gate QR — show at entry (" + ticketId + ")");
            Map<String, Object> imageBody = new LinkedHashMap<>();
            imageBody.put("messaging_product", "whatsapp");
            imageBody.put("to", phone);
            imageBody.put("type", "image");
            imageBody.put("image", image);
            String imageResp = restClient.post()
                    .uri(apiUrl)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(imageBody)
                    .retrieve()
                    .body(String.class);
            writeDebug("FOLLOWUP image ok phone=" + phone + " response=" + imageResp);
            System.out.println("WHATSAPP_FOLLOWUP_OK " + ticketId + " " + phone);
        } catch (org.springframework.web.client.RestClientResponseException ex) {
            writeDebug("FOLLOWUP fail phone=" + phone + " HTTP " + ex.getStatusCode().value()
                    + " — " + ex.getResponseBodyAsString());
            log.warn("WhatsApp ticket follow-up failed for {}: {}", phone, ex.getResponseBodyAsString());
        } catch (Exception ex) {
            writeDebug("FOLLOWUP fail phone=" + phone + " " + ex);
            log.warn("WhatsApp ticket follow-up failed for {}: {}", phone, ex.toString());
        }
    }

    private String preferredTemplate() {
        return configuredTemplate.isBlank() ? TICKET_TEMPLATE : configuredTemplate;
    }

    private String sendTicketTemplate(
            String phone,
            String templateName,
            String mediaId,
            String name,
            String event,
            String ticketClass,
            String ticketId,
            String link
    ) {
        if (RELIABLE_FALLBACK_TEMPLATE.equals(templateName)) {
            String orderLine = ticketId + " / " + event + " / " + ticketClass;
            return sendOrderConfirmationTemplate(phone, name, orderLine, blank(link, "open ticket page"));
        }
        if (IMAGE_FALLBACK_TEMPLATE.equals(templateName)) {
            return postTemplate(phone, templateName, List.of(imageHeader(mediaId)));
        }
        // kode_event_ticket_v1: IMAGE header = gate QR + ticket body fields
        List<Map<String, Object>> components = new ArrayList<>();
        components.add(imageHeader(mediaId));

        List<Map<String, String>> parameters = new ArrayList<>();
        parameters.add(textParam(truncate(name, 60)));
        parameters.add(textParam(truncate(event, 60)));
        parameters.add(textParam(truncate(ticketClass, 40)));
        parameters.add(textParam(truncate(ticketId, 40)));

        Map<String, Object> bodyComponent = new LinkedHashMap<>();
        bodyComponent.put("type", "body");
        bodyComponent.put("parameters", parameters);
        components.add(bodyComponent);

        return postTemplate(phone, templateName, components);
    }

    private String sendOrderConfirmationTemplate(String phone, String name, String orderLine, String link) {
        List<Map<String, String>> parameters = new ArrayList<>();
        parameters.add(textParam(truncate(name, 60)));
        parameters.add(textParam(truncate(orderLine, 60)));
        parameters.add(textParam(truncate(link, 200)));
        Map<String, Object> bodyComponent = new LinkedHashMap<>();
        bodyComponent.put("type", "body");
        bodyComponent.put("parameters", parameters);
        return postTemplate(phone, RELIABLE_FALLBACK_TEMPLATE, List.of(bodyComponent));
    }

    private Map<String, Object> imageHeader(String mediaId) {
        Map<String, Object> image = new LinkedHashMap<>();
        image.put("id", mediaId);
        Map<String, Object> param = new LinkedHashMap<>();
        param.put("type", "image");
        param.put("image", image);
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("type", "header");
        header.put("parameters", List.of(param));
        return header;
    }

    private String postTemplate(String phone, String templateName, List<Map<String, Object>> components) {
        Map<String, Object> template = new LinkedHashMap<>();
        template.put("name", templateName);
        template.put("language", Map.of("code", "en_US"));
        template.put("components", components);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("messaging_product", "whatsapp");
        body.put("to", phone);
        body.put("type", "template");
        body.put("template", template);

        return restClient.post()
                .uri(apiUrl)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);
    }

    private String uploadMedia(byte[] png, String filename) {
        if (mediaUploadUrl == null || mediaUploadUrl.isBlank()) {
            throw new IllegalStateException("Cannot derive WhatsApp media upload URL from " + apiUrl);
        }
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("messaging_product", "whatsapp");
        builder.part("type", "image/png");
        builder.part("file", new ByteArrayResource(png) {
            @Override
            public String getFilename() {
                return filename;
            }
        }).contentType(MediaType.IMAGE_PNG);

        String response = restClient.post()
                .uri(mediaUploadUrl)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiToken)
                .body(builder.build())
                .retrieve()
                .body(String.class);
        try {
            JsonNode root = objectMapper.readTree(response);
            String id = root.path("id").asText("");
            if (id.isBlank()) {
                throw new IllegalStateException("WhatsApp media upload missing id: " + response);
            }
            return id;
        } catch (IllegalStateException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("WhatsApp media upload parse failed: " + response, ex);
        }
    }

    private static byte[] renderQrPng(String content, int size) throws Exception {
        QRCodeWriter writer = new QRCodeWriter();
        Map<EncodeHintType, Object> hints = new HashMap<>();
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.H);
        hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
        hints.put(EncodeHintType.MARGIN, 2);
        BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size, hints);
        BufferedImage image = MatrixToImageWriter.toBufferedImage(matrix);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "PNG", out);
        return out.toByteArray();
    }

    private static String deriveMediaUploadUrl(String messagesUrl) {
        if (messagesUrl == null || messagesUrl.isBlank()) {
            return "";
        }
        Matcher m = PHONE_ID_IN_URL.matcher(messagesUrl.trim());
        if (!m.find()) {
            return "";
        }
        String phoneId = m.group(1);
        int idx = messagesUrl.indexOf("/" + phoneId + "/messages");
        if (idx < 0) {
            return "";
        }
        return messagesUrl.substring(0, idx) + "/" + phoneId + "/media";
    }

    private static boolean isTemplateUnavailable(org.springframework.web.client.RestClientResponseException ex) {
        String body = ex.getResponseBodyAsString();
        return body != null && (
                body.contains("Template name does not exist")
                        || body.contains("is not approved")
                        || body.contains("pending")
                        || body.contains("#132000")
                        || body.contains("#132001")
                        || body.contains("#132005")
                        || body.contains("#132007")
                        || body.contains("#132012")
                        || body.contains("#132015")
                        || body.contains("#132016")
        );
    }

    private static void writeDebug(String line) {
        try {
            java.nio.file.Path path = java.nio.file.Path.of(
                    System.getProperty("user.dir"), "..", ".dev", "whatsapp-debug.log");
            path = path.toAbsolutePath().normalize();
            java.nio.file.Files.createDirectories(path.getParent());
            java.nio.file.Files.writeString(
                    path,
                    java.time.Instant.now() + " " + line + System.lineSeparator(),
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.APPEND);
        } catch (Exception ignored) {
            // ignore debug IO failures
        }
    }

    private static Map<String, String> textParam(String value) {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("type", "text");
        p.put("text", value);
        return p;
    }

    private static String blank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }
}
