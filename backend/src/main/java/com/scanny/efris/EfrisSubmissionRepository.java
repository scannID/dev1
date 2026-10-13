package com.scanny.efris;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EfrisSubmissionRepository extends JpaRepository<EfrisSubmission, String> {

    /** All attempts for an order, ordered oldest-first — used to determine retry count. */
    List<EfrisSubmission> findByOrderIdOrderByAttemptAsc(String orderId);

    /** True if a SUCCESS or STUB row already exists — prevents re-submission on replay. */
    @Query("""
            SELECT COUNT(s) > 0 FROM EfrisSubmission s
            WHERE s.orderId = :orderId
              AND s.status IN (
                com.scanny.efris.EfrisSubmission.EfrisSubmissionStatus.SUCCESS,
                com.scanny.efris.EfrisSubmission.EfrisSubmissionStatus.STUB
              )
            """)
    boolean existsSuccessfulSubmission(@Param("orderId") String orderId);

    /** Count of failed attempts for backoff calculation. */
    @Query("""
            SELECT COUNT(s) FROM EfrisSubmission s
            WHERE s.orderId = :orderId
              AND s.status = com.scanny.efris.EfrisSubmission.EfrisSubmissionStatus.FAILED
            """)
    long countFailedAttempts(@Param("orderId") String orderId);
}
