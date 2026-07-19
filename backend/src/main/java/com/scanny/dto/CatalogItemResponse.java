package com.scanny.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.scanny.entity.CatalogItem;

@JsonInclude(JsonInclude.Include.NON_NULL)
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
