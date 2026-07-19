package com.scanny.repository;

import com.scanny.entity.Receipt;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

@Repository
public class ReceiptRepositoryCustomImpl implements ReceiptRepositoryCustom {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public void refresh(Receipt receipt) {
        entityManager.refresh(receipt);
    }
}
