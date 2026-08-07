package com.scanny.controller;

import com.scanny.dto.FloorPlanDtos;
import com.scanny.entity.FloorPlanElement;
import com.scanny.entity.Reservation;
import com.scanny.entity.TableSession;
import com.scanny.exception.ApiException;
import com.scanny.repository.FloorPlanElementRepository;
import com.scanny.repository.ReservationRepository;
import com.scanny.repository.TableSessionRepository;
import com.scanny.security.MerchantAccessService;
import com.scanny.security.OperationsAccessService;
import com.scanny.service.FloorPlanLiveService;
import com.scanny.service.FloorPlanService;
import com.scanny.service.FloorPlanStatusService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/businesses/{businessId}/floor-plans")
public class FloorPlanController {

    private final FloorPlanService planService;
    private final FloorPlanLiveService liveService;
    private final FloorPlanStatusService statusService;
    private final FloorPlanElementRepository elementRepository;
    private final TableSessionRepository sessionRepository;
    private final ReservationRepository reservationRepository;
    private final MerchantAccessService merchantAccessService;
    private final OperationsAccessService operationsAccessService;

    public FloorPlanController(
            FloorPlanService planService,
            FloorPlanLiveService liveService,
            FloorPlanStatusService statusService,
            FloorPlanElementRepository elementRepository,
            TableSessionRepository sessionRepository,
            ReservationRepository reservationRepository,
            MerchantAccessService merchantAccessService,
            OperationsAccessService operationsAccessService
    ) {
        this.planService = planService;
        this.liveService = liveService;
        this.statusService = statusService;
        this.elementRepository = elementRepository;
        this.sessionRepository = sessionRepository;
        this.reservationRepository = reservationRepository;
        this.merchantAccessService = merchantAccessService;
        this.operationsAccessService = operationsAccessService;
    }

    // -------------------------------------------------------------------------
    // Floor plan list — merchant + all floor staff roles
    // -------------------------------------------------------------------------

    @GetMapping
    public Map<String, List<FloorPlanDtos.FloorPlanSummary>> listPlans(
            @PathVariable String businessId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        operationsAccessService.requireMerchantOrStaff(
                businessId, staffSession, OperationsAccessService.floorRoles());
        return Map.of("plans", planService.listPlans(businessId));
    }

    // -------------------------------------------------------------------------
    // Floor plan CRUD — merchant owner only
    // -------------------------------------------------------------------------

    @PostMapping
    public Map<String, FloorPlanDtos.FloorPlanResponse> createPlan(
            @PathVariable String businessId,
            @Valid @RequestBody FloorPlanDtos.CreateFloorPlanRequest request
    ) {
        merchantAccessService.requireOwnedBusiness(businessId);
        return Map.of("plan", planService.createPlan(businessId, request));
    }

    @GetMapping("/{planId}")
    public Map<String, FloorPlanDtos.FloorPlanResponse> getPlan(
            @PathVariable String businessId,
            @PathVariable String planId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        operationsAccessService.requireMerchantOrStaff(
                businessId, staffSession, OperationsAccessService.floorRoles());
        return Map.of("plan", planService.getPlan(businessId, planId));
    }

    /** Save full canvas — replaces all elements atomically */
    @PutMapping("/{planId}")
    public Map<String, FloorPlanDtos.FloorPlanResponse> saveCanvas(
            @PathVariable String businessId,
            @PathVariable String planId,
            @Valid @RequestBody FloorPlanDtos.SaveCanvasRequest request
    ) {
        merchantAccessService.requireOwnedBusiness(businessId);
        return Map.of("plan", planService.saveCanvas(businessId, planId, request));
    }

    /** Update plan metadata only (name, dimensions) */
    @PatchMapping("/{planId}")
    public Map<String, FloorPlanDtos.FloorPlanResponse> updateMeta(
            @PathVariable String businessId,
            @PathVariable String planId,
            @Valid @RequestBody FloorPlanDtos.UpdateFloorPlanMetaRequest request
    ) {
        merchantAccessService.requireOwnedBusiness(businessId);
        return Map.of("plan", planService.updateMeta(businessId, planId, request));
    }

