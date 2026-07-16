// Admin API Types
// TypeScript type definitions for admin API responses

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

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
}

export interface PendingOrder {
  orderId: string
  businessName: string
  customerName: string
  total: number
  status: string
  createdAt: string
}

export interface RecentActivity {
  activityType: string
  description: string
  timestamp: string
  metadata?: Record<string, any>
}

// ============================================================================
// MERCHANT TYPES
// ============================================================================

export interface Merchant {
  id: string
  name: string
  owner: string
  type: string
  plan: string
  orders: number
  revenue: number
  currency: string
  status: 'active' | 'warning' | 'suspended' | 'pending'
  joinedAt: string
}

export interface MerchantStats {
  merchantId: string
  businessName: string
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
}

// ============================================================================
// ORDER TYPES
// ============================================================================

export type OrderStatus = 'Pending' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled'
export type PaymentStatus = 'Unpaid' | 'Paid' | 'Refunded'

export interface AdminOrder {
  id: string
  businessId: string
  businessName: string
  merchantId: string
  customerName: string
  items: Array<{
    id: string
    name: string
    price: number
    quantity: number
  }>
  total: number
  paymentStatus: PaymentStatus
  status: OrderStatus
  createdAt: string
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface TicketAnalytics {
  totalTickets: number
  scannedTickets: number
  activeTickets: number
  expiredTickets: number
  totalRevenue: number
}

export interface QuickPaymentAnalytics {
  totalCodes: number
  activeCodes: number
  totalTransactions: number
  totalRevenue: number
  averageTransactionValue: number
}

export interface DeviceAnalytics {
  totalDevices: number
  activeDevices: number
  devicesWithAutoPayment: number
  averagePaymentMethodsPerDevice: number
}

export interface RevenueBreakdown {
  source: string
  amount: number
  percentage: number
}

// ============================================================================
// SYSTEM HEALTH TYPES
// ============================================================================

export interface SystemHealth {
  database: {
    status: string
    responseTime: number
  }
  api: {
    status: string
    uptime: number
  }
}

// ============================================================================
// API RESPONSE WRAPPERS
// ============================================================================

export interface DashboardMetricsResponse {
  metrics: DashboardMetrics
}

export interface PendingOrdersResponse {
  orders: PendingOrder[]
}

export interface RecentActivityResponse {
  activities: RecentActivity[]
}

export interface MerchantsResponse {
  merchants: Merchant[]
}

export interface MerchantStatsResponse {
  stats: MerchantStats[]
}

export interface OrdersResponse {
  orders: AdminOrder[]
}

export interface TicketAnalyticsResponse {
  analytics: TicketAnalytics
}

export interface QuickPaymentAnalyticsResponse {
  analytics: QuickPaymentAnalytics
}

export interface DeviceAnalyticsResponse {
  analytics: DeviceAnalytics
}

export interface RevenueBreakdownResponse {
  breakdown: RevenueBreakdown[]
}

export interface SystemHealthResponse {
  health: SystemHealth
}

export interface TicketEventStats {
  eventName: string
  totalTickets: number
  purchasedTickets: number
}
