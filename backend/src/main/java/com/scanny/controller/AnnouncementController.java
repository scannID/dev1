package com.scanny.controller;

import com.scanny.dto.AnnouncementDtos;
import com.scanny.service.AnnouncementService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/businesses/{businessId}/announcements")
public class AnnouncementController {

    private final AnnouncementService announcementService;

    public AnnouncementController(AnnouncementService announcementService) {
        this.announcementService = announcementService;
    }

    /** Merchant: list all announcements for a business */
    @GetMapping
    public AnnouncementDtos.AnnouncementsListResponse list(
            @PathVariable String businessId
    ) {
        return announcementService.list(businessId);
    }

    /** Merchant: create a new announcement */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AnnouncementDtos.AnnouncementResponse create(
            @PathVariable String businessId,
            @RequestBody AnnouncementDtos.CreateAnnouncementRequest request
    ) {
        return announcementService.create(businessId, request);
    }

    /** Merchant: update an existing announcement */
    @PatchMapping("/{announcementId}")
    public AnnouncementDtos.AnnouncementResponse update(
            @PathVariable String businessId,
            @PathVariable String announcementId,
            @RequestBody AnnouncementDtos.UpdateAnnouncementRequest request
    ) {
        return announcementService.update(businessId, announcementId, request);
    }

    /** Merchant: delete an announcement */
    @DeleteMapping("/{announcementId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable String businessId,
            @PathVariable String announcementId
    ) {
        announcementService.delete(businessId, announcementId);
    }

    /** Public (no auth): active announcements shown to customers after QR scan */
    @GetMapping("/public")
    public AnnouncementDtos.AnnouncementsListResponse listPublic(
            @PathVariable String businessId
    ) {
        return announcementService.listPublic(businessId);
    }
}