    @DeleteMapping("/{planId}")
    public Map<String, String> deletePlan(
            @PathVariable String businessId,
            @PathVariable String planId
    ) {
        merchantAccessService.requireOwnedBusiness(businessId);
        planService.deletePlan(businessId, planId);
        return Map.of("status", "deleted");
    }

    // -------------------------------------------------------------------------
    // Live snapshot — merchant + all floor staff roles
    // -------------------------------------------------------------------------

    @GetMapping("/{planId}/live")
    public Map<String, Object> getLiveSnapshot(
            @PathVariable String businessId,
            @PathVariable String planId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        operationsAccessService.requireMerchantOrStaff(
                businessId, staffSession, OperationsAccessService.floorRoles());
        FloorPlanDtos.LiveSnapshotResponse snapshot = liveService.getLiveSnapshot(businessId, planId);
        return Map.of("plan", snapshot.plan(), "statuses", snapshot.statuses());
    }

    // -------------------------------------------------------------------------
    // Manual element status override — merchant + manager role only
    // -------------------------------------------------------------------------

    @PatchMapping("/{planId}/elements/{elementId}/status")
    public Map<String, FloorPlanDtos.ElementStatusSnapshot> setElementStatus(
            @PathVariable String businessId,
            @PathVariable String planId,
            @PathVariable String elementId,
            @Valid @RequestBody FloorPlanDtos.SetElementStatusRequest request,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        operationsAccessService.requireMerchantOrStaff(
                businessId, staffSession, OperationsAccessService.managerRoles());

        // Validate the element belongs to this business / plan
        FloorPlanElement element = elementRepository.findById(elementId)
                .orElseThrow(() -> new ApiException(404, "Element not found."));
        if (!element.getFloorPlan().getId().equals(planId)
                || !element.getFloorPlan().getBusiness().getId().equals(businessId)) {
            throw new ApiException(403, "Element does not belong to this floor plan.");
        }

        // Validate status value
        String status = request.status();
        if (!List.of("FREE", "OCCUPIED", "RESERVED", "OUT_OF_SERVICE").contains(status)) {
            throw new ApiException(400, "Invalid status value: " + status);
        }

        TableSession session = null;
        if (request.sessionId() != null && !request.sessionId().isBlank()) {
            session = sessionRepository.findById(UUID.fromString(request.sessionId()))
                    .orElseThrow(() -> new ApiException(404, "Session not found."));
        }

        Reservation reservation = null;
        if (request.reservationId() != null && !request.reservationId().isBlank()) {
            reservation = reservationRepository.findById(UUID.fromString(request.reservationId()))
                    .orElseThrow(() -> new ApiException(404, "Reservation not found."));
        }

        String actorId = merchantAccessService.actorId();
        FloorPlanDtos.ElementStatusSnapshot snap =
                statusService.setStatus(elementId, status, session, reservation, actorId);

        return Map.of("status", snap);
    }

    // -------------------------------------------------------------------------
    // Shape templates
    // -------------------------------------------------------------------------

    @GetMapping("/templates")
    public Map<String, List<FloorPlanDtos.TemplateResponse>> listTemplates(
            @PathVariable String businessId,
            @RequestHeader(value = OperationsAccessService.STAFF_SESSION_HEADER, required = false) String staffSession
    ) {
        operationsAccessService.requireMerchantOrStaff(
                businessId, staffSession, OperationsAccessService.floorRoles());
        return Map.of("templates", planService.listTemplates(businessId));
    }

    @PostMapping("/templates")
    public Map<String, FloorPlanDtos.TemplateResponse> createTemplate(
            @PathVariable String businessId,
            @Valid @RequestBody FloorPlanDtos.CreateTemplateRequest request
    ) {
        merchantAccessService.requireOwnedBusiness(businessId);
        return Map.of("template", planService.createTemplate(businessId, request));
    }
}
