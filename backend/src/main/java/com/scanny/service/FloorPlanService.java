package com.scanny.service;

import com.scanny.dto.FloorPlanDtos;
import com.scanny.entity.Business;
import com.scanny.entity.BusinessTable;
import com.scanny.entity.FloorPlan;
import com.scanny.entity.FloorPlanElement;
import com.scanny.entity.FloorPlanTemplate;
import com.scanny.exception.ApiException;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.BusinessTableRepository;
import com.scanny.repository.FloorPlanElementRepository;
import com.scanny.repository.FloorPlanRepository;
import com.scanny.repository.FloorPlanTemplateRepository;
import com.scanny.websocket.RealtimeEventPublisher;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FloorPlanService {

    private final FloorPlanRepository planRepository;
    private final FloorPlanElementRepository elementRepository;
    private final FloorPlanTemplateRepository templateRepository;
    private final BusinessRepository businessRepository;
    private final BusinessTableRepository tableRepository;
    private final RealtimeEventPublisher eventPublisher;

    public FloorPlanService(
            FloorPlanRepository planRepository,
            FloorPlanElementRepository elementRepository,
            FloorPlanTemplateRepository templateRepository,
            BusinessRepository businessRepository,
            BusinessTableRepository tableRepository,
            RealtimeEventPublisher eventPublisher
    ) {
        this.planRepository = planRepository;
        this.elementRepository = elementRepository;
        this.templateRepository = templateRepository;
        this.businessRepository = businessRepository;
        this.tableRepository = tableRepository;
        this.eventPublisher = eventPublisher;
    }

    // -------------------------------------------------------------------------
    // Floor plan CRUD
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<FloorPlanDtos.FloorPlanSummary> listPlans(String businessId) {
        return planRepository.findByBusinessIdOrderByCreatedAtAsc(businessId)
                .stream()
                .map(FloorPlanDtos.FloorPlanSummary::from)
                .toList();
    }

    @Transactional
    public FloorPlanDtos.FloorPlanResponse createPlan(
            String businessId,
            FloorPlanDtos.CreateFloorPlanRequest req
    ) {
        Business business = businessRepository.findById(businessId)
                .orElseThrow(() -> new ApiException(404, "Business not found."));

        FloorPlan plan = new FloorPlan();
        plan.setId(UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        plan.setBusiness(business);
        plan.setName(req.name().trim());
        plan.setCanvasWidth(req.canvasWidth());
        plan.setCanvasHeight(req.canvasHeight());
        plan.setGridSize(req.gridSize());
        plan.setBackgroundImage(req.backgroundImage());
        planRepository.save(plan);

        return FloorPlanDtos.FloorPlanResponse.from(plan);
    }

    @Transactional(readOnly = true)
    public FloorPlanDtos.FloorPlanResponse getPlan(String businessId, String planId) {
        FloorPlan plan = requirePlan(businessId, planId);
        return FloorPlanDtos.FloorPlanResponse.from(plan);
    }

    @Transactional
    public FloorPlanDtos.FloorPlanResponse updateMeta(
            String businessId,
            String planId,
            FloorPlanDtos.UpdateFloorPlanMetaRequest req
    ) {
        FloorPlan plan = requirePlan(businessId, planId);
        if (req.name() != null && !req.name().isBlank())       plan.setName(req.name().trim());
        if (req.canvasWidth() != null)                         plan.setCanvasWidth(req.canvasWidth());
        if (req.canvasHeight() != null)                        plan.setCanvasHeight(req.canvasHeight());
        if (req.gridSize() != null)                            plan.setGridSize(req.gridSize());
        if (req.backgroundImage() != null)                     plan.setBackgroundImage(req.backgroundImage());
        plan.setUpdatedAt(Instant.now());
        return FloorPlanDtos.FloorPlanResponse.from(planRepository.save(plan));
    }

    @Transactional
    public void deletePlan(String businessId, String planId) {
        FloorPlan plan = requirePlan(businessId, planId);
        planRepository.delete(plan);
    }

    // -------------------------------------------------------------------------
    // Full canvas save (atomic replace)
    // -------------------------------------------------------------------------

    @Transactional
    public FloorPlanDtos.FloorPlanResponse saveCanvas(
            String businessId,
            String planId,
            FloorPlanDtos.SaveCanvasRequest req
    ) {
        FloorPlan plan = requirePlan(businessId, planId);

        // Update plan metadata if provided
        if (req.name() != null && !req.name().isBlank())       plan.setName(req.name().trim());
        if (req.canvasWidth() != null)                         plan.setCanvasWidth(req.canvasWidth());
        if (req.canvasHeight() != null)                        plan.setCanvasHeight(req.canvasHeight());
        if (req.gridSize() != null)                            plan.setGridSize(req.gridSize());
        if (req.backgroundImage() != null)                     plan.setBackgroundImage(req.backgroundImage());
        plan.setUpdatedAt(Instant.now());

        // Delete all existing elements and replace atomically
        elementRepository.deleteByFloorPlanId(planId);
        plan.getElements().clear();

        // Two-pass build: first create all elements without parents, then wire parents
        Map<String, FloorPlanElement> clientIdToEntity = new HashMap<>();
        List<FloorPlanDtos.ElementSaveRequest> incoming = req.elements();

        // Pass 1: create entities (no parent links yet)
        for (FloorPlanDtos.ElementSaveRequest er : incoming) {
            FloorPlanElement el = buildElement(plan, er);
            elementRepository.save(el);
            String clientId = er.id() != null ? er.id() : el.getId();
            clientIdToEntity.put(clientId, el);
        }

        // Pass 2: wire parent references
        for (FloorPlanDtos.ElementSaveRequest er : incoming) {
            if (er.parentElementId() != null && !er.parentElementId().isBlank()) {
                String clientId = er.id() != null ? er.id() : null;
                FloorPlanElement child  = clientIdToEntity.get(clientId);
                FloorPlanElement parent = clientIdToEntity.get(er.parentElementId());
                if (child != null && parent != null) {
                    child.setParent(parent);
                    elementRepository.save(child);
                }
            }
        }

        // Reload the plan with fresh elements
        FloorPlan saved = planRepository.findWithElementsById(planId)
                .orElseThrow(() -> new ApiException(500, "Plan reload failed."));

        // Broadcast layout-updated event
        eventPublisher.publishFloorEvent(businessId, "FLOOR_PLAN_UPDATED",
                new FloorPlanDtos.FloorPlanUpdatedPayload(planId, businessId));

        return FloorPlanDtos.FloorPlanResponse.from(saved);
    }

    // -------------------------------------------------------------------------
    // Templates
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<FloorPlanDtos.TemplateResponse> listTemplates(String businessId) {
        return templateRepository.findGlobalAndByBusinessId(businessId)
                .stream()
                .map(FloorPlanDtos.TemplateResponse::from)
                .toList();
    }

    @Transactional
    public FloorPlanDtos.TemplateResponse createTemplate(
            String businessId,
            FloorPlanDtos.CreateTemplateRequest req
    ) {
        Business business = businessRepository.findById(businessId)
                .orElseThrow(() -> new ApiException(404, "Business not found."));

        FloorPlanTemplate tpl = new FloorPlanTemplate();
        tpl.setId("tpl-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        tpl.setBusiness(business);
        tpl.setName(req.name().trim());
        tpl.setShapeType(req.shapeType());
        tpl.setElementKind(req.elementKind());
        tpl.setDefaultWidth(req.defaultWidth());
        tpl.setDefaultHeight(req.defaultHeight());
        tpl.setDefaultColor(req.defaultColor() != null ? req.defaultColor() : "#d4a373");
        tpl.setDefaultSeatCount(req.defaultSeatCount());
        return FloorPlanDtos.TemplateResponse.from(templateRepository.save(tpl));
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    FloorPlan requirePlan(String businessId, String planId) {
        FloorPlan plan = planRepository.findWithElementsById(planId)
                .orElseThrow(() -> new ApiException(404, "Floor plan not found."));
        if (!plan.getBusiness().getId().equals(businessId)) {
            throw new ApiException(403, "You do not have access to this floor plan.");
        }
        return plan;
    }

    private FloorPlanElement buildElement(FloorPlan plan, FloorPlanDtos.ElementSaveRequest er) {
        FloorPlanElement el = new FloorPlanElement();
        el.setId(er.id() != null && !er.id().isBlank()
                ? er.id()
                : UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        el.setFloorPlan(plan);
        el.setShapeType(er.shapeType());
        el.setX(er.x() != null ? er.x() : BigDecimal.ZERO);
        el.setY(er.y() != null ? er.y() : BigDecimal.ZERO);
        el.setWidth(er.width() != null ? er.width() : BigDecimal.valueOf(80));
        el.setHeight(er.height() != null ? er.height() : BigDecimal.valueOf(80));
        el.setRotation(er.rotation() != null ? er.rotation() : BigDecimal.ZERO);
        el.setZIndex(er.zIndex());
        el.setColor(er.color() != null ? er.color() : "#d4a373");
        el.setElementKind(er.elementKind());
        el.setLabel(er.label());
        el.setSeatCount(er.seatCount());

        if (er.businessTableId() != null && !er.businessTableId().isBlank()) {
            tableRepository.findByBusinessIdAndId(plan.getBusiness().getId(), er.businessTableId())
                    .ifPresent(el::setBusinessTable);
        }
        return el;
    }
}
