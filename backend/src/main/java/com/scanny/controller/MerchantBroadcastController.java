package com.scanny.controller;

import com.scanny.dto.PlatformBroadcastDtos;
import com.scanny.service.PlatformBroadcastService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/merchant/broadcasts")
public class MerchantBroadcastController {

    private final PlatformBroadcastService platformBroadcastService;

    public MerchantBroadcastController(PlatformBroadcastService platformBroadcastService) {
        this.platformBroadcastService = platformBroadcastService;
    }

    @GetMapping
    public PlatformBroadcastDtos.MerchantBroadcastListResponse list() {
        return platformBroadcastService.listForMerchant();
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@PathVariable UUID id) {
        platformBroadcastService.markRead(id);
    }

    @PostMapping("/{id}/dismiss")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dismiss(@PathVariable UUID id) {
        platformBroadcastService.dismiss(id);
    }
}
