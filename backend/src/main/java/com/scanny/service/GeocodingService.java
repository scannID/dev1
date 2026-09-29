package com.scanny.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Lightweight geocoder (OpenStreetMap Nominatim) used to turn venue / restaurant
 * addresses into lat/lng for promotion radius matching.
 *
 * Results are cached in-memory for the process lifetime to respect Nominatim
 * usage policy and avoid repeat lookups.
 */
@Service
public class GeocodingService {

    private static final Logger log = LoggerFactory.getLogger(GeocodingService.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(8);

    private final ObjectMapper objectMapper;
    private final String nominatimUrl;
    private final String userAgent;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    private final ConcurrentHashMap<String, Optional<GeoPoint>> cache = new ConcurrentHashMap<>();

    public record GeoPoint(double lat, double lng) {}

    public GeocodingService(
            ObjectMapper objectMapper,
            @Value("${scanny.geocoding.nominatim-url:https://nominatim.openstreetmap.org/search}") String nominatimUrl,
            @Value("${scanny.geocoding.user-agent:KoddlyPromotions/1.0 (support@koddly.app)}") String userAgent
    ) {
        this.objectMapper = objectMapper;
        this.nominatimUrl = nominatimUrl;
        this.userAgent = userAgent;
    }

    public Optional<GeoPoint> geocode(String rawAddress) {
        String query = normalizeQuery(rawAddress);
        if (query == null) {
            return Optional.empty();
        }
        return cache.computeIfAbsent(query, this::lookup);
    }

    private Optional<GeoPoint> lookup(String query) {
        try {
            String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
            URI uri = URI.create(nominatimUrl + "?format=json&limit=1&q=" + encoded);
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(TIMEOUT)
                    .header("User-Agent", userAgent)
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("Geocode HTTP {} for query={}", response.statusCode(), query);
                return Optional.empty();
            }
            JsonNode root = objectMapper.readTree(response.body());
            if (!root.isArray() || root.isEmpty()) {
                log.info("Geocode miss for query={}", query);
                return Optional.empty();
            }
            JsonNode first = root.get(0);
            double lat = first.path("lat").asDouble(Double.NaN);
            double lng = first.path("lon").asDouble(Double.NaN);
            if (Double.isNaN(lat) || Double.isNaN(lng)) {
                return Optional.empty();
            }
            log.info("Geocoded '{}' -> {},{}", query, lat, lng);
            return Optional.of(new GeoPoint(lat, lng));
        } catch (Exception ex) {
            log.warn("Geocode failed for query={}: {}", query, ex.getMessage());
            return Optional.empty();
        }
    }

    /** Trim, collapse whitespace, and append Uganda when country is missing. */
    static String normalizeQuery(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim().replaceAll("\\s+", " ");
        if (trimmed.length() < 3) return null;
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (!lower.contains("uganda") && !lower.contains("kampala") && !lower.contains("entebbe")) {
            trimmed = trimmed + ", Uganda";
        }
        return trimmed;
    }
}
