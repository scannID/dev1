package com.scanny.service;

import com.scanny.dto.HotelOpsDtos;
import com.scanny.entity.CatalogItem;
import com.scanny.entity.OrderLineItem;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.BusinessType;
import com.scanny.model.enums.ItemKind;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.RoomStatus;
import com.scanny.repository.CatalogItemRepository;
import com.scanny.repository.OrderRepository;
import com.scanny.security.MerchantAccessService;
import com.scanny.security.OperationsAccessService;
import com.scanny.model.enums.StaffRole;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hotel-specific room operations: booked-rooms list, check-in, check-out,
 * stay extensions, and maintenance toggling.
 *
 * All mutating operations evict the menu cache so the customer booking view
 * reflects the new room status immediately.
 */
@Service
public class HotelOpsService {

    private static final Logger logger = LoggerFactory.getLogger(HotelOpsService.class);

    private final CatalogItemRepository catalogItemRepository;
    private final OrderRepository orderRepository;
    private final MerchantAccessService merchantAccessService;
    private final OperationsAccessService operationsAccessService;
    private final BusinessService businessService;

    public HotelOpsService(
            CatalogItemRepository catalogItemRepository,
            OrderRepository orderRepository,
            MerchantAccessService merchantAccessService,
            OperationsAccessService operationsAccessService,
            BusinessService businessService
    ) {
        this.catalogItemRepository = catalogItemRepository;
        this.orderRepository = orderRepository;
        this.merchantAccessService = merchantAccessService;
        this.operationsAccessService = operationsAccessService;
        this.businessService = businessService;
    }

    // ── Booked Rooms List ─────────────────────────────────────────────────────

    /**
     * Returns all rooms/suites that are currently BOOKED, OCCUPIED,
     * CHECKOUT_PENDING, or UNDER_MAINTENANCE, together with the active guest booking.
     */
    @Transactional(readOnly = true)
    public List<HotelOpsDtos.BookedRoomResponse> listBookedRooms(String businessId, String staffSession) {
        requireHotelOpsAccess(businessId, staffSession);

        LocalDate today = LocalDate.now();
        List<CatalogItem> nonVacant = catalogItemRepository.findNonVacantLodgingByBusinessId(businessId);

        return nonVacant.stream()
                .map(item -> {
                    OrderLineItem activeLine = findActiveLine(item.getId(), today);
                    return HotelOpsDtos.BookedRoomResponse.from(item, activeLine);
                })
                .toList();
    }

    // ── Room Status Transitions ───────────────────────────────────────────────

    /**
     * Generic status setter — allows MANAGER-level staff to manually set a room's status.
     * Specific convenience methods (checkIn, checkOut, markMaintenance) are preferred
     * for common flows; this endpoint backs the merchant admin override.
     */
    @Transactional
    public HotelOpsDtos.BookedRoomResponse updateRoomStatus(
            String businessId,
            String itemId,
            RoomStatus newStatus,
            String staffSession
    ) {
        requireHotelOpsAccess(businessId, staffSession);
        CatalogItem item = requireLodgingItem(businessId, itemId);

        item.setRoomStatus(newStatus);
        catalogItemRepository.save(item);
        businessService.evictMenuCache(businessId);

        logger.info("Room {} in business {} status set to {} by staff/merchant",
                itemId, businessId, newStatus);

        LocalDate today = LocalDate.now();
        OrderLineItem activeLine = findActiveLine(itemId, today);
        return HotelOpsDtos.BookedRoomResponse.from(item, activeLine);
    }

    /**
     * Mark a room as OCCUPIED (guest has arrived).
     * Transition: BOOKED → OCCUPIED.
     */
    @Transactional
    public HotelOpsDtos.BookedRoomResponse checkIn(String businessId, String itemId, String staffSession) {
        requireHotelOpsAccess(businessId, staffSession);
        CatalogItem item = requireLodgingItem(businessId, itemId);

        if (item.getRoomStatus() != RoomStatus.BOOKED) {
            throw new ApiException(409,
                    "Room can only be checked in when status is BOOKED (current: " + item.getRoomStatus() + ").");
        }

        item.setRoomStatus(RoomStatus.OCCUPIED);
        catalogItemRepository.save(item);
        businessService.evictMenuCache(businessId);

        LocalDate today = LocalDate.now();
        OrderLineItem activeLine = findActiveLine(itemId, today);
        return HotelOpsDtos.BookedRoomResponse.from(item, activeLine);
    }

