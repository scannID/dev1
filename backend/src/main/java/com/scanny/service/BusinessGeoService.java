package com.scanny.service;

import com.scanny.entity.Business;
import com.scanny.entity.Merchant;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.MerchantRepository;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves and caches lat/lng on businesses so restaurant menus can
 * automatically receive promoted events within each promo's radius.
 */
@Service
public class BusinessGeoService {

    private static final Logger log = LoggerFactory.getLogger(BusinessGeoService.class);

    private final BusinessRepository businessRepository;
    private final MerchantRepository merchantRepository;
    private final GeocodingService geocodingService;

    public BusinessGeoService(
            BusinessRepository businessRepository,
            MerchantRepository merchantRepository,
            GeocodingService geocodingService
    ) {
        this.businessRepository = businessRepository;
        this.merchantRepository = merchantRepository;
        this.geocodingService = geocodingService;
    }

    public record RestaurantCoords(double lat, double lng) {}

    /**
     * Prefer explicit lat/lng params; otherwise load the business and
     * geocode from its address (cached on the row once resolved).
     */
    @Transactional
    public Optional<RestaurantCoords> resolveForNearby(String businessId, Double lat, Double lng) {
        if (lat != null && lng != null) {
            return Optional.of(new RestaurantCoords(lat, lng));
        }
        if (businessId == null || businessId.isBlank()) {
            return Optional.empty();
        }
        return businessRepository.findById(businessId)
                .map(this::ensureCoordinates)
                .flatMap(b -> {
                    if (b.getLatitude() == null || b.getLongitude() == null) {
                        return Optional.empty();
                    }
                    return Optional.of(new RestaurantCoords(b.getLatitude(), b.getLongitude()));
                });
    }

    /**
     * If the business already has coords, return as-is.
     * Otherwise geocode address / merchant address / name+Kampala and persist.
     */
    @Transactional
    public Business ensureCoordinates(Business business) {
        if (business.getLatitude() != null && business.getLongitude() != null) {
            return business;
        }

        String query = firstNonBlank(
                business.getAddress(),
                merchantAddress(business.getMerchantId()),
                business.getName() != null ? business.getName() + ", Kampala" : null
        );
        if (query == null) {
            return business;
        }

        // Skip repeat failed lookups for the same query.
        if (query.equals(business.getGeoQuery()) && business.getLatitude() == null) {
            return business;
        }

        Optional<GeocodingService.GeoPoint> point = geocodingService.geocode(query);
        business.setGeoQuery(query);
        if (point.isPresent()) {
            business.setLatitude(point.get().lat());
            business.setLongitude(point.get().lng());
            if (business.getAddress() == null || business.getAddress().isBlank()) {
                business.setAddress(query);
            }
            log.info("Cached geo for business {} -> {},{}", business.getId(), point.get().lat(), point.get().lng());
        }
        return businessRepository.save(business);
    }

    @Transactional
    public void geocodeAndSave(Business business, String addressHint) {
        if (addressHint != null && !addressHint.isBlank()) {
            business.setAddress(addressHint.trim());
        }
        // Force re-resolve even if a previous geoQuery matched.
        business.setLatitude(null);
        business.setLongitude(null);
        business.setGeoQuery("");
        ensureCoordinates(business);
    }

    private String merchantAddress(String merchantId) {
        if (merchantId == null || merchantId.isBlank()) return null;
        try {
            return merchantRepository.findById(UUID.fromString(merchantId))
                    .map(Merchant::getBusinessAddress)
                    .filter(a -> a != null && !a.isBlank())
                    .orElse(null);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }
}
