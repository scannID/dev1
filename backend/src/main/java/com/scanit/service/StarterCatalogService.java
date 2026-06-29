package com.scanit.service;

import com.scanit.entity.Business;
import com.scanit.entity.CatalogItem;
import com.scanit.model.enums.BusinessType;
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
                    return item;
                })
                .toList();
    }

    public String defaultTableLabel(BusinessType type) {
        return type == BusinessType.Boutique
                ? "Delivery or pickup note"
                : "Table, seat, or location";
    }
}
