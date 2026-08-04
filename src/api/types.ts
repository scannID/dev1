// TypeScript types for Scanny API — aligned with backend DTOs

export type BusinessType = 'Restaurant' | 'Bar' | 'School' | 'Boutique' | 'Hotel'

export type CatalogItemKind = 'FOOD' | 'ROOM' | 'SUITE'

export interface CatalogIngredient {
  id: string
  name: string
}

export interface CatalogItem {
  id: string
  name: string
  category: string
  price: number
  description: string
  imageUrl?: string | null
  imageUrls?: string[]
  details?: string
  ingredients?: CatalogIngredient[]
  available: boolean
  /** Knock-off percent from list price (0 = no discount). */
  discountPercent?: number
  itemKind?: CatalogItemKind
  capacity?: number
  amenities?: string[]
  unitsAvailable?: number
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
  acceptingOrders?: boolean
  busyMode?: boolean
  busyEtaMinutes?: number
  pauseMessage?: string
  branchLabel?: string
  primary?: boolean
  address?: string
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
  imageUrl?: string | null
  imageUrls?: string[]
  details?: string
  ingredients?: CatalogIngredient[]
  available?: boolean
  discountPercent?: number
  itemKind?: CatalogItemKind
  capacity?: number
  amenities?: string[]
  unitsAvailable?: number
}

export interface UpdateCatalogItemRequest {
  name?: string
  category?: string
  price?: number
  description?: string
  imageUrl?: string | null
  imageUrls?: string[]
  details?: string
  ingredients?: CatalogIngredient[]
  available?: boolean
  discountPercent?: number
  itemKind?: CatalogItemKind
  capacity?: number
  amenities?: string[]
  unitsAvailable?: number
}

export interface CategoriesResponse {
  categories: string[]
}

export interface CatalogItemResponse {
  item: CatalogItem
}

export interface ImageSearchResult {
  id: string
  thumbUrl: string
  imageUrl: string
  photographer: string
  photographerUrl: string
  alt: string
}

export interface ImageSearchResponse {
  query: string
  results: ImageSearchResult[]
  configured: boolean
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
  removedIngredients?: string[]
  checkInDate?: string | null
  checkOutDate?: string | null
  nights?: number | null
  costAmount?: number
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
  /** Item lines only — credited to merchant MoMo. */
  subtotal?: number
  serviceFee?: number
  psoFee?: number
  platformFee?: number
  /** Same as subtotal; what merchant receives on MoMo. */
  merchantPayout?: number
  merchantMomoDestination?: string
  paymentStatus: PaymentStatus
  status: OrderStatus
  createdAt: string
  updatedAt?: string
  /** Locked recipe COGS (UGX) after payment. */
  cogsTotal?: number
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
    removedIngredients?: string[]
    checkInDate?: string
    checkOutDate?: string
  }>
  tableId?: string
  tableQrToken?: string
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
  items: Array<{ name: string; quantity: number; removedIngredients?: string[] }>
  total: number
  subtotal?: number
  serviceFee?: number
  merchantPayout?: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  createdAt: string
  updatedAt?: string
  estimatedWaitMinutes?: number | null
}

export interface CustomerOrderTrackingResponse {
  order: CustomerOrderTracking
}

export interface CartLine extends CatalogItem {
  quantity: number
  lineTotal: number
  removedIngredients?: string[]
  lineKey?: string
  checkInDate?: string
  checkOutDate?: string
  nights?: number
}

export type MerchantBusinessType =
  | 'RESTAURANT'
  | 'HOTEL'
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
  businesses?: Business[]
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
  popular?: CatalogItem[]
  estimatedWaitMinutes?: number
}

export type MerchantMetricRange = 'day' | 'week' | 'month' | 'year'

export interface ScansOrdersSeries {
  range: string
  scans: number[]
  orders: number[]
  yMax: number
  xLabels: string[]
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

export interface TicketScanValidationResponse {
  valid: boolean
  result:
    | 'Success'
    | 'Invalid'
    | 'Expired'
    | 'Cancelled'
    | 'PaymentRequired'
    | 'UsageLimitReached'
  message: string
  ticket: Ticket
}

export interface TicketClassOption {
  name: string
  price: number
  capacity?: number | null
  sold?: number
  held?: number
  remaining?: number | null
  soldOut?: boolean
}

export interface TicketTableOption {
  name: string
  seats: number
  price: number
  capacity?: number | null
  sold?: number
  held?: number
  remaining?: number | null
  soldOut?: boolean
}

export interface TicketEventInfo {
  masterTicketId: string
  eventName: string
  eventDate: string | null
  currency: string
  template: string
  ticketClasses: TicketClassOption[]
  tables?: TicketTableOption[]
  paymentDestination: string
  purchaseUrl: string
  eventImageUrl?: string | null
  host?: string | null
}

export interface TicketPurchaseRequest {
  masterQrToken: string
  ticketClass: string
  holderName: string
  holderEmail?: string
  holderPhone: string
  provider?: string
}

export interface TicketPurchaseResponse {
  attendeeTicketId: string
  ticketCode: string
  paymentId: string
  paymentStatus: PaymentIntentStatus
  message: string
  viewUrl: string
}

export interface AttendeeTicketView {
  id: string
  ticketType: string
  eventName: string
  eventDate: string | null
  holderName: string
  holderEmail: string
  holderPhone: string
  price: number
  currency: string
  status: string
  paymentStatus: string
  canBeUsed: boolean
  template: string
  metadata: string
  viewUrl: string
  qrToken: string
  ticketCode: string
  qrPayload: string
  gateUrl: string
  purchaseUrl?: string
}

export interface EventTicketRecentAttendee {
  ticketId: string
  holderName: string
  holderEmail: string
  holderPhone: string
  ticketType: string
  price: number
  currency: string
  paymentStatus: string
  status: string
  createdAt: string
  viewUrl?: string
  qrPayload?: string
  gateUrl?: string
}

export interface GateRedeemedAttendee {
  ticketId: string
  ticketCode: string
  holderName: string
  holderPhone: string
  ticketType: string
  paymentStatus: string
  status: string
  redeemedAt: string | null
}

export interface EventTicketTrackingMetrics {
  ticketId: string
  eventName: string
  eventDate: string | null
  host: string
  eventImageUrl?: string
  status: string
  orderedTickets: number
  purchasedTickets: number
  pendingTickets: number
  redeemedTickets: number
  totalCollected: number
  currency: string
  purchaseUrl: string
  createdAt: string
  recentAttendees: EventTicketRecentAttendee[]
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

export type PaymentContext = 'ORDER' | 'ORDER_SPLIT' | 'QUICK_PAY' | 'TICKET'

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

export interface FeeConfig {
  serviceFeeUgx: number
  psoPercent: number
  currency: string
}

export type BroadcastSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface MerchantBroadcast {
  id: string
  title: string
  body: string
  severity: BroadcastSeverity
  publishedAt: string | null
  expiresAt: string | null
  unread: boolean
  dismissed: boolean
}

export interface MerchantBroadcastListResponse {
  broadcasts: MerchantBroadcast[]
  unread: number
}

