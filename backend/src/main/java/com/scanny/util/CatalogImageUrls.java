package com.scanny.util;

import com.scanny.exception.ApiException;
import java.util.ArrayList;
import java.util.List;

public final class CatalogImageUrls {

    private static final int MAX_LENGTH = 500_000;
    public static final int MAX_GALLERY_IMAGES = 8;

    private CatalogImageUrls() {
    }

    public static String normalizeOptional(String imageUrl) {
        if (imageUrl == null) {
            return null;
        }
        String trimmed = imageUrl.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        validateSingle(trimmed);
        return trimmed;
    }

    public static List<String> normalizeGallery(List<String> imageUrls) {
        if (imageUrls == null || imageUrls.isEmpty()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (String raw : imageUrls) {
            String normalized = normalizeOptional(raw);
            if (normalized != null) {
                out.add(normalized);
            }
            if (out.size() > MAX_GALLERY_IMAGES) {
                throw new ApiException(400, "A suite or room can have at most " + MAX_GALLERY_IMAGES + " photos.");
            }
        }
        return List.copyOf(out);
    }

    private static void validateSingle(String trimmed) {
        if (trimmed.length() > MAX_LENGTH) {
            throw new ApiException(400, "Item image is too large. Maximum size is 500KB.");
        }
        if (!trimmed.startsWith("data:image/")
                && !trimmed.startsWith("http://")
                && !trimmed.startsWith("https://")) {
            throw new ApiException(400, "Item image must be an uploaded image or a valid image URL.");
        }
    }
}
