package com.scanit.util;

public final class CodeUtils {

    private CodeUtils() {
    }

    public static String slugify(String value) {
        return value.toLowerCase()
                .trim()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
    }

    public static String makeCode(String prefix, String value) {
        String alpha = value.replaceAll("[^a-zA-Z]", "");
        if (alpha.isEmpty()) {
            alpha = "XXX";
        }
        alpha = alpha.substring(0, Math.min(3, alpha.length())).toUpperCase();
        while (alpha.length() < 3) {
            alpha += "X";
        }
        String suffix = String.valueOf(System.currentTimeMillis());
        return prefix + "-" + alpha + "-" + suffix.substring(suffix.length() - 6);
    }
}
