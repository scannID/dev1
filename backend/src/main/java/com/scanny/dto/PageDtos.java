package com.scanny.dto;

import org.springframework.data.domain.Page;

public final class PageDtos {

    private PageDtos() {}

    public record PaginationMeta(
            int page,
            int size,
            long totalItems,
            int totalPages
    ) {
        public static PaginationMeta from(Page<?> page) {
            int totalPages = Math.max(page.getTotalPages(), page.getTotalElements() == 0 ? 1 : page.getTotalPages());
            if (totalPages < 1) {
                totalPages = 1;
            }
            return new PaginationMeta(
                    page.getNumber() + 1,
                    page.getSize(),
                    page.getTotalElements(),
                    totalPages
            );
        }

        public static PaginationMeta ofFullList(int total) {
            int size = Math.max(total, 1);
            return new PaginationMeta(1, size, total, 1);
        }
    }
}
