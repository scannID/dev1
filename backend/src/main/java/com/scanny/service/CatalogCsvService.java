package com.scanny.service;

import com.scanny.dto.CatalogDtos;
import com.scanny.entity.CatalogItem;
import com.scanny.exception.ApiException;
import com.scanny.repository.CatalogItemRepository;
import com.scanny.security.MerchantAccessService;
import com.scanny.util.CatalogPricing;
import java.io.BufferedReader;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogCsvService {

    private final CatalogItemRepository catalogItemRepository;
    private final CatalogService catalogService;
    private final MerchantAccessService merchantAccessService;

    public CatalogCsvService(
            CatalogItemRepository catalogItemRepository,
            CatalogService catalogService,
            MerchantAccessService merchantAccessService
    ) {
        this.catalogItemRepository = catalogItemRepository;
        this.catalogService = catalogService;
        this.merchantAccessService = merchantAccessService;
    }

    @Transactional(readOnly = true)
    public String exportCsv(String businessId) {
        merchantAccessService.assertOwnsBusinessId(businessId);
        StringBuilder csv = new StringBuilder("id,name,category,price,discount_percent,description,available,track_stock,units_available,low_stock_threshold\n");
        for (CatalogItem item : catalogItemRepository.findByBusiness_IdOrderByNameAsc(businessId)) {
            csv.append(escape(item.getId())).append(',')
                    .append(escape(item.getName())).append(',')
                    .append(escape(item.getCategory())).append(',')
                    .append(item.getPrice()).append(',')
                    .append(item.getDiscountPercent()).append(',')
                    .append(escape(item.getDescription())).append(',')
                    .append(item.isAvailable()).append(',')
                    .append(item.isTrackStock()).append(',')
                    .append(item.getUnitsAvailable()).append(',')
                    .append(item.getLowStockThreshold()).append('\n');
        }
        return csv.toString();
    }

    @Transactional
    public int importCsv(String businessId, String csvContent) {
        merchantAccessService.assertOwnsBusinessId(businessId);
        if (csvContent == null || csvContent.isBlank()) {
            throw new ApiException(400, "CSV content is required.");
        }
        List<String[]> rows = parseCsv(csvContent);
        if (rows.isEmpty()) {
            throw new ApiException(400, "CSV has no data rows.");
        }
        int imported = 0;
        for (String[] row : rows) {
            if (row.length < 4) {
                continue;
            }
            String name = row[1].trim();
            if (name.isBlank()) {
                continue;
            }
            CatalogDtos.CreateCatalogItemRequest request = new CatalogDtos.CreateCatalogItemRequest(
                    name,
                    row[2].trim(),
                    parseInt(row[3], 0),
                    row.length > 5 ? row[5].trim() : "",
                    null,
                    List.of(),
                    "",
                    List.of(),
                    row.length > 6 && Boolean.parseBoolean(row[6]),
                    row.length > 4 ? parseInt(row[4], 0) : 0,
                    null,
                    null,
                    List.of(),
                    row.length > 8 ? parseInt(row[8], 0) : 0
            );
            catalogService.createCatalogItem(businessId, request);
            imported++;
        }
        return imported;
    }

    private static List<String[]> parseCsv(String csvContent) throws ApiException {
        List<String[]> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new StringReader(csvContent))) {
            String line;
            boolean header = true;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                if (header) {
                    header = false;
                    continue;
                }
                rows.add(line.split(",", -1));
            }
        } catch (Exception ex) {
            throw new ApiException(400, "Invalid CSV content.");
        }
        return rows;
    }

    private static int parseInt(String value, int fallback) {
        try {
            return Integer.parseInt(value.trim());
        } catch (Exception ex) {
            return fallback;
        }
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        String escaped = value.replace("\"", "\"\"");
        if (escaped.contains(",") || escaped.contains("\"") || escaped.contains("\n")) {
            return "\"" + escaped + "\"";
        }
        return escaped;
    }
}
