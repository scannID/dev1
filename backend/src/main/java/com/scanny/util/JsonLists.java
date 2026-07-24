package com.scanny.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.dto.CatalogIngredient;
import com.scanny.exception.ApiException;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public final class JsonLists {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<CatalogIngredient>> INGREDIENTS_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {};

    private JsonLists() {
    }

    public static List<CatalogIngredient> readIngredients(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<CatalogIngredient> parsed = MAPPER.readValue(json, INGREDIENTS_TYPE);
            if (parsed == null) {
                return List.of();
            }
            return parsed.stream()
                    .filter(item -> item != null && item.name() != null && !item.name().isBlank())
                    .map(item -> new CatalogIngredient(
                            item.id() == null || item.id().isBlank() ? newIngredientId() : item.id().trim(),
                            item.name().trim()
                    ))
                    .toList();
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    public static String writeIngredients(List<CatalogIngredient> ingredients) {
        List<CatalogIngredient> normalized = normalizeIngredients(ingredients);
        try {
            return MAPPER.writeValueAsString(normalized);
        } catch (JsonProcessingException e) {
            throw new ApiException(500, "Failed to serialize ingredients.");
        }
    }

    public static List<CatalogIngredient> normalizeIngredients(List<CatalogIngredient> ingredients) {
        if (ingredients == null || ingredients.isEmpty()) {
            return List.of();
        }
        List<CatalogIngredient> out = new ArrayList<>();
        for (CatalogIngredient item : ingredients) {
            if (item == null || item.name() == null) {
                continue;
            }
            String name = item.name().trim();
            if (name.isEmpty()) {
                continue;
            }
            String id = item.id() == null || item.id().isBlank() ? newIngredientId() : item.id().trim();
            out.add(new CatalogIngredient(id, name));
        }
        return List.copyOf(out);
    }

    public static List<String> readStringList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<String> parsed = MAPPER.readValue(json, STRING_LIST_TYPE);
            if (parsed == null) {
                return List.of();
            }
            return parsed.stream()
                    .filter(value -> value != null && !value.isBlank())
                    .map(String::trim)
                    .toList();
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    public static String writeStringList(List<String> values) {
        List<String> normalized = normalizeStringList(values);
        try {
            return MAPPER.writeValueAsString(normalized);
        } catch (JsonProcessingException e) {
            throw new ApiException(500, "Failed to serialize ingredient list.");
        }
    }

    public static List<String> normalizeStringList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
    }

    public static String newIngredientId() {
        return "ing-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
