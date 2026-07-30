package com.scanny.util;

public final class PhoneUtils {

    private PhoneUtils() {}

    /**
     * Normalize to digits for Meta WhatsApp ({@code to} field).
     * Uganda locals: {@code 07xxxxxxxx} / {@code 7xxxxxxxx} → {@code 2567xxxxxxxx}.
     */
    public static String normalize(String phone) {
        if (phone == null) {
            return "";
        }
        String digits = phone.replaceAll("\\D", "");
        if (digits.startsWith("00") && digits.length() > 4) {
            digits = digits.substring(2);
        }
        // Local UG: 07xxxxxxxx → 2567xxxxxxxx
        if (digits.startsWith("0") && digits.length() == 10) {
            return "256" + digits.substring(1);
        }
        // Local UG without leading 0: 7xxxxxxxx (9 digits)
        if (digits.length() == 9 && digits.startsWith("7")) {
            return "256" + digits;
        }
        return digits;
    }

    public static boolean matches(String left, String right) {
        return !normalize(left).isBlank() && normalize(left).equals(normalize(right));
    }
}
