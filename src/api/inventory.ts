import { api } from './client'

export type IngredientUnit = 'kg' | 'g' | 'L' | 'ml' | 'pcs' | 'portion'

export type StockMovementType =
  | 'RECEIVE'
  | 'ADJUST'
  | 'WASTE'
  | 'CONSUME'
  | 'RETURN'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'

export interface Ingredient {
  id: string
  name: string
  unit: IngredientUnit | string
  category: string
  qtyOnHand: number
  avgUnitCost: number
  lowStockThreshold: number
  sku: string
  active: boolean
  lowStock: boolean
  stockValue: number
  createdAt?: string
  updatedAt?: string | null
}

export interface CreateIngredientRequest {
  name: string
  unit: string
  category?: string
  avgUnitCost?: number
  qtyOnHand?: number
  lowStockThreshold?: number
  sku?: string
}

export interface UpdateIngredientRequest {
  name?: string
  unit?: string
  category?: string
  avgUnitCost?: number
  lowStockThreshold?: number
  sku?: string
  active?: boolean
}

export interface RecipeLine {
  id?: number
  ingredientId: string
  ingredientName: string
  unit: string
  qtyPerSale: number
  avgUnitCost: number
  estimatedCost: number
}

export interface Recipe {
  catalogItemId: string
  catalogItemName: string
  sellPrice: number
  estimatedCost: number
  marginPercent: number | null
  lines: RecipeLine[]
}

export interface StockMovement {
  id: number
  ingredientId: string
  ingredientName: string
  movementType: StockMovementType
  qtyDelta: number
  unitCost: number
  orderId?: string | null
  transferGroupId?: string | null
  relatedBusinessId?: string | null
  relatedIngredientId?: string | null
  note: string
  actor: string
  createdAt: string
}

export interface TransferStockResponse {
  transferGroupId: string
  fromIngredient: Ingredient
  toIngredient: Ingredient
  fromBusinessId: string
  toBusinessId: string
  fromBranchLabel: string
  toBranchLabel: string
  qty: number
}

export interface InventorySummary {
  ingredientCount: number
  lowStockCount: number
  stockValueTotal: number
  lowStockItems: Ingredient[]
}

export const inventoryApi = {
  summary: (businessId: string) =>
    api.get<InventorySummary>(`/businesses/${businessId}/inventory/summary`),

  listIngredients: (businessId: string, includeInactive = false) =>
    api
      .get<{ items: Ingredient[] }>(
        `/businesses/${businessId}/inventory/ingredients?includeInactive=${includeInactive}`,
      )
      .then((r) => r.items),

  createIngredient: (businessId: string, body: CreateIngredientRequest) =>
    api
      .post<{ item: Ingredient }>(`/businesses/${businessId}/inventory/ingredients`, body)
      .then((r) => r.item),

  updateIngredient: (businessId: string, ingredientId: string, body: UpdateIngredientRequest) =>
    api
      .patch<{ item: Ingredient }>(
        `/businesses/${businessId}/inventory/ingredients/${ingredientId}`,
        body,
      )
      .then((r) => r.item),

  receive: (businessId: string, ingredientId: string, body: { qty: number; unitCost: number; note?: string }) =>
    api
      .post<{ item: Ingredient }>(
        `/businesses/${businessId}/inventory/ingredients/${ingredientId}/receive`,
        body,
      )
      .then((r) => r.item),

  adjust: (businessId: string, ingredientId: string, body: { qtyDelta: number; note?: string }) =>
    api
      .post<{ item: Ingredient }>(
        `/businesses/${businessId}/inventory/ingredients/${ingredientId}/adjust`,
        body,
      )
      .then((r) => r.item),

  waste: (businessId: string, ingredientId: string, body: { qty: number; note?: string }) =>
    api
      .post<{ item: Ingredient }>(
        `/businesses/${businessId}/inventory/ingredients/${ingredientId}/waste`,
        body,
      )
      .then((r) => r.item),

  transfer: (
    businessId: string,
    ingredientId: string,
    body: { toBusinessId: string; qty: number; note?: string },
  ) =>
    api.post<TransferStockResponse>(
      `/businesses/${businessId}/inventory/ingredients/${ingredientId}/transfer`,
      body,
    ),

  getRecipe: (businessId: string, catalogItemId: string) =>
    api.get<Recipe>(`/businesses/${businessId}/inventory/catalog/${catalogItemId}/recipe`),

  setRecipe: (
    businessId: string,
    catalogItemId: string,
    lines: Array<{ ingredientId: string; qtyPerSale: number }>,
  ) =>
    api.put<Recipe>(`/businesses/${businessId}/inventory/catalog/${catalogItemId}/recipe`, {
      lines,
    }),

  listMovements: (businessId: string, limit = 50) =>
    api
      .get<{ items: StockMovement[] }>(
        `/businesses/${businessId}/inventory/movements?limit=${limit}`,
      )
      .then((r) => r.items),
}
