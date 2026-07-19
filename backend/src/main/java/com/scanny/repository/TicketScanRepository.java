package com.scanny.repository;

import com.scanny.entity.TicketScan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TicketScanRepository extends JpaRepository<TicketScan, Long> {
    
    List<TicketScan> findByTicketId(String ticketId);
    
    List<TicketScan> findByTicketIdOrderByScannedAtDesc(String ticketId);
}
