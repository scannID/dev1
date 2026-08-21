package com.scanny.dto;

import com.scanny.entity.Supplier;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public final class SupplierDtos {
    private SupplierDtos() {}

    public record SupplierResponse(
        String id, String name, String contactName, String phone,
        String email, String address, String notes,
        boolean active, Instant createdAt, Instant updatedAt
    ) {
        public static SupplierResponse from(Supplier s) {
            return new SupplierResponse(s.getId(), s.getName(), s.getContactName(),
                s.getPhone(), s.getEmail(), s.getAddress(), s.getNotes(),
                s.isActive(), s.getCreatedAt(), s.getUpdatedAt());
        }
    }

    public record CreateSupplierRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 255) String contactName,
        @Size(max = 64) String phone,
        @Size(max = 255) String email,
        String address,
        String notes
    ) {}

    public record UpdateSupplierRequest(
        @Size(max = 255) String name,
        @Size(max = 255) String contactName,
        @Size(max = 64) String phone,
        @Size(max = 255) String email,
        String address,
        String notes,
        Boolean active
    ) {}
}
