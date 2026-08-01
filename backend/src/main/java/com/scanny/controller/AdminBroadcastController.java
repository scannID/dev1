package com.scanny.controller;

import com.scanny.dto.PlatformBroadcastDtos;
import com.scanny.service.PlatformBroadcastService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/broadcasts")
public class AdminBroadcastController {

    private final PlatformBroadcastService platformBroadcastService;

    public AdminBroadcastController(PlatformBroadcastService platformBroadcastService) {
        this.platformBroadcastService = platformBroadcastService;
    }

    @GetMapping
    public PlatformBroadcastDtos.AdminBroadcastListResponse list() {
        return platformBroadcastService.listAdmin();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlatformBroadcastDtos.AdminBroadcastItem publish(
            @RequestBody PlatformBroadcastDtos.PublishBroadcastRequest request
    ) {
        return platformBroadcastService.publish(request);
    }

    @PostMapping("/{id}/revoke")
    public PlatformBroadcastDtos.AdminBroadcastItem revoke(@PathVariable UUID id) {
        return platformBroadcastService.revoke(id);
    }
}
