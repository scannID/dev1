package com.scanny.util;

import com.scanny.exception.ApiException;

/**
 * Normalises Ugandan phone numbers to the canonical {@code +256XXXXXXXXX} form.
 *
 * <p>Accepted input formats (all produce {@code +256700123456}):
 * <ul>
 *   <li>{@code 0700123456}   — local format with leading 0</li>
 *   <li>{@code 700123456}    — local format without leading 0</li>
 *   <li>{@code 256700123456} — country code without +</li>
 *   <li>{@code +256700123456} — already canonical</li>
 * </ul>
 *
 * <p>Network prefix is deliberately NOT inferred — the spec says "don't infer
 * the network from the prefix".  Validation only checks that the resulting
 * subscriber number is exactly 9 digits (Uganda's numbering plan).
 *
 * <p>Null and blank inputs are returned as-is (empty string) so callers can
 * decide whether the field is required.
 */
public final class PhoneNormalizer {

    private PhoneNormalizer() {}

    /**
     * Normalise a phone number string to {@code +256XXXXXXXXX}.
     *
     * @param raw the raw phone string from user input
     * @return the normalised form, or an empty string if {@code raw} is blank
     * @throws ApiException 400 if the number cannot be mapped to exactly 9
     *                      subscriber digits after stripping the Uganda prefix
     */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) return "";

        // Strip whitespace, dashes, spaces, dots
        String digits = raw.trim().replaceAll("[\\s\\-\\(\\)\\.]", "");

        if (digits.startsWith("+256")) {
            digits = digits.substring(4);
        } else if (digits.startsWith("256")) {
            digits = digits.substring(3);
        } else if (digits.startsWith("0")) {
            digits = digits.substring(1);
        }

        // Subscriber number must be exactly 9 digits for Uganda
        if (!digits.matches("\\d{9}")) {
            throw new ApiException(400,
                    "Invalid phone number '" + raw + "'. Expected a Ugandan number (9 subscriber digits).");
        }

        return "+256" + digits;
    }

    /**
     * Like {@link #normalize} but returns {@code null} rather than throwing when
     * the input is blank, so optional phone fields can pass through safely.
     */
    public static String normalizeOptional(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return normalize(raw);
    }
}
