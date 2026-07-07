// Admin API Services
// All admin API calls organized by domain

import { api } from './client'
import type {
  DashboardMetrics,
  DashboardMetricsResponse,
  PendingOrder,
  PendingOrdersResponse,
  RecentActivity,
  RecentActivityResponse,
  Merchant,
  MerchantsResponse,
  MerchantStats,
  MerchantStatsResponse,
  AdminOrder,
  OrdersResponse,
  TicketAnalytics,
  TicketAnalyticsResponse,
  QuickPaymentAnalytics,
  QuickPaymentAnalyticsResponse,
  DeviceAnalytics,
  DeviceAnalyticsResponse,
  RevenueBreakdown,
  RevenueBreakdownResponse,
  SystemHealth,
  SystemHealthResponse,
} from './types'

// ============================================================================
// DASHBOARD API
// ============================================================================

export const dashboardApi = {
  // Get dashboard metrics
  getMetrics: async (): Promise<DashboardMetrics> => {
    const response = await api.get<DashboardMetricsResponse>('/admin/dashboard')
    return response.metrics
  },

  // Get pending orders
  getPendingOrders: async (): Promise<PendingOrder[]> => {
    const response = await api.get<PendingOrdersResponse>('/admin/dashboard/pending-orders')
    return response.orders
  },

  // Get recent activity
  getRecentActivity: async (): Promise<RecentActivity[]> => {
    const response = await api.get<RecentActivityResponse>('/admin/dashboard/recent-activity')
    return response.activities
  },
}

// ============================================================================
// MERCHANTS API
// ============================================================================

export const merchantsApi = {
  // List all merchants
  list: async (): Promise<Merchant[]> => {
    const response = await api.get<MerchantsResponse>('/admin/merchants')
    return response.merchants
  },

  // Get merchant stats
  getStats: async (): Promise<MerchantStats[]> => {
    const response = await api.get<MerchantStatsResponse>('/admin/merchants/stats')
    return response.stats
  },

  // Get single merchant
  get: async (merchantId: string): Promise<Merchant> => {
    const response = await api.get<{ merchant: Merchant }>(`/admin/merchants/${merchantId}`)
    return response.merchant
  },
}

// ============================================================================
// ORDERS API
// ============================================================================

export const ordersApi = {
  // List all orders (platform-wide)
  list: async (): Promise<AdminOrder[]> => {
    const response = await api.get<OrdersResponse>('/admin/orders')
    return response.orders
  },

  // Get orders by status
  getByStatus: async (status: string): Promise<AdminOrder[]> => {
    const response = await api.get<OrdersResponse>(`/admin/orders/status/${status}`)
    return response.orders
  },

  // Get orders by payment status
  getByPaymentStatus: async (paymentStatus: string): Promise<AdminOrder[]> => {
    const response = await api.get<OrdersResponse>(`/admin/orders/payment/${paymentStatus}`)
    return response.orders
  },
}

// ============================================================================
// ANALYTICS API
// ============================================================================

export const analyticsApi = {
  // Get ticket analytics
  getTicketAnalytics: async (): Promise<TicketAnalytics> => {
    const response = await api.get<TicketAnalyticsResponse>('/admin/analytics/tickets')
    return response.analytics
  },

  // Get quick payment analytics
  getQuickPaymentAnalytics: async (): Promise<QuickPaymentAnalytics> => {
    const response = await api.get<QuickPaymentAnalyticsResponse>('/admin/analytics/quick-payments')
    return response.analytics
  },

  // Get device analytics
  getDeviceAnalytics: async (): Promise<DeviceAnalytics> => {
    const response = await api.get<DeviceAnalyticsResponse>('/admin/analytics/devices')
    return response.analytics
  },

  // Get revenue breakdown
  getRevenueBreakdown: async (): Promise<RevenueBreakdown[]> => {
    const response = await api.get<RevenueBreakdownResponse>('/admin/analytics/revenue')
    return response.breakdown
  },
}

// ============================================================================
// SYSTEM API
// ============================================================================

export const systemApi = {
  // Get system health
  getHealth: async (): Promise<SystemHealth> => {
    const response = await api.get<SystemHealthResponse>('/admin/system/health')
    return response.health
  },
}

// ============================================================================
// Combined Admin API Export
// ============================================================================

export const adminApi = {
  dashboard: dashboardApi,
  merchants: merchantsApi,
  orders: ordersApi,
  analytics: analyticsApi,
  system: systemApi,
}

export default adminApi
