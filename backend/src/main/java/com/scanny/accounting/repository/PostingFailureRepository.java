package com.scanny.accounting.repository;

import com.scanny.accounting.entity.PostingFailure;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PostingFailureRepository extends JpaRepository<PostingFailure, Long> {
    Page<PostingFailure> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);
    long countByStatus(String status);
}
