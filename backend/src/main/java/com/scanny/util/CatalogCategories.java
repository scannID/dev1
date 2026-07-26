package com.scanny.util;

import com.scanny.entity.Business;
import com.scanny.entity.CatalogItem;
import com.scanny.model.enums.BusinessType;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

public final class CatalogCategories {

    private CatalogCategories() {
    }

    public static List<String> defaultNames(BusinessType type) {
        BusinessType resolved = type != null ? type : BusinessType.Restaurant;
        return switch (resolved) {
            case Restaurant -> List.of("Meals", "Drinks", "Bites", "Sides", "Desserts");
            case Bar -> List.of("Drinks", "Bites", "Tickets");
            case School -> List.of("Meals", "Snacks", "Tickets");
            case Boutique -> List.of("Goods", "Services");
            case Hotel -> List.of("Meals", "Drinks", "Bites", "Sides", "Desserts", "Rooms", "Suites");
        };
    }

    public static List<String> merged(Business business) {
        LinkedHashSet<String> names = new LinkedHashSet<>();
        if (business.getCustomCategories() != null) {
            business.getCustomCategories().stream()
                .map(CatalogCategories::normalize)
                .filter(name -> !name.isBlank())
                .forEach(names::add);
        }
        if (business.getItems() != null) {
            business.getItems().stream()
                .map(CatalogItem::getCategory)
                .map(CatalogCategories::normalize)
                .filter(name -> !name.isBlank())
                .forEach(names::add);
        }
        if (names.isEmpty()) {
            names.addAll(defaultNames(business.getType()));
        }
        return new ArrayList<>(names);
    }

    public static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String trimmed = raw.trim().replaceAll("\\s+", " ");
        if (trimmed.isEmpty()) {
            return "";
        }
        return trimmed.substring(0, 1).toUpperCase(Locale.ROOT) + trimmed.substring(1);
    }
}
