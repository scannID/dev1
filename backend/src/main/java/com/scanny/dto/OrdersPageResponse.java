package com.scanny.dto;

import java.util.List;

public record OrdersPageResponse(
        List<OrderResponse> orders,
        PageDtos.PaginationMeta pagination
) {}
