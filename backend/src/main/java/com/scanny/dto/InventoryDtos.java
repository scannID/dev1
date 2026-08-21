package com.scanny.dto;

import com.scanny.entity.Ingredient;
import com.scanny.entity.RecipeLine;
import com.scanny.entity.StockMovement;
import com.scanny.model.enums.StockMovementType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class InventoryDtos {

    private InventoryDtos() {}

    public record IngredientResponse(
            String id,
            String name,
            String unit,
            String category,
            java.math.BigDecimal qtyOnHand,
            int avgUnitCost,
            java.math.BigDecimal lowStockThreshold,
            java.math.BigDecimal parLevel,
            java.math.BigDecimal reorderQty,
            String supplierId,
            String sku,
            boolean active,
            boolean lowStock,
            boolean needsReorder,
            int stockValue,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static IngredientResponse from(Ingredient ingredient) {
            return new IngredientResponse(
                    ingredient.getId(),
                    ingredient.getName(),
                    ingredient.getUnit(),
                    ingredient.getCategory(),
                    ingredient.getQtyOnHand(),
                    ingredient.getAvgUnitCost(),
                    ingredient.getLowStockThreshold(),
                    ingredient.getParLevel(),
                    ingredient.getReorderQty(),
                    ingredient.getSupplierId(),
                    ingredient.getSku(),
                    ingredient.isActive(),
                    ingredient.isLowStock(),
                    ingredient.needsReorder(),
                    ingredient.stockValue(),
                    ingredient.getCreatedAt(),
                    ingredient.getUpdatedAt()
            );
        }
    }

    public record CreateIngredientRequest(
            @NotBlank @Size(max = 255) String name,
            @NotBlank @Size(max = 16) String unit,
            @Size(max = 64) String category,
            @Min(0) Integer avgUnitCost,
            BigDecimal qtyOnHand,
            BigDecimal lowStockThreshold,
            @Size(max = 64) String sku
    ) {}

    public record UpdateIngredientRequest(
            @Size(max = 255) String name,
            @Size(max = 16) String unit,
            @Size(max = 64) String category,
            @Min(0) Integer avgUnitCost,
            BigDecimal lowStockThreshold,
            @Size(max = 64) String sku,
            Boolean active
    ) {}

    public record ReceiveStockRequest(
            @NotNull @DecimalMin(value = "0.0001") BigDecimal qty,
            @NotNull @Min(0) Integer unitCost,
            @Size(max = 500) String note
    ) {}

    public record AdjustStockRequest(
            @NotNull BigDecimal qtyDelta,
            @Size(max = 500) String note
    ) {}

    public record WasteStockRequest(
            @NotNull @DecimalMin(value = "0.0001") BigDecimal qty,
            @Size(max = 500) String note
    ) {}

    public record TransferStockRequest(
            @NotBlank String toBusinessId,
            @NotNull @DecimalMin(value = "0.0001") BigDecimal qty,
            @Size(max = 500) String note
    ) {}

    public record TransferStockResponse(
            String transferGroupId,
            IngredientResponse fromIngredient,
            IngredientResponse toIngredient,
            String fromBusinessId,
            String toBusinessId,
            String fromBranchLabel,
            String toBranchLabel,
            BigDecimal qty
    ) {}

    public record RecipeLineRequest(
            @NotBlank String ingredientId,
            @NotNull @DecimalMin(value = "0.0001") BigDecimal qtyPerSale
    ) {}

    public record SetRecipeRequest(
            @NotNull @Valid List<RecipeLineRequest> lines
    ) {}

    public record RecipeLineResponse(
            Long id,
            String ingredientId,
            String ingredientName,
            String unit,
            BigDecimal qtyPerSale,
            int avgUnitCost,
            int estimatedCost
    ) {
        public static RecipeLineResponse from(RecipeLine line) {
            Ingredient ingredient = line.getIngredient();
            BigDecimal qty = line.getQtyPerSale();
            int estimated = qty.multiply(BigDecimal.valueOf(ingredient.getAvgUnitCost()))
                    .setScale(0, java.math.RoundingMode.HALF_UP)
                    .intValue();
            return new RecipeLineResponse(
                    line.getId(),
                    ingredient.getId(),
                    ingredient.getName(),
                    ingredient.getUnit(),
                    qty,
                    ingredient.getAvgUnitCost(),
                    estimated
            );
        }
    }

    public record RecipeResponse(
            String catalogItemId,
            String catalogItemName,
            int sellPrice,
            int estimatedCost,
            Integer marginPercent,
            List<RecipeLineResponse> lines
    ) {}

    public record StockMovementResponse(
            Long id,
            String ingredientId,
            String ingredientName,
            StockMovementType movementType,
            BigDecimal qtyDelta,
            int unitCost,
            String orderId,
            String transferGroupId,
            String relatedBusinessId,
            String relatedIngredientId,
            String note,
            String actor,
            Instant createdAt
    ) {
        public static StockMovementResponse from(StockMovement movement) {
            return new StockMovementResponse(
                    movement.getId(),
                    movement.getIngredient().getId(),
                    movement.getIngredient().getName(),
                    movement.getMovementType(),
                    movement.getQtyDelta(),
                    movement.getUnitCost(),
                    movement.getOrderId(),
                    movement.getTransferGroupId(),
                    movement.getRelatedBusinessId(),
                    movement.getRelatedIngredientId(),
                    movement.getNote(),
                    movement.getActor(),
                    movement.getCreatedAt()
            );
        }
    }

    public record InventorySummaryResponse(
            int ingredientCount,
            int lowStockCount,
            int stockValueTotal,
            List<IngredientResponse> lowStockItems
    ) {}

    public record UpdateParLevelRequest(
            java.math.BigDecimal parLevel,
            java.math.BigDecimal reorderQty,
            String supplierId
    ) {}

    public record VarianceRow(
            String ingredientId,
            String ingredientName,
            String unit,
            java.math.BigDecimal receivedQty,
            java.math.BigDecimal theoreticalConsumption,
            java.math.BigDecimal actualConsumption,
            java.math.BigDecimal recordedWaste,
            java.math.BigDecimal varianceQty,    // positive = used more than expected
            int varianceCost,                    // UGX
            int avgUnitCost
    ) {}
}
