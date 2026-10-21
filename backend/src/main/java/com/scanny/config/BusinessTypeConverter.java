package com.scanny.config;

import com.scanny.model.enums.BusinessType;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * JPA AttributeConverter for {@link BusinessType} that tolerates legacy
 * PascalCase values stored in the H2 dev database (e.g. {@code "Hotel"},
 * {@code "Restaurant"}) by normalising to UPPER_CASE before enum lookup.
 *
 * <p>This is needed because the dev H2 file database was written before the
 * enum names were standardised to UPPER_CASE. Production (PostgreSQL) always
 * had the correct casing. The converter is transparent for well-formed values.
 */
@Converter
public class BusinessTypeConverter implements AttributeConverter<BusinessType, String> {

    private static final Logger log = LoggerFactory.getLogger(BusinessTypeConverter.class);

    @Override
    public String convertToDatabaseColumn(BusinessType attribute) {
        return attribute != null ? attribute.name() : null;
    }

    @Override
    public BusinessType convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) return null;
        // Try exact match first (fast path for well-formed data)
        try {
            return BusinessType.valueOf(dbData);
        } catch (IllegalArgumentException e) {
            // Fall back to UPPER_CASE normalisation for legacy PascalCase values
            try {
                BusinessType normalised = BusinessType.valueOf(dbData.toUpperCase(java.util.Locale.ROOT));
                log.warn("[H2-compat] Normalised legacy BusinessType value '{}' → {}", dbData, normalised);
                return normalised;
            } catch (IllegalArgumentException ex) {
                log.warn("[H2-compat] Unknown BusinessType value '{}', defaulting to OTHER", dbData);
                return BusinessType.OTHER;
            }
        }
    }
}