    /**
     * Mark a room as VACANT (guest has checked out).
     * Transition: OCCUPIED | CHECKOUT_PENDING | BOOKED → VACANT.
     */
    @Transactional
    public HotelOpsDtos.BookedRoomResponse checkOut(String businessId, String itemId, String staffSession) {
        requireHotelOpsAccess(businessId, staffSession);
        CatalogItem item = requireLodgingItem(businessId, itemId);

        RoomStatus current = item.getRoomStatus();
        if (current != RoomStatus.OCCUPIED
                && current != RoomStatus.CHECKOUT_PENDING
                && current != RoomStatus.BOOKED) {
            throw new ApiException(409,
                    "Room cannot be checked out from status " + current + ".");
        }

        item.setRoomStatus(RoomStatus.VACANT);
        catalogItemRepository.save(item);
        businessService.evictMenuCache(businessId);

        logger.info("Room {} in business {} checked out → VACANT", itemId, businessId);
        return HotelOpsDtos.BookedRoomResponse.from(item, null);
    }

    /**
     * Toggle maintenance status.
     * VACANT | CHECKOUT_PENDING → UNDER_MAINTENANCE, UNDER_MAINTENANCE → VACANT.
     */
    @Transactional
    public HotelOpsDtos.BookedRoomResponse toggleMaintenance(
            String businessId, String itemId, String staffSession) {
        requireHotelOpsAccess(businessId, staffSession);
        CatalogItem item = requireLodgingItem(businessId, itemId);

        RoomStatus current = item.getRoomStatus();
        if (current == RoomStatus.OCCUPIED || current == RoomStatus.BOOKED) {
            throw new ApiException(409,
                    "Cannot put a " + current + " room into maintenance. Check out the guest first.");
        }

        RoomStatus next = current == RoomStatus.UNDER_MAINTENANCE ? RoomStatus.VACANT : RoomStatus.UNDER_MAINTENANCE;
        item.setRoomStatus(next);
        catalogItemRepository.save(item);
        businessService.evictMenuCache(businessId);

        LocalDate today = LocalDate.now();
        OrderLineItem activeLine = findActiveLine(itemId, today);
        return HotelOpsDtos.BookedRoomResponse.from(item, activeLine);
    }

    // ── Stay Extension ────────────────────────────────────────────────────────

    /**
     * Extend a guest's current stay by pushing their checkout date forward.
     *
     * Creates a new {@link com.scanny.entity.OrderLineItem} for the additional nights
     * and attaches it to the original order. The room remains OCCUPIED.
     * The new checkout date must be after the current checkout date.
     */
    @Transactional
    public HotelOpsDtos.ExtendStayResponse extendStay(
            String businessId,
            HotelOpsDtos.ExtendStayRequest request,
            String staffSession
    ) {
        requireHotelOpsAccess(businessId, staffSession);
        CatalogItem item = requireLodgingItem(businessId, request.itemId());

        RoomStatus current = item.getRoomStatus();
        if (current != RoomStatus.OCCUPIED && current != RoomStatus.BOOKED && current != RoomStatus.CHECKOUT_PENDING) {
            throw new ApiException(409,
                    "Can only extend a stay when the room is OCCUPIED, BOOKED, or CHECKOUT_PENDING.");
        }

        LocalDate today = LocalDate.now();
        OrderLineItem activeLine = findActiveLine(request.itemId(), today);
        if (activeLine == null) {
            // Try to find a future line (BOOKED state — guest not arrived yet)
            activeLine = findLatestFutureLine(request.itemId());
        }
        if (activeLine == null) {
            throw new ApiException(404, "No active booking found for this room.");
        }

        LocalDate currentCheckOut = activeLine.getCheckOutDate();
        LocalDate newCheckOut = request.newCheckOutDate();

        if (!newCheckOut.isAfter(currentCheckOut)) {
            throw new ApiException(400,
                    "New checkout date must be after current checkout date (" + currentCheckOut + ").");
        }

        // Verify no other booking blocks the extended window for this room.
        long overlapping = orderRepository.sumOverlappingLodgingUnits(
                item.getId(),
                currentCheckOut,      // extension starts where current booking ends
                newCheckOut,
                OrderStatus.Cancelled,
                PaymentStatus.Refunded
        );
        int units = Math.max(item.getUnitsAvailable(), 1);
        if (overlapping >= units) {
            throw new ApiException(409, "Room is already booked for part of the requested extension period.");
        }

        int additionalNights = (int) java.time.temporal.ChronoUnit.DAYS.between(currentCheckOut, newCheckOut);
        int unitPrice = activeLine.getPrice();
        int additionalCharge = unitPrice * additionalNights * activeLine.getQuantity();

        // Create extension line item on the same order.
        OrderLineItem extensionLine = new OrderLineItem();
        extensionLine.setOrder(activeLine.getOrder());
        extensionLine.setItemId(item.getId());
        extensionLine.setName(item.getName() + " (extension)");
        extensionLine.setItemKind(item.getItemKind());
        extensionLine.setPrice(unitPrice);
        extensionLine.setQuantity(activeLine.getQuantity());
        extensionLine.setCheckInDate(currentCheckOut);  // extension starts at old check-out
        extensionLine.setCheckOutDate(newCheckOut);
        extensionLine.setNights(additionalNights);
        extensionLine.setLineTotal(additionalCharge);
        extensionLine.setRemovedIngredientsJson("[]");

        activeLine.getOrder().addItem(extensionLine);

        // Keep room OCCUPIED; update checkout pending status if it was CHECKOUT_PENDING.
        if (item.getRoomStatus() == RoomStatus.CHECKOUT_PENDING) {
            item.setRoomStatus(RoomStatus.OCCUPIED);
        }
        catalogItemRepository.save(item);
        businessService.evictMenuCache(businessId);

        logger.info("Stay extended for room {} in business {}: {} → {} ({} extra nights, {} extra charge)",
                item.getId(), businessId, currentCheckOut, newCheckOut, additionalNights, additionalCharge);

        return new HotelOpsDtos.ExtendStayResponse(
                activeLine.getOrder().getId(),
                item.getId(),
                newCheckOut,
                additionalNights,
                additionalCharge
        );
    }

