package com.scanny.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.scanny.exception.ApiException;
import org.junit.jupiter.api.Test;

class PhoneNormalizerTest {

    @Test
    void normalisesLocalFormatWithLeadingZero() {
        assertThat(PhoneNormalizer.normalize("0700123456")).isEqualTo("+256700123456");
    }

    @Test
    void normalisesLocalFormatWithoutLeadingZero() {
        assertThat(PhoneNormalizer.normalize("700123456")).isEqualTo("+256700123456");
    }

    @Test
    void normalisesCountryCodeWithoutPlus() {
        assertThat(PhoneNormalizer.normalize("256700123456")).isEqualTo("+256700123456");
    }

    @Test
    void normalisesAlreadyCanonical() {
        assertThat(PhoneNormalizer.normalize("+256700123456")).isEqualTo("+256700123456");
    }

    @Test
    void stripsSpacesAndDashes() {
        assertThat(PhoneNormalizer.normalize("0700-123-456")).isEqualTo("+256700123456");
        assertThat(PhoneNormalizer.normalize("0700 123 456")).isEqualTo("+256700123456");
    }

    @Test
    void returnsEmptyForBlankInput() {
        assertThat(PhoneNormalizer.normalize("")).isEmpty();
        assertThat(PhoneNormalizer.normalize(null)).isEmpty();
    }

    @Test
    void returnsNullForBlankOptional() {
        assertThat(PhoneNormalizer.normalizeOptional("")).isNull();
        assertThat(PhoneNormalizer.normalizeOptional(null)).isNull();
        assertThat(PhoneNormalizer.normalizeOptional("0700123456")).isEqualTo("+256700123456");
    }

    @Test
    void rejectsTooFewDigits() {
        assertThatThrownBy(() -> PhoneNormalizer.normalize("0700123"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid phone number");
    }

    @Test
    void rejectsTooManyDigits() {
        assertThatThrownBy(() -> PhoneNormalizer.normalize("070012345678"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid phone number");
    }
}
