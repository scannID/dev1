// Admin API Services — paths aligned with Spring controllers

import { api } from './client'
import type {
  DashboardMetrics,
  ActivityEvent,
  TopMerchant,
  MerchantsListResponse,
  Merchant,
  OrdersListResponse,
  AdminOrder,
  TicketAnalytics,
  QuickPaymentAnalytics,
  DeviceAnalytics,
  RevenueOverview,
  SystemHealth,
  CatalogListResponse,
  UsersListResponse,
  QrActivityResponse,
  AuditListResponse,
  RevenueTransaction,
  ReportsOverview,
  TicketEventStats,
  AdminTicket,
  AllConfigsResponse,
  ConfigSection,
  ConfigSectionResponse,
  ConfigMap,
  ConfigAction,
  ConfigActionResult,
  ScansOrdersRange,
  ScansOrdersSeries,
  NotificationsResponse,
} from './types'

export const dashboardApi = {
  getMetrics: async (): Promise<DashboardMetrics> => {
    return api.get<DashboardMetrics>('/admin/dashboard/metrics')
  },

  getRecentActivity: async (): Promise<ActivityEvent[]> => {
    return api.get<ActivityEvent[]>('/admin/dashboard/activity')
  },

  getTopMerchants: async (period = 'month', sortBy = 'orders', limit = 5): Promise<TopMerchant[]> => {
    return api.get<TopMerchant[]>(
      `/admin/dashboard/top-merchants?period=${period}&sortBy=${sortBy}&limit=${limit}`
    )
  },
}

export const merchantsApi = {
  list: async (params?: {
    page?: number
    limit?: number
    search?: string
    status?: string
    type?: string
  }): Promise<MerchantsListResponse> => {
    const query = new URLSearchParams()
    query.set('page', String(params?.page ?? 1))
    query.set('limit', String(params?.limit ?? 100))
    if (params?.search) query.set('search', params.search)
    if (params?.status) query.set('status', params.status)
    if (params?.type) query.set('type', params.type)
    return api.get<MerchantsListResponse>(`/admin/merchants?${query.toString()}`)
  },

  get: async (merchantId: string): Promise<Merchant> => {
    return api.get<Merchant>(`/admin/merchants/${merchantId}`)
  },

  update: async (merchantId: string, data: { name?: string; plan?: string; status?: string }) => {
    return api.patch(`/admin/merchants/${merchantId}`, data)
  },

  remove: async (merchantId: string) => {
    await api.delete(`/admin/merchants/${merchantId}`)
  },

  register: async (payload: unknown) => {
    return api.post('/auth/merchant/register', payload)
  },
}

export const ordersApi = {
  list: async (params?: {
    page?: number
    limit?: number
    search?: string
    status?: string
    paymentStatus?: string
    merchantId?: string
  }): Promise<OrdersListResponse> => {
    const query = new URLSearchParams()
    query.set('page', String(params?.page ?? 1))
    query.set('limit', String(params?.limit ?? 100))
    if (params?.search) query.set('search', params.search)
    if (params?.status) query.set('status', params.status)
    if (params?.paymentStatus) query.set('paymentStatus', params.paymentStatus)
    if (params?.merchantId) query.set('merchantId', params.merchantId)
    return api.get<OrdersListResponse>(`/admin/orders?${query.toString()}`)
  },

  get: async (orderId: string): Promise<AdminOrder> => {
    return api.get<AdminOrder>(`/admin/orders/${orderId}`)
  },
}

export const analyticsApi = {
  getTicketAnalytics: async (): Promise<TicketAnalytics> => {
    return api.get<TicketAnalytics>('/admin/analytics/tickets')
  },

  getQuickPaymentAnalytics: async (): Promise<QuickPaymentAnalytics> => {
    return api.get<QuickPaymentAnalytics>('/admin/analytics/quick-payments')
  },

  getDeviceAnalytics: async (): Promise<DeviceAnalytics> => {
    return api.get<DeviceAnalytics>('/admin/analytics/devices')
  },

  getScansOrders: async (range: ScansOrdersRange = 'daily'): Promise<ScansOrdersSeries> => {
    return api.get<ScansOrdersSeries>(`/admin/analytics/scans-orders?range=${range}`)
  },

  getRevenueOverview: async (): Promise<RevenueOverview> => {
    return api.get<RevenueOverview>('/admin/revenue/overview')
  },
}

