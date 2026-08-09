package com.scanny.dto;

import com.scanny.entity.CatalogItem;
import com.scanny.entity.OrderLineItem;
import com.scanny.model.enums.RoomStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public class HotelOpsDtos {

    // ── Requests ───────────────────────────────────────────────────────────────

    /** Body for PATCH .../room-status */
    public record UpdateRoomStatusRequest(
        @NotNull RoomStatus status
    ) {}

    /** Body for POST .../extend — extend a guest's stay */
    public record ExtendStayRequest(
        @NotBlank String itemId,
        @NotNull LocalDate newCheckOutDate
    ) {}

    // ── Responses ─────────────────────────────────────────────────────────────

    /** Summary of the current booking occupying a room. */
    public record ActiveBookingInfo(
        String orderId,
        String guestName,
        String guestPhone,
        LocalDate checkIn,
        LocalDate checkOut,
        int nights,
        int lineTotal
    ) {
        public static ActiveBookingInfo from(OrderLineItem line) {
            var order = line.getOrder();
            return new ActiveBookingInfo(
                order.getId(),
                order.getCustomerName(),
                order.getCustomerPhone() == null ? "" : order.getCustomerPhone(),
                line.getCheckInDate(),
                line.getCheckOutDate(),
                line.getNights() == null ? 0 : line.getNights(),
                line.getLineTotal()
            );
        }
    }

    /** A room card shown on the Booked Rooms tab. */
    public record BookedRoomResponse(
        String itemId,
        String name,
        String category,
        RoomStatus roomStatus,
        String roomStatusLabel,
        int price,
        int capacity,
        List<String> amenities,
        String imageUrl,
        ActiveBookingInfo currentBooking
    ) {
        public static BookedRoomResponse from(CatalogItem item, OrderLineItem activeLine) {
            return new BookedRoomResponse(
                item.getId(),
                item.getName(),
                item.getCategory(),
                item.getRoomStatus(),
                roomStatusLabel(item.getRoomStatus()),
                item.getPrice(),
                item.getCapacity(),
                com.scanny.util.JsonLists.readStringList(item.getAmenitiesJson()),
                item.getImageUrl(),
                activeLine != null ? ActiveBookingInfo.from(activeLine) : null
            );
        }

        private static String roomStatusLabel(RoomStatus s) {
            return switch (s) {
                case VACANT           -> "Vacant";
                case BOOKED           -> "Booked";
                case OCCUPIED         -> "Occupied";
                case CHECKOUT_PENDING -> "Checkout Due";
                case UNDER_MAINTENANCE -> "Maintenance";
            };
        }
    }

    /** Response for extend-stay: returns the updated room card and new booking info. */
    public record ExtendStayResponse(
        String orderId,
        String itemId,
        LocalDate newCheckOut,
        int additionalNights,
        int additionalCharge
    ) {}
}
