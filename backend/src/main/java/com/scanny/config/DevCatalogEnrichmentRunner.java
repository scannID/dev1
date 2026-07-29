package com.scanny.config;

import com.scanny.entity.Business;
import com.scanny.entity.CatalogItem;
import com.scanny.model.enums.BusinessType;
import com.scanny.model.enums.ItemKind;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.CatalogItemRepository;
import com.scanny.service.BusinessService;
import com.scanny.service.OperationsService;
import com.scanny.service.StarterCatalogService;
import com.scanny.service.StarterCatalogService.FoodSpec;
import com.scanny.service.StarterCatalogService.LodgingSpec;
import com.scanny.util.CatalogCategories;
import com.scanny.util.JsonLists;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ensures every local restaurant / bar / hotel has a high-end catalog
 * (food + rooms/suites). Idempotent — skips items that already exist by id or name.
 */
@Component
@Profile("h2")
@Order(2)
public class DevCatalogEnrichmentRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevCatalogEnrichmentRunner.class);

    private final BusinessRepository businessRepository;
    private final CatalogItemRepository catalogItemRepository;
    private final StarterCatalogService starterCatalogService;
    private final BusinessService businessService;
    private final OperationsService operationsService;

    public DevCatalogEnrichmentRunner(
            BusinessRepository businessRepository,
            CatalogItemRepository catalogItemRepository,
            StarterCatalogService starterCatalogService,
            BusinessService businessService,
            OperationsService operationsService
    ) {
        this.businessRepository = businessRepository;
        this.catalogItemRepository = catalogItemRepository;
        this.starterCatalogService = starterCatalogService;
        this.businessService = businessService;
        this.operationsService = operationsService;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int added = 0;
        for (Business business : businessRepository.findAll()) {
            if (!business.isPrimary()) {
                continue;
            }
            added += enrich(business);
        }
        // Demo hotel if none exists yet
        boolean hasHotel = businessRepository.findAll().stream()
                .anyMatch(b -> b.getType() == BusinessType.Hotel);
        if (!hasHotel) {
            added += seedDemoHotel();
        }
        int restored = restoreMerchantUploadedCovers();
        int synced = 0;
        Set<String> merchantIds = new HashSet<>();
        for (Business business : businessRepository.findAll()) {
            if (business.getMerchantId() != null && !business.getMerchantId().isBlank()) {
                merchantIds.add(business.getMerchantId());
            }
        }
        for (String merchantId : merchantIds) {
            synced += operationsService.syncAllBranchMediaFromMain(merchantId);
        }
        if (added > 0) {
            log.info("Enriched local catalogs with {} high-end items", added);
        }
        if (restored > 0) {
            log.info("Restored merchant-uploaded covers on {} catalog items (removed stock placeholders)", restored);
        }
        if (synced > 0) {
            log.info("Synced {} item photos from Main onto sibling branch catalogs", synced);
        }
    }

    /**
     * Undo stock Unsplash covers. Prefer a merchant-uploaded gallery image
     * (data:image or non-unsplash URL); otherwise clear so the UI can fall back cleanly.
     */
    private int restoreMerchantUploadedCovers() {
        int updated = 0;
        Set<String> touchedBusinesses = new HashSet<>();
        for (CatalogItem item : catalogItemRepository.findAll()) {
            String cover = item.getImageUrl();
            List<String> gallery = JsonLists.readStringList(item.getImageUrlsJson());
            String uploaded = firstUploadedImage(gallery);
            if (uploaded == null && isUploadedImage(cover)) {
                continue;
            }
            if (!isStockImage(cover) && uploaded == null) {
                continue;
            }

            String nextCover = uploaded;
            if (nextCover == null && isUploadedImage(cover)) {
                nextCover = cover;
            }
            // Drop stock URLs from gallery so menu never prefers them again.
            List<String> cleanedGallery = gallery.stream().filter(this::isUploadedImage).toList();
            if (nextCover != null && cleanedGallery.isEmpty()) {
                cleanedGallery = List.of(nextCover);
            }

            boolean changed = false;
            if (nextCover == null || !nextCover.equals(cover)) {
                item.setImageUrl(nextCover);
                changed = true;
            }
            String nextGalleryJson = JsonLists.writeStringList(cleanedGallery);
            if (!nextGalleryJson.equals(item.getImageUrlsJson() == null ? "[]" : item.getImageUrlsJson())) {
                item.setImageUrlsJson(nextGalleryJson);
                changed = true;
            }
            if (!changed) {
                continue;
            }
            catalogItemRepository.save(item);
            updated++;
            if (item.getBusiness() != null && item.getBusiness().getId() != null) {
                touchedBusinesses.add(item.getBusiness().getId());
            }
        }
        for (String businessId : touchedBusinesses) {
            businessService.evictMenuCache(businessId);
        }
        return updated;
    }

    private String firstUploadedImage(List<String> urls) {
        if (urls == null) {
            return null;
        }
        for (String url : urls) {
            if (isUploadedImage(url)) {
                return url;
            }
        }
        return null;
    }

    private boolean isStockImage(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        String lower = url.toLowerCase(Locale.ROOT);
        return lower.contains("images.unsplash.com") || lower.contains("source.unsplash.com");
    }

    private boolean isUploadedImage(String url) {
        if (url == null || url.isBlank() || isStockImage(url)) {
            return false;
        }
        String trimmed = url.trim();
        return trimmed.startsWith("data:image/")
                || trimmed.startsWith("http://")
                || trimmed.startsWith("https://");
    }

    private int enrich(Business business) {
        BusinessType type = business.getType() != null ? business.getType() : BusinessType.Restaurant;
        Set<String> existingNames = new HashSet<>();
        Set<String> existingIds = new HashSet<>();
        for (CatalogItem item : catalogItemRepository.findByBusiness_IdOrderByNameAsc(business.getId())) {
            existingNames.add(normalize(item.getName()));
            existingIds.add(item.getId());
        }

        int added = 0;
        List<FoodSpec> foods = switch (type) {
            case Bar -> starterCatalogService.premiumBarFood();
            case Hotel -> starterCatalogService.premiumHotelFood();
            case Restaurant, School, Boutique -> starterCatalogService.premiumRestaurantFood();
        };

        // Boutique/School get a lighter pass — only Restaurant-like venues get full premium food
        if (type == BusinessType.School || type == BusinessType.Boutique) {
            return 0;
        }

        int seq = existingIds.size() + 1;
        for (FoodSpec spec : foods) {
            if (existingNames.contains(normalize(spec.name()))) {
                continue;
            }
            String id = uniqueId(business.getId(), slug(spec.name()), existingIds, seq++);
            CatalogItem item = new CatalogItem();
            item.setId(id);
            item.setBusiness(business);
            item.setName(spec.name());
            item.setCategory(spec.category());
            item.setPrice(spec.price());
            item.setDescription(spec.description());
            item.setAvailable(true);
            item.setItemKind(ItemKind.FOOD);
            catalogItemRepository.save(item);
            business.addCustomCategory(spec.category());
            existingNames.add(normalize(spec.name()));
            existingIds.add(id);
            added++;
        }

        if (type == BusinessType.Hotel) {
            for (LodgingSpec spec : starterCatalogService.premiumHotelRooms()) {
                if (existingNames.contains(normalize(spec.name()))) {
                    continue;
                }
                String id = uniqueId(business.getId(), slug(spec.name()), existingIds, seq++);
                CatalogItem item = new CatalogItem();
                item.setId(id);
                item.setBusiness(business);
                item.setName(spec.name());
                item.setCategory(spec.category());
                item.setPrice(spec.price());
                item.setDescription(spec.description());
                item.setAvailable(true);
                item.setItemKind(spec.kind());
                item.setCapacity(spec.capacity());
                item.setUnitsAvailable(spec.units());
                item.setAmenitiesJson(spec.amenitiesJson());
                catalogItemRepository.save(item);
                business.addCustomCategory(spec.category());
                existingNames.add(normalize(spec.name()));
                existingIds.add(id);
                added++;
            }
            for (String category : CatalogCategories.defaultNames(BusinessType.Hotel)) {
                business.addCustomCategory(category);
            }
        }

        if (added > 0) {
            businessRepository.save(business);
        }
        return added;
    }

    private int seedDemoHotel() {
        Business hotel = new Business();
        hotel.setId("lakeview-grand");
        hotel.setMerchantId("MER-LVG-2001");
        hotel.setQrToken("SIT-LVG-2001");
        hotel.setName("Lakeview Grand Hotel");
        hotel.setOwnerName("Demo Hotel");
        hotel.setPhone("");
        hotel.setType(BusinessType.Hotel);
        hotel.setTableLabel("Room number or guest name");
        hotel.setPaymentReference("PAY-LVG-2001");
        hotel.setAccent("#0f766e");
        hotel.setCustomCategories(new java.util.ArrayList<>(CatalogCategories.defaultNames(BusinessType.Hotel)));
        businessRepository.save(hotel);

        int added = 0;
        int seq = 1;
        for (FoodSpec spec : starterCatalogService.premiumHotelFood()) {
            CatalogItem item = new CatalogItem();
            item.setId(hotel.getId() + "-" + seq++);
            item.setBusiness(hotel);
            item.setName(spec.name());
            item.setCategory(spec.category());
            item.setPrice(spec.price());
            item.setDescription(spec.description());
            item.setAvailable(true);
            item.setItemKind(ItemKind.FOOD);
            catalogItemRepository.save(item);
            added++;
        }
        for (LodgingSpec spec : starterCatalogService.premiumHotelRooms()) {
            CatalogItem item = new CatalogItem();
            item.setId(hotel.getId() + "-" + seq++);
            item.setBusiness(hotel);
            item.setName(spec.name());
            item.setCategory(spec.category());
            item.setPrice(spec.price());
            item.setDescription(spec.description());
            item.setAvailable(true);
            item.setItemKind(spec.kind());
            item.setCapacity(spec.capacity());
            item.setUnitsAvailable(spec.units());
            item.setAmenitiesJson(spec.amenitiesJson());
            catalogItemRepository.save(item);
            added++;
        }
        log.info("Seeded demo hotel Lakeview Grand with {} catalog items", added);
        return added;
    }

    private static String uniqueId(String businessId, String slug, Set<String> existingIds, int seq) {
        String base = businessId + "-hx-" + slug;
        if (!existingIds.contains(base)) {
            return base;
        }
        String alt = businessId + "-hx-" + seq + "-" + slug;
        return existingIds.contains(alt) ? businessId + "-hx-" + System.nanoTime() : alt;
    }

    private static String slug(String name) {
        return name.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
    }

    private static String normalize(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
    }
}
