package com.scanny.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.dto.ImageSearchDtos;
import com.scanny.exception.ApiException;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import javax.imageio.ImageIO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ImageSearchService {

    private static final Logger logger = LoggerFactory.getLogger(ImageSearchService.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(12);
    private static final int MAX_EDGE_PX = 640;
    private static final Set<String> ALLOWED_HOSTS = Set.of(
            "images.pexels.com",
            "www.pexels.com",
            "pexels.com"
    );

    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public ImageSearchService(
            ObjectMapper objectMapper,
            @Value("${scanny.pexels.api-key:}") String apiKey
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    public ImageSearchDtos.ImageSearchResponse search(String rawQuery, int perPage) {
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.isBlank()) {
            throw new ApiException(400, "Search query is required.");
        }
        if (!isConfigured()) {
            throw new ApiException(
                    503,
                    "Photo search is not configured. Add PEXELS_API_KEY to the backend environment."
            );
        }

        int safePerPage = Math.min(Math.max(perPage, 1), 24);
        String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
        URI uri = URI.create(
                "https://api.pexels.com/v1/search?query=" + encoded + "&per_page=" + safePerPage + "&orientation=square"
        );

        try {
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(TIMEOUT)
                    .header("Authorization", apiKey)
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 401 || response.statusCode() == 403) {
                throw new ApiException(502, "Pexels rejected the API key.");
            }
            if (response.statusCode() == 429) {
                throw new ApiException(429, "Photo search rate limit reached. Try again shortly.");
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logger.warn("Pexels search failed: HTTP {}", response.statusCode());
                throw new ApiException(502, "Photo search failed. Try again.");
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode photos = root.path("photos");
            List<ImageSearchDtos.ImageSearchResult> results = new ArrayList<>();
            if (photos.isArray()) {
                for (JsonNode photo : photos) {
                    String id = text(photo, "id");
                    String thumb = text(photo.path("src"), "tiny");
                    if (thumb.isBlank()) {
                        thumb = text(photo.path("src"), "small");
                    }
                    String image = text(photo.path("src"), "medium");
                    if (image.isBlank()) {
                        image = text(photo.path("src"), "large");
                    }
                    if (id.isBlank() || image.isBlank()) {
                        continue;
                    }
                    results.add(new ImageSearchDtos.ImageSearchResult(
                            id,
                            thumb.isBlank() ? image : thumb,
                            image,
                            text(photo, "photographer"),
                            text(photo, "photographer_url"),
                            text(photo, "alt")
                    ));
                }
            }
            return new ImageSearchDtos.ImageSearchResponse(query, results, true);
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            logger.error("Pexels search error", ex);
            throw new ApiException(502, "Photo search failed. Try again.");
        }
    }

    public ImageSearchDtos.ImportImageResponse importImage(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new ApiException(400, "Image URL is required.");
        }
        URI uri;
        try {
            uri = URI.create(rawUrl.trim());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(400, "Invalid image URL.");
        }
        if (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme())) {
            throw new ApiException(400, "Image URL must be http(s).");
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        if (!ALLOWED_HOSTS.contains(host)) {
            throw new ApiException(400, "Only Pexels image URLs can be imported.");
        }

        try {
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(TIMEOUT)
                    .header("User-Agent", "ScannyCatalog/1.0")
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ApiException(502, "Could not download the selected photo.");
            }
            byte[] body = response.body();
            if (body == null || body.length == 0) {
                throw new ApiException(502, "Selected photo was empty.");
            }
            if (body.length > 4_000_000) {
                throw new ApiException(400, "Selected photo is too large.");
            }

            BufferedImage source = ImageIO.read(new ByteArrayInputStream(body));
            if (source == null) {
                throw new ApiException(400, "Selected file is not a usable image.");
            }
            BufferedImage resized = resize(source, MAX_EDGE_PX);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            if (!ImageIO.write(resized, "jpg", out)) {
                throw new ApiException(500, "Could not encode selected photo.");
            }
            String dataUrl = "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(out.toByteArray());
            if (dataUrl.length() > 500_000) {
                throw new ApiException(400, "Selected photo is still too large after resize.");
            }
            return new ImageSearchDtos.ImportImageResponse(dataUrl);
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            logger.error("Pexels import error", ex);
            throw new ApiException(502, "Could not import the selected photo.");
        }
    }

    private static BufferedImage resize(BufferedImage source, int maxEdge) {
        int width = source.getWidth();
        int height = source.getHeight();
        int longest = Math.max(width, height);
        if (longest <= maxEdge) {
            return toRgb(source);
        }
        double scale = (double) maxEdge / (double) longest;
        int targetW = Math.max(1, (int) Math.round(width * scale));
        int targetH = Math.max(1, (int) Math.round(height * scale));
        BufferedImage target = new BufferedImage(targetW, targetH, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = target.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(source, 0, 0, targetW, targetH, null);
        } finally {
            g.dispose();
        }
        return target;
    }

    private static BufferedImage toRgb(BufferedImage source) {
        if (source.getType() == BufferedImage.TYPE_INT_RGB) {
            return source;
        }
        BufferedImage rgb = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        try {
            g.drawImage(source, 0, 0, null);
        } finally {
            g.dispose();
        }
        return rgb;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return "";
        }
        return value.asText("").trim();
    }
}