export const systemApi = {
  getHealth: async (): Promise<SystemHealth> => {
    return api.get<SystemHealth>('/admin/system/status')
  },
}

export const catalogApi = {
  list: async (): Promise<CatalogListResponse> => {
    return api.get<CatalogListResponse>('/admin/catalog')
  },
}

export const usersApi = {
  list: async (): Promise<UsersListResponse> => {
    return api.get<UsersListResponse>('/admin/users')
  },
}

export const qrActivityApi = {
  get: async (): Promise<QrActivityResponse> => {
    return api.get<QrActivityResponse>('/admin/qr-activity')
  },
}

export const auditApi = {
  list: async (params?: { page?: number; limit?: number }): Promise<AuditListResponse> => {
    const query = new URLSearchParams()
    query.set('page', String(params?.page ?? 1))
    query.set('limit', String(params?.limit ?? 20))
    return api.get<AuditListResponse>(`/admin/audit?${query.toString()}`)
  },
}

export const revenueApi = {
  getOverview: async (): Promise<RevenueOverview> => {
    return api.get<RevenueOverview>('/admin/revenue/overview')
  },
  listTransactions: async (): Promise<RevenueTransaction[]> => {
    const response = await api.get<{ transactions: RevenueTransaction[] }>('/admin/revenue/transactions')
    return response.transactions
  },
}

export const reportsApi = {
  getOverview: async (): Promise<ReportsOverview> => {
    return api.get<ReportsOverview>('/admin/reports/overview')
  },
}

export const ticketsApi = {
  getStats: async (search?: string): Promise<TicketEventStats[]> => {
    const suffix = search ? `?search=${encodeURIComponent(search)}` : ''
    return api.get<TicketEventStats[]>(`/tickets/stats${suffix}`)
  },

  list: async (eventName?: string): Promise<AdminTicket[]> => {
    const suffix = eventName ? `?eventName=${encodeURIComponent(eventName)}` : ''
    return api.get<AdminTicket[]>(`/tickets${suffix}`)
  },

  getAnalytics: async (): Promise<TicketAnalytics> => {
    return api.get<TicketAnalytics>('/admin/analytics/tickets')
  },
}

export const configsApi = {
  getAll: async (): Promise<AllConfigsResponse> => {
    return api.get<AllConfigsResponse>('/admin/configs')
  },

  getSection: async (section: ConfigSection): Promise<ConfigSectionResponse> => {
    return api.get<ConfigSectionResponse>(`/admin/configs/${section}`)
  },

  updateSection: async (section: ConfigSection, config: ConfigMap): Promise<ConfigSectionResponse> => {
    return api.put<ConfigSectionResponse>(`/admin/configs/${section}`, { config })
  },

  runAction: async (action: ConfigAction): Promise<ConfigActionResult> => {
    return api.post<ConfigActionResult>(`/admin/configs/actions/${action}`)
  },
}

export const notificationsApi = {
  list: async (): Promise<NotificationsResponse> => {
    return api.get<NotificationsResponse>('/admin/notifications')
  },
}

export const adminApi = {
  dashboard: dashboardApi,
  merchants: merchantsApi,
  orders: ordersApi,
  analytics: analyticsApi,
  system: systemApi,
  catalog: catalogApi,
  users: usersApi,
  qrActivity: qrActivityApi,
  audit: auditApi,
  revenue: revenueApi,
  reports: reportsApi,
  tickets: ticketsApi,
  configs: configsApi,
  notifications: notificationsApi,
}

export default adminApi
