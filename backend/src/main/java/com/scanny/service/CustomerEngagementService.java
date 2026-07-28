package com.scanny.service;

import com.scanny.dto.OperationsDtos;
import com.scanny.entity.CustomerPhoneSession;
import com.scanny.entity.Order;
import com.scanny.entity.OrderFeedback;
import com.scanny.entity.Reservation;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.ReservationStatus;
import com.scanny.repository.CustomerPhoneSessionRepository;
import com.scanny.repository.OrderFeedbackRepository;
import com.scanny.repository.OrderRepository;
import com.scanny.repository.ReservationRepository;
import com.scanny.security.MerchantAccessService;
import com.scanny.util.CodeUtils;
import com.scanny.util.PhoneUtils;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerEngagementService {

    private final OrderRepository orderRepository;
    private final OrderFeedbackRepository feedbackRepository;
    private final CustomerPhoneSessionRepository phoneSessionRepository;
    private final ReservationRepository reservationRepository;
    private final MerchantAccessService merchantAccessService;
    private final OutboxService outboxService;

    public CustomerEngagementService(
            OrderRepository orderRepository,
            OrderFeedbackRepository feedbackRepository,
            CustomerPhoneSessionRepository phoneSessionRepository,
            ReservationRepository reservationRepository,
            MerchantAccessService merchantAccessService,
            OutboxService outboxService
    ) {
        this.orderRepository = orderRepository;
        this.feedbackRepository = feedbackRepository;
        this.phoneSessionRepository = phoneSessionRepository;
        this.reservationRepository = reservationRepository;
        this.merchantAccessService = merchantAccessService;
        this.outboxService = outboxService;
    }

    @Transactional
    public OperationsDtos.FeedbackResponse submitFeedback(UUID publicId, OperationsDtos.SubmitFeedbackRequest request) {
        Order order = orderRepository.findWithItemsByPublicId(publicId)
                .orElseThrow(() -> new ApiException(404, "Order was not found."));
        if (!PhoneUtils.matches(order.getCustomerPhone(), request.phone())) {
            throw new ApiException(404, "Order was not found.");
        }
        if (feedbackRepository.existsByOrderId(order.getId())) {
            throw new ApiException(409, "Feedback already submitted for this order.");
        }
        if (order.getStatus() != OrderStatus.Completed && order.getStatus() != OrderStatus.Ready) {
            throw new ApiException(400, "Feedback is available after your order is ready or completed.");
        }

        OrderFeedback feedback = new OrderFeedback();
        feedback.setOrderId(order.getId());
        feedback.setBusiness(order.getBusiness());
        feedback.setRating((short) request.rating());
        feedback.setComment(request.comment() != null ? request.comment().trim() : "");
        return OperationsDtos.FeedbackResponse.from(feedbackRepository.save(feedback));
    }

    @Transactional
    public void requestHistoryCode(OperationsDtos.CustomerHistoryRequest request) {
        String phone = PhoneUtils.normalize(request.phone());
        if (phone.isBlank()) {
            throw new ApiException(400, "Phone number is required.");
        }
        CustomerPhoneSession session = phoneSessionRepository.findById(phone).orElseGet(() -> {
            CustomerPhoneSession created = new CustomerPhoneSession();
            created.setPhoneNormalized(phone);
            return created;
        });
        session.setVerifyCode(String.format("%06d", (int) (Math.random() * 1_000_000)));
        session.setVerifyExpiresAt(Instant.now().plus(10, ChronoUnit.MINUTES));
        phoneSessionRepository.save(session);
        outboxService.enqueueWhatsapp(phone, "Your Kode verification code is " + session.getVerifyCode());
    }

    @Transactional
    public OperationsDtos.CustomerHistoryResponse verifyHistory(OperationsDtos.CustomerHistoryVerifyRequest request) {
        String phone = PhoneUtils.normalize(request.phone());
        CustomerPhoneSession session = phoneSessionRepository.findById(phone)
                .orElseThrow(() -> new ApiException(401, "Verification code expired. Request a new one."));
        if (session.getVerifyExpiresAt() == null || session.getVerifyExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(401, "Verification code expired. Request a new one.");
        }
        if (session.getVerifyCode() == null || !session.getVerifyCode().equals(request.code().trim())) {
            throw new ApiException(401, "Invalid verification code.");
        }
        String token = CodeUtils.randomToken(32);
        Instant expires = Instant.now().plus(30, ChronoUnit.DAYS);
        session.setVerifiedAt(Instant.now());
        session.setSessionToken(token);
        session.setSessionExpiresAt(expires);
        session.setVerifyCode(null);
        session.setVerifyExpiresAt(null);
        phoneSessionRepository.save(session);

        List<OperationsDtos.CustomerHistoryResponse.CustomerOrderSummary> orders = loadHistoryForPhone(phone);
        return new OperationsDtos.CustomerHistoryResponse(token, expires, orders);
    }

    @Transactional(readOnly = true)
    public OperationsDtos.CustomerHistoryResponse listHistory(String sessionToken) {
        CustomerPhoneSession session = phoneSessionRepository.findBySessionTokenAndSessionExpiresAtAfter(sessionToken, Instant.now())
                .orElseThrow(() -> new ApiException(401, "Session expired."));
        return new OperationsDtos.CustomerHistoryResponse(
                sessionToken,
                session.getSessionExpiresAt(),
                loadHistoryForPhone(session.getPhoneNormalized())
        );
    }

    @Transactional
    public OperationsDtos.ReservationResponse createReservation(
            String businessId,
            OperationsDtos.CreateReservationRequest request
    ) {
        var business = merchantAccessService.requireOwnedBusiness(businessId);
        Reservation reservation = new Reservation();
        reservation.setBusiness(business);
        reservation.setCustomerName(request.customerName().trim());
        reservation.setCustomerPhone(request.customerPhone().trim());
        reservation.setPartySize(request.partySize());
        reservation.setReservedAt(request.reservedAt());
        reservation.setNote(request.note() != null ? request.note().trim() : "");
        reservation.setStatus(ReservationStatus.Pending);
        return OperationsDtos.ReservationResponse.from(reservationRepository.save(reservation));
    }

    @Transactional(readOnly = true)
    public List<OperationsDtos.ReservationResponse> listReservations(String businessId) {
        // Access already verified by controller (merchant JWT or staff session).
        return reservationRepository.findByBusinessIdAndReservedAtAfterOrderByReservedAtAsc(businessId, Instant.now().minus(1, ChronoUnit.DAYS))
                .stream()
                .map(OperationsDtos.ReservationResponse::from)
                .toList();
    }

    @Transactional
    public OperationsDtos.ReservationResponse updateReservation(
            String businessId,
            UUID reservationId,
            OperationsDtos.UpdateReservationRequest request
    ) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ApiException(404, "Reservation was not found."));
        if (!reservation.getBusiness().getId().equals(businessId)) {
            throw new ApiException(404, "Reservation was not found.");
        }
        if (request.status() != null) {
            reservation.setStatus(request.status());
        }
        if (request.note() != null) {
            reservation.setNote(request.note().trim());
        }
        if (request.reservedAt() != null) {
            reservation.setReservedAt(request.reservedAt());
        }
        if (request.partySize() != null) {
            reservation.setPartySize(request.partySize());
        }
        return OperationsDtos.ReservationResponse.from(reservationRepository.save(reservation));
    }

    private List<OperationsDtos.CustomerHistoryResponse.CustomerOrderSummary> loadHistoryForPhone(String phone) {
        Instant cutoff = Instant.now().minus(90, ChronoUnit.DAYS);
        return orderRepository.findAll().stream()
                .filter(order -> order.getCreatedAt().isAfter(cutoff))
                .filter(order -> PhoneUtils.matches(order.getCustomerPhone(), phone))
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .limit(50)
                .map(order -> new OperationsDtos.CustomerHistoryResponse.CustomerOrderSummary(
                        order.getPublicId(),
                        order.getBusinessName(),
                        order.getTotal(),
                        order.getStatus(),
                        order.getCreatedAt()
                ))
                .toList();
    }
}
