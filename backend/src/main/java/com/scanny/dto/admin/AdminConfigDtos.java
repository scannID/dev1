package com.scanny.dto.admin;

import java.util.Map;

public class AdminConfigDtos {

    public record ConfigSectionResponse(
        String section,
        Map<String, Object> config,
        String updatedAt,
        String updatedBy
    ) {}

    public record AllConfigsResponse(
        Map<String, Map<String, Object>> configs
    ) {}

    public record UpdateConfigRequest(
        Map<String, Object> config
    ) {}

    public record ActionResult(
        boolean success,
        String action,
        String message,
        Map<String, Object> details
    ) {}
}
