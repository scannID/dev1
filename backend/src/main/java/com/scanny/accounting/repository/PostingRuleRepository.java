package com.scanny.accounting.repository;

import com.scanny.accounting.entity.PostingRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface PostingRuleRepository extends JpaRepository<PostingRule, Integer> {
    Optional<PostingRule> findBySourceModuleAndEventTypeAndIsActiveTrue(
            String sourceModule, String eventType);
}
