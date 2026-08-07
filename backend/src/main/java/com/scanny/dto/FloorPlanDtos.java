package com.scanny.dto;

import com.scanny.entity.FloorPlan;
import com.scanny.entity.FloorPlanElement;
import com.scanny.entity.FloorPlanElementStatus;
import com.scanny.entity.FloorPlanTemplate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class FloorPlanDtos {

    private FloorPlanDtos() {}

    // -------------------------------------------------------------------------
    // Floor Plan summary (list view — no elements)
    // -------------------------------------------------------------------------

    public record FloorPlanSummary(
            String id,
            String businessId,
            String name,
            int canvasWidth,
            int canvasHeight,
            int gridSize,
            String backgroundImage,
            String createdAt,
            String updatedAt
    ) {
        public static FloorPlanSummary from(FloorPlan fp) {
            return new FloorPlanSummary(
                    fp.getId(),
                    fp.getBusiness().getId(),
                    fp.getName(),
                    fp.getCanvasWidth(),
                    fp.getCanvasHeight(),
                    fp.getGridSize(),
                    fp.getBackgroundImage(),
                    fp.getCreatedAt().toString(),
                    fp.getUpdatedAt() != null ? fp.getUpdatedAt().toString() : null
            );
        }
    }

    // -------------------------------------------------------------------------
    // Element DTO (used inside full plan response)
    // -------------------------------------------------------------------------

    public record ElementResponse(
            String id,
            String floorPlanId,
            String shapeType,
            double x,
            double y,
            double width,
            double height,
            double rotation,
            int zIndex,
            String color,
            String elementKind,
            String label,
            int seatCount,
            String parentElementId,
            String businessTableId,
            String businessTableLabel,
            String createdAt
    ) {
        public static ElementResponse from(FloorPlanElement e) {
            return new ElementResponse(
                    e.getId(),
                    e.getFloorPlan().getId(),
                    e.getShapeType(),
                    e.getX().doubleValue(),
                    e.getY().doubleValue(),
                    e.getWidth().doubleValue(),
                    e.getHeight().doubleValue(),
                    e.getRotation().doubleValue(),
                    e.getZIndex(),
                    e.getColor(),
                    e.getElementKind(),
                    e.getLabel(),
                    e.getSeatCount(),
                    e.getParent() != null ? e.getParent().getId() : null,
                    e.getBusinessTable() != null ? e.getBusinessTable().getId() : null,
                    e.getBusinessTable() != null ? e.getBusinessTable().getLabel() : null,
                    e.getCreatedAt().toString()
            );
        }
    }

    // -------------------------------------------------------------------------
    // Full plan with elements
    // -------------------------------------------------------------------------

    public record FloorPlanResponse(
            String id,
            String businessId,
            String name,
            int canvasWidth,
            int canvasHeight,
            int gridSize,
            String backgroundImage,
            List<ElementResponse> elements,
            String createdAt,
            String updatedAt
    ) {
        public static FloorPlanResponse from(FloorPlan fp) {
            return new FloorPlanResponse(
                    fp.getId(),
                    fp.getBusiness().getId(),
                    fp.getName(),
                    fp.getCanvasWidth(),
                    fp.getCanvasHeight(),
                    fp.getGridSize(),
                    fp.getBackgroundImage(),
                    fp.getElements().stream().map(ElementResponse::from).toList(),
                    fp.getCreatedAt().toString(),
                    fp.getUpdatedAt() != null ? fp.getUpdatedAt().toString() : null
            );
        }
    }

    // -------------------------------------------------------------------------
    // Live snapshot — plan + per-element occupancy status
    // -------------------------------------------------------------------------

    public record ElementStatusSnapshot(
            String elementId,
            String status,
            String sessionId,
            String reservationId,
            String tableLabel,
            String sessionOpenedAt,
            String guestName,
            Integer partySize,
            Integer unpaidTotal,
            String updatedAt
    ) {
        public static ElementStatusSnapshot from(FloorPlanElementStatus s) {
            String tableLabel = null;
            String sessionOpenedAt = null;
            String guestName = null;
            Integer partySize = null;

            if (s.getElement() != null && s.getElement().getBusinessTable() != null) {
                tableLabel = s.getElement().getBusinessTable().getLabel();
            }
            if (s.getSession() != null) {
                sessionOpenedAt = s.getSession().getOpenedAt().toString();
            }
            if (s.getReservation() != null) {
                guestName = s.getReservation().getCustomerName();
                partySize = s.getReservation().getPartySize();
            }

            return new ElementStatusSnapshot(
                    s.getElementId(),
                    s.getStatus(),
                    s.getSession() != null ? s.getSession().getId().toString() : null,
                    s.getReservation() != null ? s.getReservation().getId().toString() : null,
                    tableLabel,
                    sessionOpenedAt,
                    guestName,
                    partySize,
                    null, // unpaidTotal computed by LiveService
                    s.getUpdatedAt().toString()
            );
        }
    }

    public record LiveSnapshotResponse(
            FloorPlanResponse plan,
            Map<String, ElementStatusSnapshot> statuses  // keyed by elementId
    ) {}

    // -------------------------------------------------------------------------
    // Requests
    // -------------------------------------------------------------------------

    public record CreateFloorPlanRequest(
            @NotBlank @Size(max = 128) String name,
            @Min(400) @Max(4000) int canvasWidth,
            @Min(300) @Max(4000) int canvasHeight,
            @Min(5)  @Max(100)   int gridSize,
            String backgroundImage
    ) {}

    public record UpdateFloorPlanMetaRequest(
            @Size(max = 128) String name,
            @Min(400) @Max(4000) Integer canvasWidth,
            @Min(300) @Max(4000) Integer canvasHeight,
            @Min(5)  @Max(100)   Integer gridSize,
            String backgroundImage
    ) {}

    /** One element in a save-canvas request body */
    public record ElementSaveRequest(
            String id,                       // null = new element
            @NotBlank String shapeType,
            @NotNull BigDecimal x,
            @NotNull BigDecimal y,
            @NotNull BigDecimal width,
            @NotNull BigDecimal height,
            BigDecimal rotation,
            int zIndex,
            @Size(max = 32) String color,
            @NotBlank String elementKind,
            @Size(max = 128) String label,
            int seatCount,
            String parentElementId,          // references another element's id within this request
            String businessTableId           // links to existing BusinessTable
    ) {}

    /** Full canvas save — replaces all elements atomically */
    public record SaveCanvasRequest(
            @Size(max = 128) String name,
            @Min(400) @Max(4000) Integer canvasWidth,
            @Min(300) @Max(4000) Integer canvasHeight,
            @Min(5)  @Max(100)   Integer gridSize,
            String backgroundImage,
            @NotNull @Valid List<ElementSaveRequest> elements
    ) {}

    /** Manual status override */
    public record SetElementStatusRequest(
            @NotBlank String status,         // FREE | OCCUPIED | RESERVED | OUT_OF_SERVICE
            String sessionId,
            String reservationId
    ) {}

    // -------------------------------------------------------------------------
    // Template DTO
    // -------------------------------------------------------------------------

    public record TemplateResponse(
            String id,
            String businessId,
            String name,
            String shapeType,
            String elementKind,
            double defaultWidth,
            double defaultHeight,
            String defaultColor,
            int defaultSeatCount,
            String thumbnailSvg,
            int sortOrder
    ) {
        public static TemplateResponse from(FloorPlanTemplate t) {
            return new TemplateResponse(
                    t.getId(),
                    t.getBusiness() != null ? t.getBusiness().getId() : null,
                    t.getName(),
                    t.getShapeType(),
                    t.getElementKind(),
                    t.getDefaultWidth().doubleValue(),
                    t.getDefaultHeight().doubleValue(),
                    t.getDefaultColor(),
                    t.getDefaultSeatCount(),
                    t.getThumbnailSvg(),
                    t.getSortOrder()
            );
        }
    }

    public record CreateTemplateRequest(
            @NotBlank @Size(max = 128) String name,
            @NotBlank @Size(max = 32)  String shapeType,
            @NotBlank @Size(max = 32)  String elementKind,
            @NotNull BigDecimal defaultWidth,
            @NotNull BigDecimal defaultHeight,
            @Size(max = 32) String defaultColor,
            int defaultSeatCount
    ) {}

    // -------------------------------------------------------------------------
    // WebSocket event payloads (published via RealtimeEventPublisher)
    // -------------------------------------------------------------------------

    public record FloorElementStatusChangedPayload(
            String planId,
            String elementId,
            String businessTableId,
            String previousStatus,
            String newStatus,
            String sessionId,
            String reservationId
    ) {}

    public record FloorPlanUpdatedPayload(String planId, String businessId) {}
}
