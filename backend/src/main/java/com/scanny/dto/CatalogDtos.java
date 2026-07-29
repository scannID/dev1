package com.scanny.dto;

import com.scanny.entity.CatalogItem;
import com.scanny.model.enums.ItemKind;
import com.scanny.util.CatalogItemImages;
import com.scanny.util.JsonLists;
import java.util.List;

public class CatalogDtos {

    public record CreateCatalogItemRequest(
        String name,
        String category,
        int price,
        String description,
        String imageUrl,
        List<String> imageUrls,
        String details,
        List<CatalogIngredient> ingredients,
        boolean available,
        Integer discountPercent,
        ItemKind itemKind,
        Integer capacity,
        List<String> amenities,
        Integer unitsAvailable
    ) {}

    public record UpdateCatalogItemRequest(
        String name,
        String category,
        Integer price,
        String description,
        String imageUrl,
        List<String> imageUrls,
        String details,
        List<CatalogIngredient> ingredients,
        Boolean available,
        Integer discountPercent,
        ItemKind itemKind,
        Integer capacity,
        List<String> amenities,
        Integer unitsAvailable
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
        List<String> imageUrls,
        String details,
        List<CatalogIngredient> ingredients,
        boolean available,
        int discountPercent,
        ItemKind itemKind,
        int capacity,
        List<String> amenities,
        int unitsAvailable
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
                gallery,
                item.getDetails() == null ? "" : item.getDetails(),
                JsonLists.readIngredients(item.getIngredientsJson()),
                item.isAvailable(),
                item.getDiscountPercent(),
                item.getItemKind(),
                item.getCapacity(),
                JsonLists.readStringList(item.getAmenitiesJson()),
                item.getUnitsAvailable()
            );
        }
    }

    public record CatalogItemsPageResponse(
        List<CatalogItemResponse> items,
        PageDtos.PaginationMeta pagination
    ) {}
}
