package com.scanny.repository;

import com.scanny.entity.Ticket;
import com.scanny.model.enums.TicketStatus;
import org.springframework.data.jpa.repository.JpaRepository;
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

    Optional<Ticket> findByGateToken(String gateToken);
}
