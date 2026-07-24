package com.scanny.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.scanny.entity.CatalogItem;
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
        String details,
        List<CatalogIngredient> ingredients,
        boolean available
) {
    public static CatalogItemResponse from(CatalogItem item) {
        return new CatalogItemResponse(
                item.getId(),
                item.getName(),
                item.getCategory(),
                item.getPrice(),
                item.getDescription(),
                item.getImageUrl(),
                item.getDetails() == null ? "" : item.getDetails(),
                JsonLists.readIngredients(item.getIngredientsJson()),
                item.isAvailable()
        );
    }
}
