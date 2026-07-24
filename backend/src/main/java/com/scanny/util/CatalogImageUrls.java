package com.scanny.util;

import com.scanny.exception.ApiException;

public final class CatalogImageUrls {

    private static final int MAX_LENGTH = 500_000;

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
        if (trimmed.length() > MAX_LENGTH) {
            throw new ApiException(400, "Item image is too large. Maximum size is 500KB.");
        }
        if (!trimmed.startsWith("data:image/")
                && !trimmed.startsWith("http://")
                && !trimmed.startsWith("https://")) {
            throw new ApiException(400, "Item image must be an uploaded image or a valid image URL.");
        }
        return trimmed;
    }
}
