package com.scanny.util;

public final class PhoneUtils {

    private PhoneUtils() {}

    public static String normalize(String phone) {
        if (phone == null) {
            return "";
        }
        String digits = phone.replaceAll("\\D", "");
        if (digits.startsWith("0") && digits.length() == 10) {
            return "256" + digits.substring(1);
        }
        return digits;
    }

    public static boolean matches(String left, String right) {
        return !normalize(left).isBlank() && normalize(left).equals(normalize(right));
    }
}
