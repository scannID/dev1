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
  CreatedEventSummary,
  AdminTicket,
  UpdateCreatedEventRequest,
  AllConfigsResponse,
  ConfigSection,
  ConfigSectionResponse,
  ConfigMap,
  ConfigAction,
  ConfigActionResult,
  ScansOrdersRange,
  ScansOrdersSeries,
  TrafficAnalytics,
  TrafficRange,
  CookieConsentAnalytics,
  NotificationsResponse,
  AdminBroadcast,
  AdminBroadcastListResponse,
  PublishBroadcastRequest,
  MerchantActivityResponse,
  MerchantOrdersResponse,
  MerchantPaymentsResponse,
  MerchantScansResponse,
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

  activity: async (merchantId: string, page = 1, limit = 50): Promise<MerchantActivityResponse> => {
    return api.get<MerchantActivityResponse>(
      `/admin/merchants/${merchantId}/activity?page=${page}&limit=${limit}`
    )
  },

  orders: async (merchantId: string, page = 1, limit = 20): Promise<MerchantOrdersResponse> => {
    return api.get<MerchantOrdersResponse>(
      `/admin/merchants/${merchantId}/orders?page=${page}&limit=${limit}`
    )
  },

  payments: async (merchantId: string, page = 1, limit = 20): Promise<MerchantPaymentsResponse> => {
    return api.get<MerchantPaymentsResponse>(
      `/admin/merchants/${merchantId}/payments?page=${page}&limit=${limit}`
    )
  },

  scans: async (merchantId: string, page = 1, limit = 20): Promise<MerchantScansResponse> => {
    return api.get<MerchantScansResponse>(
      `/admin/merchants/${merchantId}/scans?page=${page}&limit=${limit}`
    )
  },

  update: async (merchantId: string, data: { name?: string; plan?: string; status?: string }) => {
    return api.patch(`/admin/merchants/${merchantId}`, data)
  },

  updateStatus: async (merchantId: string, data: { status: string; reason?: string }) => {
    return api.patch(`/admin/merchants/${merchantId}/status`, data)
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

  getTrafficAnalytics: async (range: TrafficRange = 'daily'): Promise<TrafficAnalytics> => {
    return api.get<TrafficAnalytics>(`/admin/analytics/traffic?range=${range}`)
  },

  getCookieConsents: async (range: ScansOrdersRange = 'daily'): Promise<CookieConsentAnalytics> => {
    return api.get<CookieConsentAnalytics>(`/admin/analytics/cookie-consents?range=${range}`)
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

  listCreatedEvents: async (search?: string): Promise<CreatedEventSummary[]> => {
    const suffix = search ? `?search=${encodeURIComponent(search)}` : ''
    return api.get<CreatedEventSummary[]>(`/tickets/events${suffix}`)
  },

  list: async (eventName?: string): Promise<AdminTicket[]> => {
    const suffix = eventName ? `?eventName=${encodeURIComponent(eventName)}` : ''
    return api.get<AdminTicket[]>(`/tickets${suffix}`)
  },

  getAnalytics: async (): Promise<TicketAnalytics> => {
    return api.get<TicketAnalytics>('/admin/analytics/tickets')
  },

  updateCreatedEvent: async (eventId: string, data: UpdateCreatedEventRequest): Promise<AdminTicket> => {
    return api.patch<AdminTicket>(`/tickets/events/${encodeURIComponent(eventId)}`, data)
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

  getSystemBusy: async (): Promise<ConfigActionResult> => {
    return api.get<ConfigActionResult>('/admin/configs/system-busy')
  },

  setSystemBusy: async (busyMode: boolean, pauseMessage?: string): Promise<ConfigActionResult> => {
    return api.post<ConfigActionResult>('/admin/configs/system-busy', { busyMode, pauseMessage })
  },
}

export const notificationsApi = {
  list: async (): Promise<NotificationsResponse> => {
    return api.get<NotificationsResponse>('/admin/notifications')
  },
}

export const broadcastsApi = {
  list: async (): Promise<AdminBroadcastListResponse> => {
    return api.get<AdminBroadcastListResponse>('/admin/broadcasts')
  },

  publish: async (payload: PublishBroadcastRequest): Promise<AdminBroadcast> => {
    return api.post<AdminBroadcast>('/admin/broadcasts', payload)
  },

  revoke: async (id: string): Promise<AdminBroadcast> => {
    return api.post<AdminBroadcast>(`/admin/broadcasts/${id}/revoke`)
  },
}

export const adminUsersApi = {
  me: async (): Promise<import('./types').AdminMeResponse> => {
    return api.get('/admin/admins/me')
  },

  list: async (): Promise<import('./types').AdminUserListResponse> => {
    return api.get('/admin/admins')
  },

  invite: async (payload: { email: string; displayName: string; permissions: string[] }) => {
    return api.post('/admin/admins', payload)
  },

  updatePermissions: async (adminId: string, permissions: string[]) => {
    return api.put(`/admin/admins/${adminId}/permissions`, { permissions })
  },

  revoke: async (adminId: string) => {
    return api.post(`/admin/admins/${adminId}/revoke`)
  },

  restore: async (adminId: string) => {
    return api.post(`/admin/admins/${adminId}/restore`)
  },

  resendInvite: async (adminId: string) => {
    return api.post(`/admin/admins/${adminId}/resend-invite`)
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
  broadcasts: broadcastsApi,
  adminUsers: adminUsersApi,
}

export default adminApi
