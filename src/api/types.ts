// TypeScript types for ScanIT API
// Mirrors backend DTOs and entities

// ============================================================================
// BUSINESS TYPES
// ============================================================================

export type BusinessType = 'Restaurant' | 'Bar' | 'School' | 'Boutique'

export interface Business {
  id: string
  merchantId: string
  qrToken: string
  name: string
  ownerName: string
  phone: string
  type: BusinessType
  tableLabel: string
  paymentReference: string
  accent: string
  items: CatalogItem[]
}

export interface CreateBusinessRequest {
  name: string
  ownerName: string
  phone: string
  type: BusinessType
  tableLabel?: string
  paymentReference?: string
  accent?: string
}

export interface BusinessResponse {
  business: Business
}

export interface BusinessesResponse {
  businesses: Business[]
}

// ============================================================================
// CATALOG TYPES
// ============================================================================

export interface CatalogItem {
  id: string
  name: string
  category: string
  price: number
  description: string
  available: boolean
}

export interface CreateCatalogItemRequest {
  name: string
  category: string
  price: number
  description: string
  available?: boolean
}

export interface UpdateCatalogItemRequest {
  name?: string
  category?: string
  price?: number
  description?: string
  available?: boolean
}

export interface UpdateAvailabilityRequest {
  available: boolean
}

export interface CatalogItemResponse {
  item: CatalogItem
}

export interface CatalogItemsResponse {
  items: CatalogItem[]
}

// ============================================================================
// ORDER TYPES
// ============================================================================

export type OrderStatus = 'Pending' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled'
export type PaymentStatus = 'Unpaid' | 'Paid' | 'Refunded'

export interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  lineTotal: number
}

export interface Customer {
  name: string
  phone: string
  location: string
  note: string
}

export interface Order {
  id: string
  businessId: string
  merchantId: string
  qrToken: string
  paymentReference: string
  businessName: string
  customer: Customer
  items: OrderItem[]
  total: number
  paymentStatus: PaymentStatus
  status: OrderStatus
  createdAt: string
}

export interface CreateOrderRequest {
  customerName: string
  customerPhone?: string
  customerLocation?: string
  customerNote?: string
  items: Array<{
    id: string
    name: string
    price: number
    quantity: number
  }>
  total: number
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus
}

export interface UpdatePaymentStatusRequest {
  paymentStatus: PaymentStatus
}

export interface OrderResponse {
  order: Order
}

export interface OrdersResponse {
  orders: Order[]
}

export interface ClearCompletedResponse {
  deleted: number
  message: string
}

// ============================================================================
// CART TYPES (Client-side only)
// ============================================================================

export interface CartLine extends CatalogItem {
  quantity: number
  lineTotal: number
}
