package com.scanny.util;

import java.util.List;
import java.util.Locale;

/**
 * Helpers for choosing catalog cover images.
 * Merchant uploads (data URLs / normal https) win over stock placeholders.
 */
public final class CatalogItemImages {

    private CatalogItemImages() {
    }

    public static boolean isStock(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        String lower = url.toLowerCase(Locale.ROOT);
        return lower.contains("images.unsplash.com") || lower.contains("source.unsplash.com");
    }

    public static boolean isUsable(String url) {
        if (url == null || url.isBlank() || isStock(url)) {
            return false;
        }
        String trimmed = url.trim();
        return trimmed.startsWith("data:image/")
                || trimmed.startsWith("http://")
                || trimmed.startsWith("https://");
    }

    public static String pickCover(String imageUrl, List<String> gallery) {
        if (isUsable(imageUrl)) {
            return imageUrl.trim();
        }
        if (gallery != null) {
            for (String url : gallery) {
                if (isUsable(url)) {
                    return url.trim();
                }
            }
        }
        return null;
    }
}
