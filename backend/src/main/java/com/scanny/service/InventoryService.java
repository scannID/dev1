package com.scanny.service;

import com.scanny.dto.InventoryDtos;
import com.scanny.entity.Business;
import com.scanny.entity.CatalogItem;
import com.scanny.entity.Ingredient;
import com.scanny.entity.Order;
import com.scanny.entity.OrderLineItem;
import com.scanny.entity.RecipeLine;
import com.scanny.entity.StockMovement;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.ItemKind;
import com.scanny.model.enums.StockMovementType;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.CatalogItemRepository;
import com.scanny.repository.IngredientRepository;
import com.scanny.repository.RecipeLineRepository;
import com.scanny.repository.StockMovementRepository;
import com.scanny.security.MerchantAccessService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryService {

    private static final Set<String> UNITS = Set.of("kg", "g", "L", "ml", "pcs", "portion");

    private final IngredientRepository ingredientRepository;
    private final RecipeLineRepository recipeLineRepository;
    private final StockMovementRepository stockMovementRepository;
    private final CatalogItemRepository catalogItemRepository;
    private final BusinessRepository businessRepository;
    private final MerchantAccessService merchantAccessService;
    private final OutboxService outboxService;

    public InventoryService(
            IngredientRepository ingredientRepository,
            RecipeLineRepository recipeLineRepository,
            StockMovementRepository stockMovementRepository,
            CatalogItemRepository catalogItemRepository,
            BusinessRepository businessRepository,
            MerchantAccessService merchantAccessService,
            OutboxService outboxService
    ) {
        this.ingredientRepository = ingredientRepository;
        this.recipeLineRepository = recipeLineRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.catalogItemRepository = catalogItemRepository;
        this.businessRepository = businessRepository;
        this.merchantAccessService = merchantAccessService;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.IngredientResponse> listIngredients(String businessId, boolean includeInactive) {
        merchantAccessService.requireOwnedBusiness(businessId);
        List<Ingredient> items = includeInactive
                ? ingredientRepository.findByBusiness_IdOrderByNameAsc(businessId)
                : ingredientRepository.findByBusiness_IdAndActiveTrueOrderByNameAsc(businessId);
        return items.stream().map(InventoryDtos.IngredientResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public InventoryDtos.InventorySummaryResponse summary(String businessId) {
        merchantAccessService.requireOwnedBusiness(businessId);
        List<Ingredient> active = ingredientRepository.findByBusiness_IdAndActiveTrueOrderByNameAsc(businessId);
        List<Ingredient> low = active.stream().filter(Ingredient::isLowStock).toList();
        int stockValue = active.stream().mapToInt(Ingredient::stockValue).sum();
        return new InventoryDtos.InventorySummaryResponse(
                active.size(),
                low.size(),
                stockValue,
                low.stream().map(InventoryDtos.IngredientResponse::from).toList()
        );
    }

    @Transactional
    public InventoryDtos.IngredientResponse createIngredient(
            String businessId,
            InventoryDtos.CreateIngredientRequest request
    ) {
        Business business = merchantAccessService.requireOwnedBusiness(businessId);
        String name = request.name().trim();
        if (ingredientRepository.existsByBusiness_IdAndNameIgnoreCase(businessId, name)) {
            throw new ApiException(409, "An ingredient with that name already exists.");
        }
        Ingredient ingredient = new Ingredient();
        ingredient.setId(generateIngredientId());
        ingredient.setBusiness(business);
        ingredient.setName(name);
        ingredient.setUnit(normalizeUnit(request.unit()));
        ingredient.setCategory(blankToEmpty(request.category()));
        ingredient.setAvgUnitCost(request.avgUnitCost() == null ? 0 : request.avgUnitCost());
        ingredient.setQtyOnHand(normalizeQty(request.qtyOnHand()));
        ingredient.setLowStockThreshold(normalizeQty(request.lowStockThreshold()));
        ingredient.setSku(blankToEmpty(request.sku()));
        ingredient.setCreatedAt(Instant.now());
        Ingredient saved = ingredientRepository.save(ingredient);

        if (saved.getQtyOnHand().compareTo(BigDecimal.ZERO) > 0) {
            recordMovement(
                    business,
                    saved,
                    StockMovementType.RECEIVE,
                    saved.getQtyOnHand(),
                    saved.getAvgUnitCost(),
                    null,
                    "Opening stock",
                    "merchant"
            );
        }
        return InventoryDtos.IngredientResponse.from(saved);
    }

    @Transactional
    public InventoryDtos.IngredientResponse updateIngredient(
            String businessId,
            String ingredientId,
            InventoryDtos.UpdateIngredientRequest request
    ) {
        Ingredient ingredient = requireIngredient(businessId, ingredientId);
        if (request.name() != null && !request.name().isBlank()) {
            String name = request.name().trim();
            if (!name.equalsIgnoreCase(ingredient.getName())
                    && ingredientRepository.existsByBusiness_IdAndNameIgnoreCase(businessId, name)) {
                throw new ApiException(409, "An ingredient with that name already exists.");
            }
            ingredient.setName(name);
        }
        if (request.unit() != null && !request.unit().isBlank()) {
            ingredient.setUnit(normalizeUnit(request.unit()));
        }
        if (request.category() != null) {
            ingredient.setCategory(blankToEmpty(request.category()));
        }
        if (request.avgUnitCost() != null) {
            ingredient.setAvgUnitCost(request.avgUnitCost());
        }
        if (request.lowStockThreshold() != null) {
            ingredient.setLowStockThreshold(normalizeQty(request.lowStockThreshold()));
        }
        if (request.sku() != null) {
            ingredient.setSku(blankToEmpty(request.sku()));
        }
        if (request.active() != null) {
            ingredient.setActive(request.active());
        }
        ingredient.setUpdatedAt(Instant.now());
        return InventoryDtos.IngredientResponse.from(ingredientRepository.save(ingredient));
    }

    @Transactional
    public InventoryDtos.IngredientResponse receiveStock(
            String businessId,
            String ingredientId,
            InventoryDtos.ReceiveStockRequest request
    ) {
        Ingredient ingredient = requireIngredient(businessId, ingredientId);
        BigDecimal qty = normalizeQty(request.qty());
        if (qty.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(400, "Receive quantity must be greater than zero.");
        }
        int unitCost = request.unitCost();
        BigDecimal oldQty = ingredient.getQtyOnHand();
        int oldCost = ingredient.getAvgUnitCost();
        BigDecimal newQty = oldQty.add(qty);

        // Weighted average unit cost
        BigDecimal oldValue = oldQty.multiply(BigDecimal.valueOf(oldCost));
        BigDecimal addValue = qty.multiply(BigDecimal.valueOf(unitCost));
        int newAvg = newQty.compareTo(BigDecimal.ZERO) <= 0
                ? unitCost
                : oldValue.add(addValue).divide(newQty, 0, RoundingMode.HALF_UP).intValue();

        ingredient.setQtyOnHand(newQty);
        ingredient.setAvgUnitCost(newAvg);
        ingredient.setUpdatedAt(Instant.now());
        ingredientRepository.save(ingredient);

        recordMovement(
                ingredient.getBusiness(),
                ingredient,
                StockMovementType.RECEIVE,
                qty,
                unitCost,
                null,
                blankToEmpty(request.note()),
                "merchant"
        );
        maybeAlertLowStock(ingredient);
        return InventoryDtos.IngredientResponse.from(ingredient);
    }

    @Transactional
    public InventoryDtos.IngredientResponse adjustStock(
            String businessId,
            String ingredientId,
            InventoryDtos.AdjustStockRequest request
    ) {
        Ingredient ingredient = requireIngredient(businessId, ingredientId);
        BigDecimal delta = request.qtyDelta() == null ? BigDecimal.ZERO : request.qtyDelta().setScale(4, RoundingMode.HALF_UP);
        if (delta.compareTo(BigDecimal.ZERO) == 0) {
            throw new ApiException(400, "Adjustment quantity cannot be zero.");
        }
        BigDecimal next = ingredient.getQtyOnHand().add(delta);
        if (next.compareTo(BigDecimal.ZERO) < 0) {
            throw new ApiException(400, "Adjustment would make stock negative.");
        }
        ingredient.setQtyOnHand(next);
        ingredient.setUpdatedAt(Instant.now());
        ingredientRepository.save(ingredient);

        recordMovement(
                ingredient.getBusiness(),
                ingredient,
                StockMovementType.ADJUST,
                delta,
                ingredient.getAvgUnitCost(),
                null,
                blankToEmpty(request.note()),
                "merchant"
        );
        maybeAlertLowStock(ingredient);
        return InventoryDtos.IngredientResponse.from(ingredient);
    }

    @Transactional
    public InventoryDtos.IngredientResponse wasteStock(
            String businessId,
            String ingredientId,
            InventoryDtos.WasteStockRequest request
    ) {
        Ingredient ingredient = requireIngredient(businessId, ingredientId);
        BigDecimal qty = normalizeQty(request.qty());
        if (qty.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(400, "Waste quantity must be greater than zero.");
        }
        if (ingredient.getQtyOnHand().compareTo(qty) < 0) {
            throw new ApiException(400, "Not enough stock to record as waste.");
        }
        ingredient.setQtyOnHand(ingredient.getQtyOnHand().subtract(qty));
        ingredient.setUpdatedAt(Instant.now());
        ingredientRepository.save(ingredient);

        recordMovement(
                ingredient.getBusiness(),
                ingredient,
                StockMovementType.WASTE,
                qty.negate(),
                ingredient.getAvgUnitCost(),
                null,
                blankToEmpty(request.note()),
                "merchant"
        );
        maybeAlertLowStock(ingredient);
        return InventoryDtos.IngredientResponse.from(ingredient);
    }

    /**
     * Move stock from this branch to a sibling branch.
     * Creates a matched TRANSFER_OUT + TRANSFER_IN pair (same transferGroupId, same qty, same unit cost).
     * Adjust is for same-branch corrections only — use transfer for cross-branch moves.
     */
    @Transactional
    public InventoryDtos.TransferStockResponse transferStock(
            String fromBusinessId,
            String ingredientId,
            InventoryDtos.TransferStockRequest request
    ) {
        Ingredient source = requireIngredient(fromBusinessId, ingredientId);
        Business fromBusiness = source.getBusiness();
        String toBusinessId = request.toBusinessId().trim();
        if (toBusinessId.equals(fromBusinessId)) {
            throw new ApiException(400, "Choose a different branch to transfer to.");
        }

        Business toBusiness = businessRepository.findById(toBusinessId)
                .orElseThrow(() -> new ApiException(404, "Destination branch was not found."));
        // Ensure caller owns destination too (same merchant)
        merchantAccessService.requireOwnedBusiness(toBusinessId);
        if (!fromBusiness.getMerchantId().equals(toBusiness.getMerchantId())) {
            throw new ApiException(403, "Branches must belong to the same business.");
        }

        BigDecimal qty = normalizeQty(request.qty());
        if (qty.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(400, "Transfer quantity must be greater than zero.");
        }
        if (source.getQtyOnHand().compareTo(qty) < 0) {
            throw new ApiException(400,
                    "Not enough stock to transfer. On hand: "
                            + source.getQtyOnHand().stripTrailingZeros().toPlainString()
                            + " " + source.getUnit()
                            + ", requested: "
                            + qty.stripTrailingZeros().toPlainString()
                            + " " + source.getUnit() + ".");
        }

        Ingredient dest = findOrCreateMatchingIngredient(toBusiness, source);
        if (!dest.getUnit().equalsIgnoreCase(source.getUnit())) {
            throw new ApiException(400,
                    "Destination ingredient \"" + dest.getName() + "\" uses unit "
                            + dest.getUnit() + ", but source uses " + source.getUnit() + ".");
        }

        int unitCost = source.getAvgUnitCost();
        String transferGroupId = "XFR-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase(Locale.ROOT);
        String fromLabel = branchLabelOf(fromBusiness);
        String toLabel = branchLabelOf(toBusiness);
        String note = blankToEmpty(request.note());
        String outNote = note.isEmpty()
                ? "Transfer to " + toLabel
                : "Transfer to " + toLabel + " · " + note;
        String inNote = note.isEmpty()
                ? "Transfer from " + fromLabel
                : "Transfer from " + fromLabel + " · " + note;

        // Source: decrease
        source.setQtyOnHand(source.getQtyOnHand().subtract(qty));
        source.setUpdatedAt(Instant.now());
        ingredientRepository.save(source);

        // Dest: increase with weighted average cost (same as receive)
        BigDecimal destOldQty = dest.getQtyOnHand();
        int destOldCost = dest.getAvgUnitCost();
        BigDecimal destNewQty = destOldQty.add(qty);
        int destNewAvg = destNewQty.compareTo(BigDecimal.ZERO) <= 0
                ? unitCost
                : destOldQty.multiply(BigDecimal.valueOf(destOldCost))
                        .add(qty.multiply(BigDecimal.valueOf(unitCost)))
                        .divide(destNewQty, 0, RoundingMode.HALF_UP)
                        .intValue();
        dest.setQtyOnHand(destNewQty);
        dest.setAvgUnitCost(destNewAvg);
        dest.setUpdatedAt(Instant.now());
        ingredientRepository.save(dest);

        Instant now = Instant.now();
        recordTransferMovement(
                fromBusiness,
                source,
                StockMovementType.TRANSFER_OUT,
                qty.negate(),
                unitCost,
                transferGroupId,
                toBusiness.getId(),
                dest.getId(),
                outNote,
                now
        );
        recordTransferMovement(
                toBusiness,
                dest,
                StockMovementType.TRANSFER_IN,
                qty,
                unitCost,
                transferGroupId,
                fromBusiness.getId(),
                source.getId(),
                inNote,
                now
        );

        maybeAlertLowStock(source);
        maybeAlertLowStock(dest);

        return new InventoryDtos.TransferStockResponse(
                transferGroupId,
                InventoryDtos.IngredientResponse.from(source),
                InventoryDtos.IngredientResponse.from(dest),
                fromBusiness.getId(),
                toBusiness.getId(),
                fromLabel,
                toLabel,
                qty
        );
    }

    @Transactional(readOnly = true)
    public InventoryDtos.RecipeResponse getRecipe(String businessId, String catalogItemId) {
        merchantAccessService.requireOwnedBusiness(businessId);
        CatalogItem item = requireFoodItem(businessId, catalogItemId);
        List<InventoryDtos.RecipeLineResponse> lines = recipeLineRepository
                .findByCatalogItem_IdOrderByIdAsc(catalogItemId)
                .stream()
                .map(InventoryDtos.RecipeLineResponse::from)
                .toList();
        return toRecipeResponse(item, lines);
    }

    @Transactional
    public InventoryDtos.RecipeResponse setRecipe(
            String businessId,
            String catalogItemId,
            InventoryDtos.SetRecipeRequest request
    ) {
        merchantAccessService.requireOwnedBusiness(businessId);
        CatalogItem item = requireFoodItem(businessId, catalogItemId);
        recipeLineRepository.deleteByCatalogItem_Id(catalogItemId);
        recipeLineRepository.flush();

        List<RecipeLine> saved = new ArrayList<>();
        Map<String, Boolean> seen = new HashMap<>();
        for (InventoryDtos.RecipeLineRequest lineReq : request.lines()) {
            if (seen.putIfAbsent(lineReq.ingredientId(), true) != null) {
                throw new ApiException(400, "Duplicate ingredient in recipe.");
            }
            Ingredient ingredient = requireIngredient(businessId, lineReq.ingredientId());
            RecipeLine line = new RecipeLine();
            line.setCatalogItem(item);
            line.setIngredient(ingredient);
            line.setQtyPerSale(normalizeQty(lineReq.qtyPerSale()));
            if (line.getQtyPerSale().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ApiException(400, "Recipe quantity must be greater than zero.");
            }
            saved.add(recipeLineRepository.save(line));
        }

        List<InventoryDtos.RecipeLineResponse> lines = saved.stream()
                .map(InventoryDtos.RecipeLineResponse::from)
                .toList();
        return toRecipeResponse(item, lines);
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.StockMovementResponse> listMovements(String businessId, int limit) {
        merchantAccessService.requireOwnedBusiness(businessId);
        int safeLimit = Math.min(Math.max(limit, 1), 200);
        return stockMovementRepository
                .findByBusiness_IdOrderByCreatedAtDesc(businessId, PageRequest.of(0, safeLimit))
                .stream()
                .map(InventoryDtos.StockMovementResponse::from)
                .toList();
    }

    /**
     * Consume recipe ingredients for a newly paid order and lock COGS on lines.
     * Safe to call multiple times — no-ops if already consumed.
     */
    @Transactional
    public void consumeForPaidOrder(Order order) {
        if (order == null || order.isInventoryConsumed()) {
            return;
        }
        if (stockMovementRepository.existsByOrderId(order.getId())) {
            order.setInventoryConsumed(true);
            return;
        }

        Business business = order.getBusiness();
        List<OrderLineItem> lines = order.getItems();
        if (lines == null || lines.isEmpty()) {
            order.setInventoryConsumed(true);
            order.setCogsTotal(0);
            return;
        }

        Set<String> itemIds = lines.stream().map(OrderLineItem::getItemId).collect(Collectors.toSet());
        List<RecipeLine> recipeLines = itemIds.isEmpty()
                ? List.of()
                : recipeLineRepository.findByCatalogItemIdInWithIngredient(itemIds);
        Map<String, List<RecipeLine>> byItem = recipeLines.stream()
                .collect(Collectors.groupingBy(r -> r.getCatalogItem().getId()));

        int orderCogs = 0;
        for (OrderLineItem line : lines) {
            List<RecipeLine> recipe = byItem.getOrDefault(line.getItemId(), List.of());
            if (recipe.isEmpty()) {
                line.setCostAmount(0);
                continue;
            }
            BigDecimal portions = BigDecimal.valueOf(line.getQuantity());
            int lineCogs = 0;
            for (RecipeLine recipeLine : recipe) {
                Ingredient ingredient = recipeLine.getIngredient();
                BigDecimal consumeQty = recipeLine.getQtyPerSale().multiply(portions).setScale(4, RoundingMode.HALF_UP);
                int unitCost = ingredient.getAvgUnitCost();
                int cost = consumeQty.multiply(BigDecimal.valueOf(unitCost))
                        .setScale(0, RoundingMode.HALF_UP)
                        .intValue();
                lineCogs += cost;

                BigDecimal nextQty = ingredient.getQtyOnHand().subtract(consumeQty);
                // Allow negative for awareness; do not block paid orders
                ingredient.setQtyOnHand(nextQty);
                ingredient.setUpdatedAt(Instant.now());
                ingredientRepository.save(ingredient);

                recordMovement(
                        business,
                        ingredient,
                        StockMovementType.CONSUME,
                        consumeQty.negate(),
                        unitCost,
                        order.getId(),
                        "Order " + order.getId() + " · " + line.getName(),
                        "system"
                );
                maybeAlertLowStock(ingredient);
            }
            line.setCostAmount(lineCogs);
            orderCogs += lineCogs;
        }

        order.setCogsTotal(orderCogs);
        order.setInventoryConsumed(true);
    }

    private InventoryDtos.RecipeResponse toRecipeResponse(
            CatalogItem item,
            List<InventoryDtos.RecipeLineResponse> lines
    ) {
        int estimated = lines.stream().mapToInt(InventoryDtos.RecipeLineResponse::estimatedCost).sum();
        int sell = item.getPrice();
        Integer margin = null;
        if (sell > 0) {
            margin = (int) Math.round(((sell - estimated) * 100.0) / sell);
        }
        return new InventoryDtos.RecipeResponse(
                item.getId(),
                item.getName(),
                sell,
                estimated,
                margin,
                lines
        );
    }

    private CatalogItem requireFoodItem(String businessId, String catalogItemId) {
        CatalogItem item = catalogItemRepository.findByBusinessIdAndIdIn(businessId, List.of(catalogItemId))
                .stream()
                .findFirst()
                .orElseThrow(() -> new ApiException(404, "Catalog item was not found."));
        if (item.getItemKind() != null && item.getItemKind() != ItemKind.FOOD) {
            throw new ApiException(400, "Recipes apply to food items only.");
        }
        return item;
    }

    private Ingredient requireIngredient(String businessId, String ingredientId) {
        merchantAccessService.requireOwnedBusiness(businessId);
        return ingredientRepository.findByIdAndBusiness_Id(ingredientId, businessId)
                .orElseThrow(() -> new ApiException(404, "Ingredient was not found."));
    }

    private void recordMovement(
            Business business,
            Ingredient ingredient,
            StockMovementType type,
            BigDecimal qtyDelta,
            int unitCost,
            String orderId,
            String note,
            String actor
    ) {
        recordTransferMovement(business, ingredient, type, qtyDelta, unitCost, null, null, null, note, Instant.now(), orderId, actor);
    }

    private void recordTransferMovement(
            Business business,
            Ingredient ingredient,
            StockMovementType type,
            BigDecimal qtyDelta,
            int unitCost,
            String transferGroupId,
            String relatedBusinessId,
            String relatedIngredientId,
            String note,
            Instant createdAt
    ) {
        recordTransferMovement(
                business,
                ingredient,
                type,
                qtyDelta,
                unitCost,
                transferGroupId,
                relatedBusinessId,
                relatedIngredientId,
                note,
                createdAt,
                null,
                "merchant"
        );
    }

    private void recordTransferMovement(
            Business business,
            Ingredient ingredient,
            StockMovementType type,
            BigDecimal qtyDelta,
            int unitCost,
            String transferGroupId,
            String relatedBusinessId,
            String relatedIngredientId,
            String note,
            Instant createdAt,
            String orderId,
            String actor
    ) {
        StockMovement movement = new StockMovement();
        movement.setBusiness(business);
        movement.setIngredient(ingredient);
        movement.setMovementType(type);
        movement.setQtyDelta(qtyDelta);
        movement.setUnitCost(unitCost);
        movement.setOrderId(orderId);
        movement.setTransferGroupId(transferGroupId);
        movement.setRelatedBusinessId(relatedBusinessId);
        movement.setRelatedIngredientId(relatedIngredientId);
        movement.setNote(note);
        movement.setActor(actor == null ? "merchant" : actor);
        movement.setCreatedAt(createdAt == null ? Instant.now() : createdAt);
        stockMovementRepository.save(movement);
    }

    private Ingredient findOrCreateMatchingIngredient(Business toBusiness, Ingredient source) {
        return ingredientRepository.findByBusiness_IdAndNameIgnoreCase(toBusiness.getId(), source.getName())
                .orElseGet(() -> {
                    Ingredient created = new Ingredient();
                    created.setId(generateIngredientId());
                    created.setBusiness(toBusiness);
                    created.setName(source.getName());
                    created.setUnit(source.getUnit());
                    created.setCategory(source.getCategory());
                    created.setAvgUnitCost(source.getAvgUnitCost());
                    created.setQtyOnHand(BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP));
                    created.setLowStockThreshold(source.getLowStockThreshold());
                    created.setSku(source.getSku());
                    created.setActive(true);
                    created.setCreatedAt(Instant.now());
                    return ingredientRepository.save(created);
                });
    }

    private static String branchLabelOf(Business business) {
        if (business.getBranchLabel() != null && !business.getBranchLabel().isBlank()) {
            return business.getBranchLabel().trim();
        }
        return business.getName();
    }

    private void maybeAlertLowStock(Ingredient ingredient) {
        if (!ingredient.isLowStock()) {
            return;
        }
        String businessId = ingredient.getBusiness().getId();
        Map<String, Object> payload = Map.of(
                "ingredientId", ingredient.getId(),
                "name", ingredient.getName(),
                "qtyOnHand", ingredient.getQtyOnHand(),
                "lowStockThreshold", ingredient.getLowStockThreshold(),
                "unit", ingredient.getUnit()
        );
        outboxService.enqueueRealtime("orders:" + businessId, "INGREDIENT_LOW_STOCK", businessId, payload);
    }

    private static String normalizeUnit(String unit) {
        String normalized = unit == null ? "pcs" : unit.trim();
        if (!UNITS.contains(normalized)) {
            throw new ApiException(400, "Unit must be one of: kg, g, L, ml, pcs, portion.");
        }
        return normalized;
    }

    private static BigDecimal normalizeQty(BigDecimal qty) {
        if (qty == null) {
            return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
        }
        return qty.setScale(4, RoundingMode.HALF_UP);
    }

    private static String blankToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private static String generateIngredientId() {
        return "ING-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }
}
