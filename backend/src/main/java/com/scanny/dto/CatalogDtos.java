package com.scanny.dto;

import com.scanny.entity.CatalogItem;
import com.scanny.util.JsonLists;
import java.util.List;

public class CatalogDtos {

    public record CreateCatalogItemRequest(
        String name,
        String category,
        int price,
        String description,
        String imageUrl,
        String details,
        List<CatalogIngredient> ingredients,
        boolean available,
        Integer discountPercent
    ) {}

    public record UpdateCatalogItemRequest(
        String name,
        String category,
        Integer price,
        String description,
        String imageUrl,
        String details,
        List<CatalogIngredient> ingredients,
        Boolean available,
        Integer discountPercent
    ) {}

    public record UpdateAvailabilityRequest(
        boolean available
    ) {}

    public record AddCategoryRequest(
        String name
    ) {}

    public record CategoriesResponse(
        List<String> categories
    ) {}

    public record CatalogItemResponse(
        String id,
        String name,
        String category,
        int price,
        String description,
        String imageUrl,
        String details,
        List<CatalogIngredient> ingredients,
        boolean available,
        int discountPercent
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
                item.isAvailable(),
                item.getDiscountPercent()
            );
        }
    }

    public record CatalogItemsPageResponse(
        List<CatalogItemResponse> items,
        PageDtos.PaginationMeta pagination
    ) {}
}
