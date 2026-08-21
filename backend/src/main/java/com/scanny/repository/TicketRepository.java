package com.scanny.repository;

import com.scanny.entity.Ticket;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.TicketStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Ticket t WHERE t.id = :id")
    Optional<Ticket> findByIdForUpdate(@Param("id") String id);

    Optional<Ticket> findByQrToken(String qrToken);

    List<Ticket> findByStatus(TicketStatus status);

    List<Ticket> findByIssuedBy(String issuedBy);

    List<Ticket> findByEventName(String eventName);

    boolean existsByEventNameAndHolderEmailIgnoreCaseAndPaymentStatusAndMasterTicketIdIsNotNull(
        String eventName,
        String holderEmail,
        com.scanny.model.enums.PaymentStatus paymentStatus
    );

    boolean existsByEventNameAndHolderPhoneAndPaymentStatusAndMasterTicketIdIsNotNull(
        String eventName,
        String holderPhone,
        com.scanny.model.enums.PaymentStatus paymentStatus
    );

    Optional<Ticket> findByAccessToken(String accessToken);

    Optional<Ticket> findByTransferToken(String transferToken);

    List<Ticket> findByMasterTicketIdOrderByCreatedAtDesc(String masterTicketId);
    List<Ticket> findByMasterTicketIdAndIdEndingWithIgnoreCase(String masterTicketId, String suffix);

    List<Ticket> findByMasterTicketIdIsNullAndUsageLimitGreaterThan(int usageLimit);

    @Query("""
            SELECT COUNT(t) FROM Ticket t
            WHERE t.masterTicketId = :masterId
              AND LOWER(t.ticketType) = LOWER(:ticketType)
              AND t.status <> com.scanny.model.enums.TicketStatus.Cancelled
              AND t.paymentStatus = com.scanny.model.enums.PaymentStatus.Paid
            """)
    long countSoldByMasterAndType(
            @Param("masterId") String masterId,
            @Param("ticketType") String ticketType
    );

    @Query("""
            SELECT COUNT(t) FROM Ticket t
            WHERE t.masterTicketId = :masterId
              AND LOWER(t.ticketType) = LOWER(:ticketType)
              AND t.status <> com.scanny.model.enums.TicketStatus.Cancelled
              AND t.paymentStatus = com.scanny.model.enums.PaymentStatus.Unpaid
              AND t.holdExpiresAt IS NOT NULL
              AND t.holdExpiresAt > :now
            """)
    long countActiveHoldsByMasterAndType(
            @Param("masterId") String masterId,
            @Param("ticketType") String ticketType,
            @Param("now") Instant now
    );

    @Query("""
            SELECT t FROM Ticket t
            WHERE t.masterTicketId IS NOT NULL
              AND t.paymentStatus = :paymentStatus
              AND t.status = :status
              AND t.holdExpiresAt IS NOT NULL
              AND t.holdExpiresAt <= :now
            """)
    List<Ticket> findExpiredHolds(
            @Param("paymentStatus") PaymentStatus paymentStatus,
            @Param("status") TicketStatus status,
            @Param("now") Instant now
    );

    @Query("""
            SELECT t FROM Ticket t
            WHERE t.eventDate IS NOT NULL
              AND t.eventDate < :cutoff
            """)
    List<Ticket> findPastEventDateCutoff(@Param("cutoff") Instant cutoff);

    @Query("""
            SELECT t.eventName,
                   COUNT(t),
                   SUM(CASE WHEN t.paymentStatus = com.scanny.model.enums.PaymentStatus.Paid THEN 1 ELSE 0 END)
            FROM Ticket t
            WHERE t.masterTicketId IS NOT NULL
              AND (
                :search IS NULL OR :search = ''
                OR LOWER(t.eventName) LIKE LOWER(CONCAT('%', :search, '%'))
              )
            GROUP BY t.eventName
            ORDER BY t.eventName
            """)
    List<Object[]> aggregateAttendeeEventStats(@Param("search") String search);
