package com.scanny.service;

import com.scanny.entity.CatalogItem;
import com.scanny.model.enums.BusinessType;
import com.scanny.model.enums.ItemKind;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class StarterCatalogService {

    public List<CatalogItem> buildStarterItems(BusinessType type, String businessId) {
        List<CatalogItem> items = new ArrayList<>();
        int index = 1;

        switch (type != null ? type : BusinessType.Restaurant) {
            case Restaurant -> {
                index = addFood(items, businessId, index, premiumRestaurantFood());
            }
            case Bar -> {
                index = addFood(items, businessId, index, premiumBarFood());
            }
            case School -> {
                index = addFood(items, businessId, index, List.of(
                        food("Lunch plate", "Meals", 8000, "Balanced canteen plate with protein, starch, and greens."),
                        food("Term event ticket", "Tickets", 10000, "Entry for the term school event.")
                ));
            }
            case Boutique -> {
                index = addFood(items, businessId, index, List.of(
                        food("Featured item", "Goods", 35000, "Curated retail pick ready for pricing."),
                        food("Delivery booking", "Services", 5000, "Same-day delivery within the city.")
                ));
            }
            case Hotel -> {
                index = addFood(items, businessId, index, premiumHotelFood());
                index = addLodging(items, businessId, index, premiumHotelRooms());
            }
        }

        return items;
    }

    /** High-end eats used for restaurants and hotel dining. */
    public List<FoodSpec> premiumRestaurantFood() {
        return List.of(
                food("Wagyu Ribeye", "Meals", 95000, "Australian wagyu, bone marrow butter, roasted bone marrow."),
                food("Lobster Thermidor", "Meals", 120000, "Half lobster, cognac cream, gruyère crust."),
                food("Truffle Tagliatelle", "Meals", 68000, "Fresh pasta, black truffle, aged parmesan."),
                food("Seared Sea Bass", "Meals", 78000, "Crispy skin sea bass, saffron beurre blanc, fennel."),
                food("Duck Confit", "Meals", 72000, "Slow-cooked duck leg, cherry gastrique, potato gratin."),
                food("Caviar Blinis", "Bites", 85000, "Oscietra caviar, crème fraîche, warm blinis."),
                food("Truffle Fries", "Sides", 28000, "Shoestring fries, truffle oil, parmesan."),
                food("Champagne Cocktail", "Drinks", 45000, "Vintage sparkling, cognac, angostura, citrus."),
                food("Passion Mojito", "Drinks", 22000, "Fresh passion, mint, lime, soda."),
                food("Espresso Martini", "Drinks", 32000, "Vodka, fresh espresso, coffee liqueur."),
                food("Molten Chocolate Soufflé", "Desserts", 38000, "Warm soufflé, vanilla bean ice cream.")
        );
    }

    public List<FoodSpec> premiumBarFood() {
        return List.of(
                food("Signature Old Fashioned", "Drinks", 35000, "Bourbon, demerara, bitters, orange oil."),
                food("Espresso Martini", "Drinks", 32000, "Vodka, fresh espresso, coffee liqueur."),
                food("Aperol Spritz", "Drinks", 28000, "Aperol, prosecco, soda, orange."),
                food("House Negroni", "Drinks", 30000, "Gin, Campari, sweet vermouth."),
                food("Wagyu Sliders", "Bites", 48000, "Three wagyu sliders, caramelised onion, aged cheddar."),
                food("Oysters Rockefeller", "Bites", 55000, "Half dozen oysters, spinach, Pernod butter."),
                food("Truffle Fries", "Bites", 28000, "Shoestring fries, truffle oil, parmesan."),
                food("VIP Night Pass", "Tickets", 75000, "Priority entry and one welcome cocktail.")
        );
    }

    public List<FoodSpec> premiumHotelFood() {
        return List.of(
                food("Wagyu Ribeye", "Meals", 98000, "Australian wagyu, bone marrow butter, seasonal greens."),
                food("Lobster Thermidor", "Meals", 125000, "Half lobster, cognac cream, gruyère crust."),
                food("Truffle Tagliatelle", "Meals", 70000, "Fresh pasta, black truffle, aged parmesan."),
                food("Club Sandwich", "Meals", 42000, "Triple-decker, fries, house pickles."),
                food("Champagne Cocktail", "Drinks", 48000, "Vintage sparkling, cognac, angostura."),
                food("Passion Mojito", "Drinks", 22000, "Fresh passion, mint, lime, soda."),
                food("Afternoon High Tea", "Bites", 65000, "Scones, savouries, petit fours for two."),
                food("Molten Chocolate Soufflé", "Desserts", 38000, "Warm soufflé, vanilla bean ice cream.")
        );
    }

    public List<LodgingSpec> premiumHotelRooms() {
        return List.of(
                lodging("Deluxe King Room", "Rooms", ItemKind.ROOM, 280000, 2, 8,
                        "[\"Wi-Fi\",\"AC\",\"King bed\",\"Ensuite\",\"Mini bar\"]",
                        "King bed, city view, marble bathroom, 24h room service."),
                lodging("Twin Garden Room", "Rooms", ItemKind.ROOM, 260000, 2, 6,
                        "[\"Wi-Fi\",\"AC\",\"Twin beds\",\"Garden view\",\"Ensuite\"]",
                        "Quiet garden-facing twin with lounge seating."),
                lodging("Family Connecting Rooms", "Rooms", ItemKind.ROOM, 420000, 4, 4,
                        "[\"Wi-Fi\",\"AC\",\"Connecting\",\"Sofa bed\",\"Ensuite\"]",
                        "Two connecting rooms for families, sofa bed included."),
                lodging("Executive Suite", "Suites", ItemKind.SUITE, 520000, 2, 4,
                        "[\"Wi-Fi\",\"AC\",\"Lounge\",\"Butler\",\"Jacuzzi\"]",
                        "Separate lounge, butler service, jacuzzi bath."),
                lodging("Presidential Suite", "Suites", ItemKind.SUITE, 980000, 4, 2,
                        "[\"Wi-Fi\",\"AC\",\"Dining room\",\"Butler\",\"Private terrace\"]",
                        "Private terrace, dining for six, dedicated butler."),
                lodging("Penthouse Suite", "Suites", ItemKind.SUITE, 1250000, 4, 1,
                        "[\"Wi-Fi\",\"AC\",\"Skyline view\",\"Private bar\",\"Hot tub\"]",
                        "Top-floor skyline suite with private bar and hot tub.")
        );
    }

    public String defaultTableLabel(BusinessType type) {
        if (type == BusinessType.Hotel) {
            return "Room number or guest name";
        }
        return type == BusinessType.Boutique
                ? "Delivery or pickup note"
                : "Table, seat, or location";
    }

    private int addFood(List<CatalogItem> items, String businessId, int index, List<FoodSpec> specs) {
        for (FoodSpec spec : specs) {
            CatalogItem item = new CatalogItem();
            item.setId(businessId + "-" + index++);
            item.setName(spec.name());
            item.setCategory(spec.category());
            item.setPrice(spec.price());
            item.setDescription(spec.description());
            item.setAvailable(true);
            item.setItemKind(ItemKind.FOOD);
            items.add(item);
        }
        return index;
    }

    private int addLodging(List<CatalogItem> items, String businessId, int index, List<LodgingSpec> specs) {
        for (LodgingSpec spec : specs) {
            CatalogItem item = new CatalogItem();
            item.setId(businessId + "-" + index++);
            item.setName(spec.name());
            item.setCategory(spec.category());
            item.setPrice(spec.price());
            item.setDescription(spec.description());
            item.setAvailable(true);
            item.setItemKind(spec.kind());
            item.setCapacity(spec.capacity());
            item.setUnitsAvailable(spec.units());
            item.setAmenitiesJson(spec.amenitiesJson());
            items.add(item);
        }
        return index;
    }

    private static FoodSpec food(String name, String category, int price, String description) {
        return new FoodSpec(name, category, price, description);
    }

    private static LodgingSpec lodging(
            String name,
            String category,
            ItemKind kind,
            int price,
            int capacity,
            int units,
            String amenitiesJson,
            String description
    ) {
        return new LodgingSpec(name, category, kind, price, capacity, units, amenitiesJson, description);
    }

    public record FoodSpec(String name, String category, int price, String description) {}

    public record LodgingSpec(
            String name,
            String category,
            ItemKind kind,
            int price,
            int capacity,
            int units,
            String amenitiesJson,
            String description
    ) {}
}
