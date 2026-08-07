package com.scanny.dto;

import com.scanny.entity.Announcement;
import java.time.Instant;
import java.util.List;

public class AnnouncementDtos {

    public record CreateAnnouncementRequest(
        String title,
        String body,
        String imageUrl,
        Instant startsAt,
        Instant endsAt
    ) {}

    public record UpdateAnnouncementRequest(
        String title,
        String body,
        String imageUrl,
        Instant startsAt,
        Instant endsAt,
        Boolean active
    ) {}

    public record AnnouncementResponse(
        String id,
        String businessId,
        String title,
        String body,
        String imageUrl,
        Instant startsAt,
        Instant endsAt,
        boolean active,
        Instant createdAt,
        Instant updatedAt
    ) {
        public static AnnouncementResponse from(Announcement a) {
            return new AnnouncementResponse(
                a.getId(),
                a.getBusiness().getId(),
                a.getTitle(),
                a.getBody(),
                a.getImageUrl(),
                a.getStartsAt(),
                a.getEndsAt(),
                a.isActive(),
                a.getCreatedAt(),
                a.getUpdatedAt()
            );
        }
    }

    public record AnnouncementsListResponse(
        List<AnnouncementResponse> announcements
    ) {}
}