    // ── Scheduler-facing method ───────────────────────────────────────────────

    /**
     * Called by {@link com.scanny.service.HotelCheckoutScheduler} each night.
     * Marks all OCCUPIED/BOOKED rooms whose checkout date has passed as CHECKOUT_PENDING.
     */
    @Transactional
    public int markOverdueCheckouts(String businessId) {
        LocalDate today = LocalDate.now();
        List<CatalogItem> rooms = catalogItemRepository.findNonVacantLodgingByBusinessId(businessId);
        int marked = 0;
        for (CatalogItem room : rooms) {
            if (room.getRoomStatus() != RoomStatus.OCCUPIED && room.getRoomStatus() != RoomStatus.BOOKED) {
                continue;
            }
            // Find the latest active line for this room.
            List<OrderLineItem> lines = orderRepository.findActiveBookingLinesForItem(
                    room.getId(), today, OrderStatus.Cancelled, PaymentStatus.Refunded);
            // If no line has today inside its window, the guest should have left.
            if (lines.isEmpty()) {
                room.setRoomStatus(RoomStatus.CHECKOUT_PENDING);
                catalogItemRepository.save(room);
                marked++;
            }
        }
        if (marked > 0) {
            businessService.evictMenuCache(businessId);
        }
        return marked;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void requireHotelOpsAccess(String businessId, String staffSession) {
        operationsAccessService.requireMerchantOrStaff(
                businessId, staffSession, StaffRole.MANAGER, StaffRole.CASHIER);
    }

    private CatalogItem requireLodgingItem(String businessId, String itemId) {
        CatalogItem item = catalogItemRepository.findById(itemId)
                .orElseThrow(() -> new ApiException(404, "Room not found."));
        if (item.getBusiness() == null || !item.getBusiness().getId().equals(businessId)) {
            throw new ApiException(404, "Room not found.");
        }
        if (!item.isLodging()) {
            throw new ApiException(400, "Item is not a room or suite.");
        }
        return item;
    }

    /** Returns the booking line currently active today (checkIn <= today < checkOut). */
    private OrderLineItem findActiveLine(String itemId, LocalDate today) {
        List<OrderLineItem> lines = orderRepository.findActiveBookingLinesForItem(
                itemId, today, OrderStatus.Cancelled, PaymentStatus.Refunded);
        return lines.isEmpty() ? null : lines.get(0);
    }

    /**
     * For BOOKED rooms where the guest hasn't arrived yet, find the next upcoming booking line.
     * Looks for lines where checkIn is in the future (or today).
     */
    private OrderLineItem findLatestFutureLine(String itemId) {
        List<OrderLineItem> lines = orderRepository.findUpcomingBookingLinesForItem(
                itemId, LocalDate.now().minusDays(1), OrderStatus.Cancelled, PaymentStatus.Refunded);
        return lines.isEmpty() ? null : lines.get(0);
    }
}
