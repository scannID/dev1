package com.scanny.service;

import com.scanny.entity.Business;
import com.scanny.entity.CatalogItem;
import com.scanny.model.enums.BusinessType;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class StarterCatalogService {

    public List<CatalogItem> buildStarterItems(BusinessType type, String businessId) {
        List<String[]> starters = switch (type != null ? type : BusinessType.Restaurant) {
            case Restaurant -> List.of(
                    new String[]{"Main meal", "Meals", "15000", "Starter food item ready for pricing."},
                    new String[]{"Fresh juice", "Drinks", "5000", "Starter drink item ready for pricing."}
            );
            case Bar -> List.of(
                    new String[]{"House drink", "Drinks", "10000", "Starter drink item ready for pricing."},
                    new String[]{"Event ticket", "Tickets", "25000", "Starter ticket item ready for ticketing."}
            );
            case School -> List.of(
                    new String[]{"Lunch plate", "Meals", "8000", "Starter canteen item ready for pricing."},
                    new String[]{"Term event ticket", "Tickets", "10000", "Starter school ticket ready for events."}
            );
            case Boutique -> List.of(
                    new String[]{"Featured item", "Goods", "35000", "Starter retail item ready for pricing."},
                    new String[]{"Delivery booking", "Services", "5000", "Starter service item ready for orders."}
            );
            case Hotel -> List.of(
                    new String[]{"Main meal", "Meals", "15000", "Starter food item ready for pricing."},
                    new String[]{"Fresh juice", "Drinks", "5000", "Starter drink item ready for pricing."},
                    new String[]{"Standard Room", "Rooms", "180000", "Comfortable room with en-suite bathroom."},
                    new String[]{"Executive Suite", "Suites", "320000", "Spacious suite with lounge area and city view."}
            );
        };

        return java.util.stream.IntStream.range(0, starters.size())
                .mapToObj(index -> {
                    String[] row = starters.get(index);
                    CatalogItem item = new CatalogItem();
                    item.setId(businessId + "-" + (index + 1));
                    item.setName(row[0]);
                    item.setCategory(row[1]);
                    item.setPrice(Integer.parseInt(row[2]));
                    item.setDescription(row[3]);
                    item.setAvailable(true);
                    if ("Rooms".equals(row[1]) || "Suites".equals(row[1])) {
                        item.setItemKind("Suites".equals(row[1])
                                ? com.scanny.model.enums.ItemKind.SUITE
                                : com.scanny.model.enums.ItemKind.ROOM);
                        item.setCapacity(2);
                        item.setUnitsAvailable(3);
                        item.setAmenitiesJson("[\"Wi-Fi\",\"AC\",\"Ensuite\"]");
                    }
                    return item;
                })
                .toList();
    }

    public String defaultTableLabel(BusinessType type) {
        if (type == BusinessType.Hotel) {
            return "Room number or guest name";
        }
        return type == BusinessType.Boutique
                ? "Delivery or pickup note"
                : "Table, seat, or location";
    }
}
