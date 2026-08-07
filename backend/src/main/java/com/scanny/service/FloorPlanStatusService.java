package com.scanny.service;

import com.scanny.dto.FloorPlanDtos;
import com.scanny.entity.FloorPlanElement;
import com.scanny.entity.FloorPlanElementStatus;
import com.scanny.entity.Reservation;
import com.scanny.entity.TableSession;
import com.scanny.repository.FloorPlanElementRepository;
import com.scanny.repository.FloorPlanElementStatusRepository;
import com.scanny.websocket.RealtimeEventPublisher;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single choke-point for all floor-plan element status transitions.
 * All callers (TableService, OperationsService, FloorPlanController) go through here.
 */
@Service
public class FloorPlanStatusService {

    private final FloorPlanElementRepository elementRepository;
    private final FloorPlanElementStatusRepository statusRepository;
    private final RealtimeEventPublisher eventPublisher;

    public FloorPlanStatusService(
            FloorPlanElementRepository elementRepository,
            FloorPlanElementStatusRepository statusRepository,
            RealtimeEventPublisher eventPublisher
    ) {
        this.elementRepository = elementRepository;
        this.statusRepository = statusRepository;
        this.eventPublisher = eventPublisher;
    }

    // -------------------------------------------------------------------------
    // Session-driven transitions (called by TableService)
    // -------------------------------------------------------------------------

    /**
     * When a TableSession opens, mark every floor-plan element linked to that
     * table as OCCUPIED across all floor plans for the business.
     */
    @Transactional
    public void onSessionOpened(String businessId, String tableId, TableSession session) {
        List<FloorPlanElement> elements =
                elementRepository.findByBusinessIdAndTableId(businessId, tableId);
        for (FloorPlanElement element : elements) {
            applyStatus(element, "OCCUPIED", session, null, "system");
        }
    }

    /**
     * When a TableSession closes, mark every linked element as FREE.
     */
    @Transactional
    public void onSessionClosed(String businessId, String tableId) {
        List<FloorPlanElement> elements =
                elementRepository.findByBusinessIdAndTableId(businessId, tableId);
        for (FloorPlanElement element : elements) {
            applyStatus(element, "FREE", null, null, "system");
        }
    }

    // -------------------------------------------------------------------------
    // Manual override (called by FloorPlanController)
    // -------------------------------------------------------------------------

    @Transactional
    public FloorPlanDtos.ElementStatusSnapshot setStatus(
            String elementId,
            String newStatus,
            TableSession session,
            Reservation reservation,
            String actorId
    ) {
        FloorPlanElement element = elementRepository.findById(elementId)
                .orElseThrow(() -> new com.scanny.exception.ApiException(404, "Element not found."));
        FloorPlanElementStatus status = applyStatus(element, newStatus, session, reservation, actorId);
        return FloorPlanDtos.ElementStatusSnapshot.from(status);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    private FloorPlanElementStatus applyStatus(
            FloorPlanElement element,
            String newStatus,
            TableSession session,
            Reservation reservation,
            String actorId
    ) {
        FloorPlanElementStatus status = statusRepository.findById(element.getId())
                .orElseGet(() -> {
                    FloorPlanElementStatus s = new FloorPlanElementStatus();
                    s.setElementId(element.getId());
                    s.setElement(element);
                    return s;
                });

        String previous = status.getStatus();
        status.setStatus(newStatus);
        status.setSession(session);
        status.setReservation(reservation);
        status.setUpdatedAt(Instant.now());
        status.setUpdatedBy(actorId);
        statusRepository.save(status);

        // Publish WebSocket event
        String businessId = element.getFloorPlan().getBusiness().getId();
        String planId     = element.getFloorPlan().getId();
        String tableId    = element.getBusinessTable() != null ? element.getBusinessTable().getId() : null;

        eventPublisher.publishFloorEvent(businessId, "FLOOR_ELEMENT_STATUS_CHANGED",
                new FloorPlanDtos.FloorElementStatusChangedPayload(
                        planId,
                        element.getId(),
                        tableId,
                        previous,
                        newStatus,
                        session != null ? session.getId().toString() : null,
                        reservation != null ? reservation.getId().toString() : null
                ));

        return status;
    }
}
