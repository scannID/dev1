package com.scanny.dto;

import com.scanny.entity.CatalogItem;

public class CatalogDtos {

    public record CreateCatalogItemRequest(
        String name,
        String category,
        int price,
        String description,
        boolean available
    ) {}

    public record UpdateCatalogItemRequest(
        String name,
        String category,
        Integer price,
        String description,
        Boolean available
    ) {}

    public record UpdateAvailabilityRequest(
        boolean available
    ) {}

    public record CatalogItemResponse(
        String id,
        String name,
        String category,
        int price,
        String description,
        boolean available
    ) {
        public static CatalogItemResponse from(CatalogItem item) {
            return new CatalogItemResponse(
                item.getId(),
                item.getName(),
                item.getCategory(),
                item.getPrice(),
                item.getDescription(),
                item.isAvailable()
            );
        }
    }
}
