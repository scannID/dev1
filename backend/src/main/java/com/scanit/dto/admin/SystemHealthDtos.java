package com.scanit.dto.admin;

import java.util.List;

public class SystemHealthDtos {

    public record ServiceHealth(
        String name,
        String status,
        String uptime,
        Integer latency,
        String unit,
        Integer incidents
    ) {}

    public record OverallHealth(
        String status,
        String uptime,
        Integer avgLatency,
        Integer openIncidents,
        Double errorRate
    ) {}

    public record SystemHealthResponse(
        List<ServiceHealth> services,
        OverallHealth overall
    ) {}
}
