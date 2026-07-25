package com.scanny.repository;

import com.scanny.entity.Ticket;
import com.scanny.model.enums.TicketStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, String> {

    Optional<Ticket> findByQrToken(String qrToken);

    List<Ticket> findByStatus(TicketStatus status);

    List<Ticket> findByIssuedBy(String issuedBy);

    List<Ticket> findByEventName(String eventName);

    boolean existsByEventNameAndHolderEmailIgnoreCaseAndPaymentStatusAndMasterTicketIdIsNotNull(
        String eventName,
        String holderEmail,
        com.scanny.model.enums.PaymentStatus paymentStatus
    );

    Optional<Ticket> findByAccessToken(String accessToken);

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
}
