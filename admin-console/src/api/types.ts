// Admin API Types — aligned with Spring admin DTOs

export interface DashboardMetrics {
  merchants: {
    total: number
    change: string
    thisWeek: number
  }
  ordersToday: {
    total: number
    change: string
  }
  qrScans: {
    last24Hours: number
    change: string
  }
  revenue: {
    thisMonth: number
    currency: string
    change: string
  }
  sparklines: {
    merchants: number[]
    ordersToday: number[]
    qrScans: number[]
    revenue: number[]
  }
}

export interface ActivityEvent {
  id: string
  type: string
  title: string
  description: string
  timestamp: string
  icon: string
}

export interface TopMerchant {
  id: string
  name: string
  type: string
  orders: number
  revenue: number
  currency: string
  status: string
}

export interface Merchant {
  id: string
  name: string
  owner: string
  type: string
  plan: string
  orders: number
  revenue: number
  currency: string
  status: string
  joinedAt: string
}

export interface MerchantSummary {
  total: number
  active: number
  pending: number
  suspended: number
}

export interface MerchantsListResponse {
  merchants: Merchant[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  summary: MerchantSummary
}

export type OrderStatus = 'Pending' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled'
export type PaymentStatus = 'Unpaid' | 'Paid' | 'Refunded'

export interface AdminOrder {
  id: string
  merchantId: string
  merchantName: string
  customerName: string
  items: number
  total: number
  currency: string
  paymentStatus: PaymentStatus | string
  status: OrderStatus | string
  createdAt: string
  completedAt?: string | null
}

export interface OrdersListResponse {
  orders: AdminOrder[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  summary: {
    today: number
    completed: number
    pending: number
    cancelled: number
  }
}

export interface TicketAnalytics {
  summary: {
    totalTickets: number
    activeTickets: number
    redeemedTickets: number
    expiredTickets: number
  }
  byType: Array<{ type: string; count: number; revenue: number }>
  scanActivity: Array<{ date: string; scans: number; successful: number; failed: number }>
}

export interface QuickPaymentAnalytics {
  summary: {
    totalCodes: number
    activeCodes: number
    totalTransactions: number
    totalRevenue: number
  }
  topCodes: Array<{ id: string; description: string; transactions: number; revenue: number }>
  byCategory: Array<{ category: string; codes: number; transactions: number }>
}

export interface DeviceAnalytics {
  summary: {
    totalDevices: number
    activeDevices: number
    autoPaymentEnabled: number
    averageTransactionsPerDevice: number
  }
  adoption: Array<{ date: string; newDevices: number; autoPaymentEnabled: number }>
  topDevices: Array<{ deviceId: string; customerName: string; transactions: number; totalSpent: number }>
}

export interface RevenueOverview {
  currentMonth: {
    revenue: number
    transactions: number
    failedPayments: number
    avgOrderValue: number
    currency: string
    growth: {
      revenue: number
      transactions: number
      failedPayments: number
      avgOrderValue: number
    }
    merchantGmv: number
    platformFees: number
    psoFees: number
  }
  monthly: Array<{ month: string; revenue: number; transactions: number }>
  paymentMethods: Array<{ method: string; percentage: number; amount: number }>
}

export interface ServiceHealth {
  name: string
  status: string
  uptime: string
  latency: number | null
  unit: string | null
  incidents: number | null
}

export interface SystemHealth {
  services: ServiceHealth[]
  overall: {
    status: string
    uptime: string
    avgLatency: number
    openIncidents: number
    errorRate: number
  }
}

export interface CatalogItemRow {
  id: string
  name: string
  merchant: string
  merchantId: string
  category: string
  price: number
  currency: string
  available: boolean
  orders: number
}

export interface CatalogListResponse {
  items: CatalogItemRow[]
  summary: {
    total: number
    available: number
    hidden: number
    categories: number
  }
}

export interface UserRow {
  id: string
  name: string
  email: string
  role: string
  orders: number
  status: string
  joinedAt: string
}

export interface UsersListResponse {
  users: UserRow[]
  summary: {
    total: number
    customers: number
    merchants: number
    admins: number
  }
}

export interface QrActivityResponse {
  summary: {
    totalScansToday: number
    uniqueDevices: number
    conversionRate: number
    activeQrCodes: number
  }
  hourly: Array<{ hour: number; scans: number; orders: number }>
  topCodes: Array<{
    merchant: string
    merchantId: string
    token: string
    scans: number
    orders: number
    conversion: string
  }>
}

export interface AuditListResponse {
  events: Array<{
    id: string
    actor: string
    action: string
    target: string
    ip: string
    timestamp: string
  }>
  summary: {
    eventsToday: number
    adminActions: number
    systemEvents: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface RevenueTransaction {
  id: string
  merchant: string
  amount: number
  currency: string
  method: string
  status: string
  date: string
}

export interface ReportsOverview {
  ordersThisMonth: number
  revenueThisMonth: number
  newMerchantsThisMonth: number
  currency: string
}

export interface TicketEventStats {
  eventName: string
  totalTickets: number
  purchasedTickets: number
}

export interface CreatedEventSummary {
  eventId: string
  eventName: string
  eventDate: string | null
  createdAt: string
  autoDeleteAt: string | null
  status: string
  host: string
  location: string
  purchaseUrl: string
  attendeeTickets: number
  paidTickets: number
  redeemedTickets: number
}

export interface AdminTicket {
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
  status: string
  usageLimit: number
  usageCount: number
  paymentStatus: string
  issuedBy?: string
  metadata?: string
  createdAt: string
  redeemedAt?: string
  canBeUsed: boolean
  qrCodeUrl: string
}

export interface EventClassInput {
  name: string
  fee: number
  capacity?: number | null
}

export interface EventTableInput {
  name: string
  seats: number
  price: number
  capacity?: number | null
}

export interface UpdateCreatedEventRequest {
  eventName: string
  eventDate?: string | null
  ticketType: string
  price: number
  currency?: string
  template?: string
  payTo?: string
  location?: string
  time?: string
  host?: string
  hostContact?: string
  eventImageUrl?: string
  ticketClasses: EventClassInput[]
  tables: EventTableInput[]
}

export type ConfigSection =
  | 'platform'
  | 'auth'
  | 'payments'
  | 'orders'
  | 'qr'
  | 'notifications'
  | 'features'

export type ConfigMap = Record<string, string | number | boolean>

export interface PlatformConfigs {
  platform: ConfigMap
  auth: ConfigMap
  payments: ConfigMap
  orders: ConfigMap
  qr: ConfigMap
  notifications: ConfigMap
  features: ConfigMap
}

export interface AllConfigsResponse {
  configs: PlatformConfigs
}

export interface ConfigSectionResponse {
  section: ConfigSection
  config: ConfigMap
  updatedAt: string | null
  updatedBy: string | null
}

export interface ConfigActionResult {
  success: boolean
  action: string
  message: string
  details: Record<string, unknown>
}

export type ConfigAction =
  | 'purge-test-data'
  | 'clear-qr-scan-logs'
  | 'revoke-all-sessions'
  | 'reset-platform'

export type ScansOrdersRange = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface ScansOrdersSeries {
  range: ScansOrdersRange | string
  scans: number[]
  orders: number[]
  yMax: number
  xLabels: string[]
}

export type TrafficRange = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface TrafficSummary {
  totalScans: number
  totalOrders: number
  totalRevenue: number
  activeMerchants: number
}

export interface TrafficHeatmap {
  dayLabels: string[]
  hourLabels: number[]
  matrix: number[][]
  maxValue: number
}

export interface MerchantTrafficStat {
  merchantId: string
  merchantName: string
  scans: number
  orders: number
  revenue: number
}

export interface TrafficAnalytics {
  range: TrafficRange | string
  summary: TrafficSummary
  heatmap: TrafficHeatmap
  topRevenue: MerchantTrafficStat[]
  topScans: MerchantTrafficStat[]
  topOrders: MerchantTrafficStat[]
}

export interface CookieConsentSummary {
  total: number
  accepted: number
  essential: number
  uniqueClients: number
  last24Hours: number
}

export interface CookieConsentSeries {
  range: ScansOrdersRange | string
  accepted: number[]
  essential: number[]
  yMax: number
  xLabels: string[]
}

export interface CookieConsentRecent {
  choice: string
  source: string | null
  path: string | null
  clientId: string | null
  actorEmail: string | null
  consentedAt: string
}

export interface CookieConsentAnalytics {
  summary: CookieConsentSummary
  series: CookieConsentSeries
  recent: CookieConsentRecent[]
}

export interface AdminNotification {
  id: string
  icon: string
  title: string
  sub: string
  timestamp: string
  type: string
  unread: boolean
}

export interface NotificationsResponse {
  notifications: AdminNotification[]
  unread: number
}

export type BroadcastSeverity = 'INFO' | 'WARNING' | 'CRITICAL'
export type BroadcastStatus = 'DRAFT' | 'PUBLISHED' | 'REVOKED'

export interface AdminBroadcast {
  id: string
  title: string
  body: string
  severity: BroadcastSeverity
  status: BroadcastStatus
  createdBy: string | null
  createdByEmail: string | null
  createdAt: string
  publishedAt: string | null
  expiresAt: string | null
}

export interface AdminBroadcastListResponse {
  broadcasts: AdminBroadcast[]
}

export interface PublishBroadcastRequest {
  title: string
  body: string
  severity?: BroadcastSeverity
  expiresAt?: string | null
}
