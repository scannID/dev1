package com.scanny.repository;

import com.scanny.entity.Receipt;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReceiptRepository extends JpaRepository<Receipt, Long>, ReceiptRepositoryCustom {

    // Find by receipt number
    Optional<Receipt> findByReceiptNumber(String receiptNumber);

    // Find by order ID
    Optional<Receipt> findByOrderId(String orderId);

    // Find by ticket ID
    Optional<Receipt> findByTicketId(Long ticketId);

    // Find by quick payment ID
    Optional<Receipt> findByQuickPaymentId(Long quickPaymentId);

    // Find by device payment ID
    Optional<Receipt> findByDevicePaymentId(Long devicePaymentId);

    // Find receipts by business ID
    List<Receipt> findByBusinessIdOrderByCreatedAtDesc(String businessId);

    // Find receipts by customer email
    List<Receipt> findByCustomerEmailOrderByCreatedAtDesc(String customerEmail);

    // Find receipts by customer phone
    List<Receipt> findByCustomerPhoneOrderByCreatedAtDesc(String customerPhone);

    // Find receipts by status
    List<Receipt> findByStatusOrderByCreatedAtDesc(Receipt.ReceiptStatus status);

    // Find unsent email receipts
    @Query("SELECT r FROM Receipt r WHERE r.emailSent = false AND r.customerEmail IS NOT NULL")
    List<Receipt> findUnsentEmailReceipts();

    // Find receipts by date range
    @Query("SELECT r FROM Receipt r WHERE r.paymentDate BETWEEN :startDate AND :endDate ORDER BY r.paymentDate DESC")
    List<Receipt> findByPaymentDateBetween(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    // Find receipts by business and date range
    @Query("SELECT r FROM Receipt r WHERE r.businessId = :businessId AND r.paymentDate BETWEEN :startDate AND :endDate ORDER BY r.paymentDate DESC")
    List<Receipt> findByBusinessIdAndPaymentDateBetween(@Param("businessId") String businessId, @Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    // Count receipts by business
    Long countByBusinessId(String businessId);

    // Count receipts by status
    Long countByStatus(Receipt.ReceiptStatus status);

    // Find receipts pending PDF generation
    @Query("SELECT r FROM Receipt r WHERE r.pdfGenerated = false")
    List<Receipt> findReceiptsPendingPdfGeneration();
}
