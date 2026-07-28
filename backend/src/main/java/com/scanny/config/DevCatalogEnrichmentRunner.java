package com.scanny.config;

import com.scanny.entity.Business;
import com.scanny.entity.CatalogItem;
import com.scanny.model.enums.BusinessType;
import com.scanny.model.enums.ItemKind;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.CatalogItemRepository;
import com.scanny.service.StarterCatalogService;
import com.scanny.service.StarterCatalogService.FoodSpec;
import com.scanny.service.StarterCatalogService.LodgingSpec;
import com.scanny.util.CatalogCategories;
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

    public DevCatalogEnrichmentRunner(
            BusinessRepository businessRepository,
            CatalogItemRepository catalogItemRepository,
            StarterCatalogService starterCatalogService
    ) {
        this.businessRepository = businessRepository;
        this.catalogItemRepository = catalogItemRepository;
        this.starterCatalogService = starterCatalogService;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int added = 0;
        for (Business business : businessRepository.findAll()) {
            added += enrich(business);
        }
        // Demo hotel if none exists yet
        boolean hasHotel = businessRepository.findAll().stream()
                .anyMatch(b -> b.getType() == BusinessType.Hotel);
        if (!hasHotel) {
            added += seedDemoHotel();
        }
        if (added > 0) {
            log.info("Enriched local catalogs with {} high-end items", added);
        }
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
