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
  parLevel?: number
  reorderQty?: number
  supplierId?: string | null
  sku: string
  active: boolean
  lowStock: boolean
  needsReorder?: boolean
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
  supplierRef?: string
  poNumber?: string
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

  receive: (businessId: string, ingredientId: string, body: { qty: number; unitCost: number; supplierRef?: string; poNumber?: string; note?: string }) =>
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

// ── Suppliers ─────────────────────────────────────────────────────────────

export interface Supplier {
  id: string
  name: string
  contactName: string
  phone: string
  email: string
  address: string
  notes: string
  active: boolean
  createdAt?: string
  updatedAt?: string | null
}

export interface CreateSupplierRequest {
  name: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}

export interface UpdateSupplierRequest {
  name?: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  active?: boolean
}

// ── Purchase orders ────────────────────────────────────────────────────────

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'

export interface PurchaseOrderLine {
  id: number
  ingredientId: string
  ingredientName: string
  unit: string
  qtyOrdered: number
  qtyReceived: number
  unitCost: number
  lineTotal: number
}

export interface PurchaseOrder {
  id: string
  businessId: string
  supplierId?: string | null
  supplierName: string
  status: PurchaseOrderStatus
  reference: string
  notes: string
  totalCost: number
  createdAt: string
  updatedAt?: string | null
  sentAt?: string | null
  receivedAt?: string | null
  lines: PurchaseOrderLine[]
}

export interface CreatePurchaseOrderRequest {
  supplierId?: string
  supplierName?: string
  reference?: string
  notes?: string
  lines: Array<{ ingredientId: string; qtyOrdered: number; unitCost: number }>
}

export interface ReceivePurchaseOrderRequest {
  lines: Array<{
    ingredientId: string
    qtyReceived: number
    unitCost?: number
    batchNumber?: string
    expiryDate?: string | null
  }>
}

export interface ReorderSuggestion {
  ingredientId: string
  ingredientName: string
  unit: string
  qtyOnHand: number
  lowStockThreshold: number
  parLevel: number
  reorderQty: number
  avgUnitCost: number
  preferredSupplierId?: string | null
}

// ── Batches / expiry ──────────────────────────────────────────────────────

export interface IngredientBatch {
  id: number
  ingredientId: string
  ingredientName: string
  unit: string
  batchNumber: string
  qtyOriginal: number
  qtyRemaining: number
  unitCost: number
  expiryDate?: string | null
  expired: boolean
  expiringSoon: boolean
  receivedAt: string
  poId?: string | null
}

// ── Variance report ───────────────────────────────────────────────────────

export interface VarianceRow {
  ingredientId: string
  ingredientName: string
  unit: string
  receivedQty: number
  theoreticalConsumption: number
  actualConsumption: number
  recordedWaste: number
  varianceQty: number   // positive = used more than expected
  varianceCost: number  // UGX
  avgUnitCost: number
}

// ── Extended ingredient fields ────────────────────────────────────────────

export interface UpdateParLevelRequest {
  parLevel?: number
  reorderQty?: number
  supplierId?: string | null
}

// ── New API methods ───────────────────────────────────────────────────────

export const suppliersApi = {
  list: (businessId: string, includeInactive = false) =>
    api
      .get<{ items: Supplier[] }>(
        `/businesses/${businessId}/suppliers?includeInactive=${includeInactive}`,
      )
      .then((r) => r.items),

  create: (businessId: string, body: CreateSupplierRequest) =>
    api
      .post<{ item: Supplier }>(`/businesses/${businessId}/suppliers`, body)
      .then((r) => r.item),

  update: (businessId: string, supplierId: string, body: UpdateSupplierRequest) =>
    api
      .patch<{ item: Supplier }>(`/businesses/${businessId}/suppliers/${supplierId}`, body)
      .then((r) => r.item),
}

export const purchaseOrdersApi = {
  list: (businessId: string, status?: PurchaseOrderStatus) =>
    api
      .get<{ items: PurchaseOrder[] }>(
        `/businesses/${businessId}/purchase-orders${status ? `?status=${status}` : ''}`,
      )
      .then((r) => r.items),

  get: (businessId: string, poId: string) =>
    api.get<PurchaseOrder>(`/businesses/${businessId}/purchase-orders/${poId}`),

  create: (businessId: string, body: CreatePurchaseOrderRequest) =>
    api.post<PurchaseOrder>(`/businesses/${businessId}/purchase-orders`, body),

  send: (businessId: string, poId: string) =>
    api.post<PurchaseOrder>(`/businesses/${businessId}/purchase-orders/${poId}/send`, {}),

  receive: (businessId: string, poId: string, body: ReceivePurchaseOrderRequest) =>
    api.post<PurchaseOrder>(`/businesses/${businessId}/purchase-orders/${poId}/receive`, body),

  cancel: (businessId: string, poId: string) =>
    api.post<PurchaseOrder>(`/businesses/${businessId}/purchase-orders/${poId}/cancel`, {}),

  reorderSuggestions: (businessId: string) =>
    api
      .get<{ items: ReorderSuggestion[] }>(
        `/businesses/${businessId}/purchase-orders/reorder-suggestions`,
      )
      .then((r) => r.items),

  batches: (businessId: string, expiringWithinDays?: number) =>
    api
      .get<{ items: IngredientBatch[] }>(
        `/businesses/${businessId}/purchase-orders/batches${expiringWithinDays != null ? `?expiringWithinDays=${expiringWithinDays}` : ''}`,
      )
      .then((r) => r.items),
}

export const inventoryReportsApi = {
  variance: (businessId: string, from: string, to: string) =>
    api
      .get<{ items: VarianceRow[] }>(
        `/businesses/${businessId}/inventory/variance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      )
      .then((r) => r.items),

  updateParLevel: (businessId: string, ingredientId: string, body: UpdateParLevelRequest) =>
    api
      .patch<{ item: Ingredient }>(
        `/businesses/${businessId}/inventory/ingredients/${ingredientId}/par-level`,
        body,
      )
      .then((r) => r.item),
}
