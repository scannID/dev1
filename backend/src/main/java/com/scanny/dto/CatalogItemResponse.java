package com.scanny.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.scanny.entity.CatalogItem;
import com.scanny.model.enums.ItemKind;
import com.scanny.util.CatalogItemImages;
import com.scanny.util.JsonLists;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CatalogItemResponse(
        String id,
        String name,
        String category,
        int price,
        String description,
        String imageUrl,
        List<String> imageUrls,
        String details,
        List<CatalogIngredient> ingredients,
        boolean available,
        int discountPercent,
        ItemKind itemKind,
        Integer capacity,
        List<String> amenities,
        Integer unitsAvailable
) {
    public static CatalogItemResponse from(CatalogItem item) {
        List<String> gallery = JsonLists.readStringList(item.getImageUrlsJson()).stream()
                .filter(CatalogItemImages::isUsable)
                .toList();
        String cover = CatalogItemImages.pickCover(item.getImageUrl(), gallery);
        return new CatalogItemResponse(
                item.getId(),
                item.getName(),
                item.getCategory(),
                item.getPrice(),
                item.getDescription(),
                cover,
                gallery.isEmpty() ? null : gallery,
                item.getDetails() == null ? "" : item.getDetails(),
                JsonLists.readIngredients(item.getIngredientsJson()),
                item.isAvailable(),
                item.getDiscountPercent(),
                item.getItemKind(),
                item.isLodging() ? item.getCapacity() : null,
                item.isLodging() ? JsonLists.readStringList(item.getAmenitiesJson()) : null,
                item.isLodging() ? item.getUnitsAvailable() : null
        );
    }
}
