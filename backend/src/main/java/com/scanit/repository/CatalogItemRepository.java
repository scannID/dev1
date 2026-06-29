package com.scanit.repository;

import com.scanit.entity.CatalogItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CatalogItemRepository extends JpaRepository<CatalogItem, String> {
}
