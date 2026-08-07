package com.scanny.service;

import com.scanny.dto.FloorPlanDtos;
import com.scanny.entity.FloorPlan;
import com.scanny.entity.FloorPlanElementStatus;
import com.scanny.entity.Order;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.repository.FloorPlanElementStatusRepository;
import com.scanny.repository.OrderRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Builds the full live snapshot: plan + all element statuses enriched with
 * session/reservation details (guest name, unpaid total, etc.).
 */
@Service
public class FloorPlanLiveService {

    private final FloorPlanService planService;
    private final FloorPlanElementStatusRepository statusRepository;
    private final OrderRepository orderRepository;

    public FloorPlanLiveService(
            FloorPlanService planService,
            FloorPlanElementStatusRepository statusRepository,
            OrderRepository orderRepository
    ) {
        this.planService = planService;
        this.statusRepository = statusRepository;
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public FloorPlanDtos.LiveSnapshotResponse getLiveSnapshot(String businessId, String planId) {
        FloorPlan plan = planService.requirePlan(businessId, planId);

        // Fetch all statuses for this plan in one query
        List<FloorPlanElementStatus> statuses = statusRepository.findByFloorPlanId(planId);

        // Build map of session → unpaid total for all occupied elements
        Map<UUID, Integer> unpaidBySession = buildUnpaidTotals(statuses);

        Map<String, FloorPlanDtos.ElementStatusSnapshot> statusMap = new HashMap<>();
        for (FloorPlanElementStatus s : statuses) {
            FloorPlanDtos.ElementStatusSnapshot snap = FloorPlanDtos.ElementStatusSnapshot.from(s);

            // Enrich with unpaid total
            if (s.getSession() != null) {
                Integer unpaid = unpaidBySession.get(s.getSession().getId());
                snap = new FloorPlanDtos.ElementStatusSnapshot(
                        snap.elementId(),
                        snap.status(),
                        snap.sessionId(),
                        snap.reservationId(),
                        snap.tableLabel(),
                        snap.sessionOpenedAt(),
                        snap.guestName(),
                        snap.partySize(),
                        unpaid,
                        snap.updatedAt()
                );
            }
            statusMap.put(s.getElementId(), snap);
        }

        return new FloorPlanDtos.LiveSnapshotResponse(
                FloorPlanDtos.FloorPlanResponse.from(plan),
                statusMap
        );
    }

    private Map<UUID, Integer> buildUnpaidTotals(List<FloorPlanElementStatus> statuses) {
        List<UUID> sessionIds = statuses.stream()
                .filter(s -> s.getSession() != null)
                .map(s -> s.getSession().getId())
                .distinct()
                .toList();

        if (sessionIds.isEmpty()) return Map.of();

        return orderRepository.findByTableSessionIdIn(sessionIds).stream()
                .filter(o -> o.getPaymentStatus() == PaymentStatus.Unpaid)
                .collect(Collectors.groupingBy(
                        Order::getTableSessionId,
                        Collectors.summingInt(Order::getTotal)
                ));
    }
}
