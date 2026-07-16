// TypeScript types for ScanIT API — aligned with backend DTOs

export type BusinessType = 'Restaurant' | 'Bar' | 'School' | 'Boutique'

export interface CatalogItem {
  id: string
  name: string
  category: string
  price: number
  description: string
  available: boolean
}

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
  customerUrl?: string
  createdAt?: string
  items: CatalogItem[]
}

export interface CreateBusinessRequest {
  businessName: string
  ownerName: string
  phone?: string
  type: BusinessType
}

export interface BusinessResponse {
  business: Business
}

export interface BusinessesResponse {
  businesses: Business[]
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

export interface CatalogItemResponse {
  item: CatalogItem
}

export interface CatalogItemsResponse {
  items: CatalogItem[]
}

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
  publicId?: string
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
  updatedAt?: string
}

/** Matches backend RequestDtos.CreateOrderRequest */
export interface CreateOrderRequest {
  customer: {
    name: string
    phone?: string
    location?: string
    note?: string
  }
  items: Array<{
    id?: string
    itemId?: string
    quantity: number
  }>
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

export interface CartLine extends CatalogItem {
  quantity: number
  lineTotal: number
}

export type MerchantBusinessType =
  | 'RESTAURANT'
  | 'BAR'
  | 'PARKING'
  | 'EVENT'
  | 'SALON'
  | 'RETAIL'
  | 'OTHER'

export interface MerchantProfile {
  id: string
  email: string
  businessName: string
  businessType: MerchantBusinessType
  phoneNumber: string
  qrCodeToken: string | null
  qrCodeUrl: string | null
  qrCodeGenerated: boolean
  emailVerified: boolean
  onboardingCompleted: boolean
  onboardingStep: number
  status: string
  plan: string
  createdAt: string
}

export interface OnboardingStepStatus {
  stepNumber: number
  title: string
  description: string
  completed: boolean
  completedAt?: string
  actionUrl?: string
}

export interface OnboardingStatusResponse {
  currentStep: number
  totalSteps: number
  completed: boolean
  steps: {
    emailVerification: OnboardingStepStatus
    qrCodeGeneration: OnboardingStepStatus
    catalogSetup: OnboardingStepStatus
    testOrder: OnboardingStepStatus
    complete: OnboardingStepStatus
  }
}

export interface MerchantMeResponse {
  merchant: MerchantProfile
  business: Business
  onboarding: OnboardingStatusResponse
}

export interface QrCodeResponse {
  qrCodeToken: string
  qrCodeUrl: string
  qrCodeDataUrl: string
  newlyGenerated: boolean
  generatedAt: string
  printCount: number
  downloadUrl: string
}

export interface MenuResponse {
  business: Business
  items: CatalogItem[]
}

export interface CreateTicketRequest {
  ticketType: string
  eventName: string
  eventDate: string
  holderName?: string
  holderPhone?: string
  holderEmail?: string
  price: number
  currency?: string
  usageLimit: number
  expiresAt?: string
  issuedBy?: string
  metadata?: string
}

export interface Ticket {
  id: string
  qrToken: string
  ticketType: string
  eventName: string
  eventDate: string
  holderName: string
  holderPhone: string
  holderEmail: string
  price: number
  currency: string
  status: 'Active' | 'Redeemed' | 'Cancelled' | 'Expired'
  usageLimit: number
  usageCount: number
  expiresAt?: string
  paymentReference?: string
  paymentStatus: 'Unpaid' | 'Paid' | 'Refunded'
  issuedBy?: string
  metadata?: string
  createdAt: string
  updatedAt?: string
  redeemedAt?: string
  canBeUsed: boolean
  qrCodeUrl: string
}

export interface UpdateTicketStatusRequest {
  status: Ticket['status']
}

export interface TicketStats {
  eventName: string
  totalTickets: number
  purchasedTickets: number
}
