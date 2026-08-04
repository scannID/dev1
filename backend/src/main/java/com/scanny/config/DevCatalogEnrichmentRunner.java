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

        added += addSamanthaWorldMainsIfNeeded(business, existingNames, existingIds);

        if (added > 0) {
            businessRepository.save(business);
        }
        return added;
    }

    private int addSamanthaWorldMainsIfNeeded(
            Business business,
            Set<String> existingNames,
            Set<String> existingIds
    ) {
        if (!business.isPrimary()) {
            return 0;
        }
        boolean isSamanthaMain = "samantha-restaurant".equals(business.getId())
                || ("main".equalsIgnoreCase(business.getBranchLabel())
                && normalize(business.getName()).contains("samantha"));
        if (!isSamanthaMain) {
            return 0;
        }

        record MainFoodSpec(String id, String name, int price, String description) {}
        List<MainFoodSpec> mains = List.of(
                new MainFoodSpec("samantha-main-001", "Jollof Rice & Chicken", 24000, "West African jollof rice with grilled chicken."),
                new MainFoodSpec("samantha-main-002", "Chicken Biryani", 26000, "Fragrant basmati rice with spiced chicken."),
                new MainFoodSpec("samantha-main-003", "Beef Biryani", 27000, "Layered biryani rice with tender beef."),
                new MainFoodSpec("samantha-main-004", "Butter Chicken & Naan", 28000, "Creamy tomato chicken curry served with naan."),
                new MainFoodSpec("samantha-main-005", "Lamb Rogan Josh", 32000, "Slow-cooked Kashmiri lamb curry with rice."),
                new MainFoodSpec("samantha-main-006", "Paneer Tikka Masala", 25000, "Grilled paneer in rich masala sauce with rice."),
                new MainFoodSpec("samantha-main-007", "Thai Green Curry Chicken", 29000, "Coconut green curry with chicken and jasmine rice."),
                new MainFoodSpec("samantha-main-008", "Pad Thai Prawns", 30000, "Rice noodles, prawns, peanuts, and tamarind sauce."),
                new MainFoodSpec("samantha-main-009", "Nasi Goreng Special", 25000, "Indonesian fried rice with chicken and egg."),
                new MainFoodSpec("samantha-main-010", "Korean Beef Bulgogi Bowl", 31000, "Marinated beef with steamed rice and sesame."),
                new MainFoodSpec("samantha-main-011", "Japanese Chicken Katsu Curry", 28000, "Crispy chicken cutlet with curry sauce and rice."),
                new MainFoodSpec("samantha-main-012", "Ramen Chicken Shoyu", 27000, "Soy broth ramen with chicken and soft egg."),
                new MainFoodSpec("samantha-main-013", "Chinese Sweet & Sour Chicken", 26000, "Crispy chicken in sweet-sour glaze with rice."),
                new MainFoodSpec("samantha-main-014", "Kung Pao Beef", 29000, "Spicy stir-fried beef, peanuts, and peppers with rice."),
                new MainFoodSpec("samantha-main-015", "Vietnamese Pho Bo", 24000, "Rice noodle soup with aromatic beef broth."),
                new MainFoodSpec("samantha-main-016", "Filipino Chicken Adobo", 25000, "Soy-vinegar braised chicken with garlic rice."),
                new MainFoodSpec("samantha-main-017", "Mexican Chicken Fajita Plate", 28000, "Sizzling chicken fajitas with tortillas and salsa."),
                new MainFoodSpec("samantha-main-018", "Beef Burrito Bowl", 27000, "Seasoned beef, rice, beans, corn, and pico de gallo."),
                new MainFoodSpec("samantha-main-019", "Tacos al Pastor (3pc)", 26000, "Pork tacos with pineapple salsa and onions."),
                new MainFoodSpec("samantha-main-020", "Peruvian Lomo Saltado", 32000, "Stir-fried beef, onions, tomatoes, fries, and rice."),
                new MainFoodSpec("samantha-main-021", "Brazilian Feijoada", 30000, "Black bean and beef stew with rice and greens."),
                new MainFoodSpec("samantha-main-022", "Argentinian Grilled Steak Plate", 38000, "Char-grilled steak with chimichurri and potatoes."),
                new MainFoodSpec("samantha-main-023", "Italian Spaghetti Bolognese", 23000, "Pasta with slow-cooked beef tomato sauce."),
                new MainFoodSpec("samantha-main-024", "Fettuccine Alfredo Chicken", 26000, "Creamy Alfredo pasta topped with grilled chicken."),
                new MainFoodSpec("samantha-main-025", "Lasagna al Forno", 28000, "Oven-baked layered pasta with beef and cheese."),
                new MainFoodSpec("samantha-main-026", "Spanish Seafood Paella", 36000, "Saffron rice with prawns, fish, and mussels."),
                new MainFoodSpec("samantha-main-027", "Greek Chicken Souvlaki Plate", 29000, "Skewered chicken with pita, rice, and tzatziki."),
                new MainFoodSpec("samantha-main-028", "Turkish Doner Plate", 27000, "Sliced doner meat with rice, salad, and flatbread."),
                new MainFoodSpec("samantha-main-029", "Lebanese Chicken Shawarma Plate", 26000, "Marinated chicken with garlic sauce, rice, and pickles."),
                new MainFoodSpec("samantha-main-030", "Moroccan Lamb Tagine", 34000, "Aromatic lamb stew with apricot and couscous."),
                new MainFoodSpec("samantha-main-031", "Ethiopian Doro Wat", 28000, "Spiced chicken stew served with injera."),
                new MainFoodSpec("samantha-main-032", "Ugandan Luwombo Chicken", 25000, "Steamed chicken luwombo with matooke."),
                new MainFoodSpec("samantha-main-033", "Kenyan Nyama Choma Plate", 30000, "Grilled beef with kachumbari and ugali."),
                new MainFoodSpec("samantha-main-034", "Nigerian Egusi Soup & Pounded Yam", 29000, "Rich melon-seed soup served with pounded yam."),
                new MainFoodSpec("samantha-main-035", "South African Bobotie", 27000, "Cape Malay spiced mince bake with yellow rice."),
                new MainFoodSpec("samantha-main-036", "German Beef Goulash", 30000, "Paprika beef stew with buttered spaetzle."),
                new MainFoodSpec("samantha-main-037", "Polish Pierogi & Beef Sauce", 26000, "Potato-cheese dumplings with savory beef sauce."),
                new MainFoodSpec("samantha-main-038", "Russian Beef Stroganoff", 31000, "Creamy mushroom beef over buttered noodles."),
                new MainFoodSpec("samantha-main-039", "American BBQ Chicken Plate", 28000, "Smoky BBQ chicken with fries and coleslaw."),
                new MainFoodSpec("samantha-main-040", "Caribbean Jerk Chicken", 27000, "Spicy jerk chicken with rice and peas.")
        );

        int added = 0;
        for (MainFoodSpec spec : mains) {
            if (existingIds.contains(spec.id()) || existingNames.contains(normalize(spec.name()))) {
                continue;
            }
            CatalogItem item = new CatalogItem();
            item.setId(spec.id());
            item.setBusiness(business);
            item.setName(spec.name());
            item.setCategory("Main");
            item.setPrice(spec.price());
            item.setDescription(spec.description());
            item.setAvailable(true);
            item.setItemKind(ItemKind.FOOD);
            catalogItemRepository.save(item);
            business.addCustomCategory("Main");
            existingIds.add(spec.id());
            existingNames.add(normalize(spec.name()));
            added++;
        }
        if (added > 0) {
            log.info("Seeded {} Samantha Main world-food items for {}", added, business.getId());
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
