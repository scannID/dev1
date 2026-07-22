// TypeScript types for Scanny API — aligned with backend DTOs

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
  logoUrl?: string | null
  customerUrl?: string
  createdAt?: string
  items: CatalogItem[]
  categories?: string[]
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

export interface CategoriesResponse {
  categories: string[]
}

export interface CatalogItemResponse {
  item: CatalogItem
}

export interface CatalogItemsResponse {
  items: CatalogItem[]
  pagination?: PaginationMeta
}

export interface PaginationMeta {
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface PagedResult<T> {
  items: T[]
  pagination: PaginationMeta
}

export interface ListQuery {
  page?: number
  size?: number
  search?: string
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
  pagination?: PaginationMeta
}

export interface ClearCompletedResponse {
  deleted: number
  message: string
}

/** Public customer order tracking — limited fields from GET /orders/public/{publicId} */
export interface CustomerOrderTracking {
  id: string
  businessName: string
  items: Array<{ name: string; quantity: number }>
  total: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  createdAt: string
  updatedAt?: string
}

export interface CustomerOrderTrackingResponse {
  order: CustomerOrderTracking
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
  businessLogoUrl?: string | null
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
  gateUrl?: string | null
}

export interface UpdateTicketStatusRequest {
  status: Ticket['status']
}

export interface TicketStats {
  eventName: string
  totalTickets: number
  purchasedTickets: number
}

export interface TicketClassOption {
  name: string
  price: number
}

export interface TicketEventInfo {
  masterTicketId: string
  eventName: string
  eventDate: string | null
  currency: string
  template: string
  ticketClasses: TicketClassOption[]
  paymentDestination: string
  purchaseUrl: string
}

export interface TicketPurchaseRequest {
  masterQrToken: string
  ticketClass: string
  holderName: string
  holderEmail: string
  holderPhone: string
  provider?: string
}

export interface TicketPurchaseResponse {
  attendeeTicketId: string
  paymentId: string
  paymentStatus: PaymentIntentStatus
  message: string
  viewUrl: string
}

export interface GateScanResponse {
  valid: boolean
  result: string
  message: string
  holderName: string
  ticketType: string
  eventName: string
}

export interface GateEventResponse {
  eventName: string
  eventDate: string | null
}

export interface AttendeeTicketView {
  id: string
  ticketType: string
  eventName: string
  eventDate: string | null
  holderName: string
  holderEmail: string
  price: number
  currency: string
  status: string
  paymentStatus: string
  canBeUsed: boolean
  template: string
  metadata: string
  viewUrl: string
  qrToken: string
}

export interface DevicePaymentMethod {
  id: number
  phoneNumber: string
  paymentProvider: string
  accountName: string
  isDefault: boolean
  isVerified: boolean
}

export interface RegisteredDevice {
  id: string
  deviceId: string
  deviceName: string
  primaryPhone: string
  secondaryPhone?: string | null
  customerName?: string
  autoPaymentEnabled: boolean
  paymentMethods: DevicePaymentMethod[]
}

export interface RegisterDeviceRequest {
  deviceId: string
  deviceName?: string
  deviceModel?: string
  deviceOs?: string
  deviceFingerprint?: string
  primaryPhone: string
  customerName?: string
  customerEmail?: string
}

export interface PublicCreateQuickPaymentRequest {
  description: string
  amount: number
  currency?: string
  ownerName: string
  ownerPhone?: string
  ownerEmail: string
  paymentDestination: string
  paymentDestinationType?: string
}

export interface QuickPaymentCode {
  id: string
  qrToken: string
  trackingNumber: string
  codeType: string
  description: string
  amount: number
  currency: string
  status: 'Active' | 'Cancelled' | 'Invalid'
  usageCount: number
  ownerName: string
  ownerPhone: string
  ownerEmail: string
  paymentDestination: string
  paymentDestinationType: string
  merchantId?: string | null
  businessId?: string | null
  createdAt: string
  updatedAt?: string | null
  lastUsedAt?: string | null
  canBeUsed: boolean
  qrCodeUrl: string
  trackUrl: string
  emailSent: boolean
}

export interface QuickPaymentTransaction {
  id: number
  codeId: string
  transactionRef: string
  amount: number
  currency: string
  customerPhone: string
  customerName: string
  paymentMethod: string
  paymentProvider: string
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed' | 'Refunded' | 'Cancelled'
  deviceInfo?: string | null
  location: string
  createdAt: string
  completedAt?: string | null
  failedAt?: string | null
  failureReason?: string | null
}

export interface QuickPayTrackingMetrics {
  trackingNumber: string
  id: string
  description: string
  amount: number
  currency: string
  status: QuickPaymentCode['status']
  usageCount: number
  completedPayments: number
  pendingPayments: number
  failedPayments: number
  totalCollected: number
  ownerName: string
  ownerEmail: string
  paymentDestination: string
  paymentDestinationType: string
  qrCodeUrl: string
  trackUrl: string
  createdAt: string
  lastUsedAt?: string | null
  recentTransactions: QuickPaymentTransaction[]
}

export interface QuickPayInitiateResponse {
  valid: boolean
  message: string
  code: QuickPaymentCode
  transactionRef: string | null
}

export type PaymentContext = 'ORDER' | 'QUICK_PAY' | 'TICKET'

export type PaymentIntentStatus = 'Pending' | 'Processing' | 'Paid' | 'Failed' | 'Cancelled'

export interface PaymentInitiateRequest {
  context: PaymentContext
  referenceId: string
  provider?: string
  amount: number
  currency?: string
  customerPhone: string
  customerName?: string
  businessId?: string
  description?: string
}

export interface PaymentInitiateResponse {
  paymentId: string
  providerId: string
  providerReference: string
  status: PaymentIntentStatus
  message: string
}

export interface PaymentStatusResponse {
  paymentId: string
  providerId: string
  status: PaymentIntentStatus
  message: string
  failureReason?: string | null
  updatedAt: string
}

export interface PaymentProviderInfo {
  id: string
  displayName: string
  available: boolean
}

export interface PaymentProvidersResponse {
  providers: PaymentProviderInfo[]
  defaultProvider: string
}

