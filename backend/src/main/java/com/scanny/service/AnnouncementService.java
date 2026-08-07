package com.scanny.service;

import com.scanny.dto.AnnouncementDtos;
import com.scanny.entity.Announcement;
import com.scanny.entity.Business;
import com.scanny.exception.ApiException;
import com.scanny.repository.AnnouncementRepository;
import com.scanny.repository.BusinessRepository;
import com.scanny.security.MerchantAccessService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class AnnouncementService {

    private final AnnouncementRepository announcementRepository;
    private final BusinessRepository businessRepository;
    private final MerchantAccessService merchantAccessService;

    public AnnouncementService(
            AnnouncementRepository announcementRepository,
            BusinessRepository businessRepository,
            MerchantAccessService merchantAccessService
    ) {
        this.announcementRepository = announcementRepository;
        this.businessRepository = businessRepository;
        this.merchantAccessService = merchantAccessService;
    }

    // ── Merchant: list all ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AnnouncementDtos.AnnouncementsListResponse list(String businessId) {
        merchantAccessService.requireOwnedBusiness(businessId);
        List<AnnouncementDtos.AnnouncementResponse> items =
            announcementRepository.findByBusiness_IdOrderByCreatedAtDesc(businessId)
                .stream()
                .map(AnnouncementDtos.AnnouncementResponse::from)
                .toList();
        return new AnnouncementDtos.AnnouncementsListResponse(items);
    }

    // ── Merchant: create ──────────────────────────────────────────────────────

    @Transactional
    public AnnouncementDtos.AnnouncementResponse create(
            String businessId,
            AnnouncementDtos.CreateAnnouncementRequest request
    ) {
        Business business = merchantAccessService.requireOwnedBusiness(businessId);

        if (request.title() == null || request.title().isBlank()) {
            throw new ApiException(400, "Title is required.");
        }

        Announcement ann = new Announcement();
        ann.setId("ANN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        ann.setBusiness(business);
        ann.setTitle(request.title().trim());
        ann.setBody(request.body() != null ? request.body().trim() : null);
        ann.setImageUrl(request.imageUrl());
        ann.setStartsAt(request.startsAt());
        ann.setEndsAt(request.endsAt());
        ann.setActive(true);

        ann = announcementRepository.save(ann);
        return AnnouncementDtos.AnnouncementResponse.from(ann);
    }

    // ── Merchant: update ──────────────────────────────────────────────────────

    @Transactional
    public AnnouncementDtos.AnnouncementResponse update(
            String businessId,
            String announcementId,
            AnnouncementDtos.UpdateAnnouncementRequest request
    ) {
        Announcement ann = requireOwned(businessId, announcementId);

        if (request.title() != null) {
            if (request.title().isBlank()) throw new ApiException(400, "Title cannot be empty.");
            ann.setTitle(request.title().trim());
        }
        if (request.body() != null) {
            ann.setBody(request.body().isBlank() ? null : request.body().trim());
        }
        // Only update imageUrl when the key is explicitly present AND non-null in the JSON.
        // A missing key serializes as null in Java records, so we can't distinguish
        // "not sent" from "explicitly cleared". The frontend must send empty string "" to clear.
        if (request.imageUrl() != null && !request.imageUrl().isEmpty()) {
            ann.setImageUrl(request.imageUrl());
        } else if (request.imageUrl() != null && request.imageUrl().isEmpty()) {
            // Explicit empty string = clear the image
            ann.setImageUrl(null);
        }
        if (request.startsAt() != null) ann.setStartsAt(request.startsAt());
        if (request.endsAt()   != null) ann.setEndsAt(request.endsAt());
        if (request.active()   != null) ann.setActive(request.active());

        ann.setUpdatedAt(Instant.now());
        ann = announcementRepository.save(ann);
        return AnnouncementDtos.AnnouncementResponse.from(ann);
    }

    // ── Merchant: delete ──────────────────────────────────────────────────────

    @Transactional
    public void delete(String businessId, String announcementId) {
        Announcement ann = requireOwned(businessId, announcementId);
        announcementRepository.delete(ann);
    }

    // ── Public (customer): active announcements ───────────────────────────────

    @Transactional(readOnly = true)
    public AnnouncementDtos.AnnouncementsListResponse listPublic(String businessId) {
        // Verify business exists (public — no auth check needed)
        businessRepository.findById(businessId)
            .orElseThrow(() -> new ApiException(404, "Business not found."));

        List<AnnouncementDtos.AnnouncementResponse> items =
            announcementRepository.findActiveForBusiness(businessId, Instant.now())
                .stream()
                .map(AnnouncementDtos.AnnouncementResponse::from)
                .toList();
        return new AnnouncementDtos.AnnouncementsListResponse(items);
    }

    // ── private helpers ───────────────────────────────────────────────────────

    private Announcement requireOwned(String businessId, String announcementId) {
        merchantAccessService.assertOwnsBusinessId(businessId);
        Announcement ann = announcementRepository.findById(announcementId)
            .orElseThrow(() -> new ApiException(404, "Announcement not found."));
        if (!ann.getBusiness().getId().equals(businessId)) {
            throw new ApiException(403, "Announcement does not belong to this business.");
        }
        return ann;
    }
}
