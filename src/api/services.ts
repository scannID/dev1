// API Service Functions — paths/payloads aligned with Spring controllers

import { api } from './client'
import type {
  Business,
  BusinessesResponse,
  BusinessResponse,
  CreateBusinessRequest,
  CatalogItem,
  CatalogItemResponse,
  CatalogItemsResponse,
  CategoriesResponse,
  CreateCatalogItemRequest,
  UpdateCatalogItemRequest,
  ImageSearchResponse,
  Order,
  OrderResponse,
  OrdersResponse,
  CustomerOrderTracking,
  CustomerOrderTrackingResponse,
  CreateOrderRequest,
  UpdateOrderStatusRequest,
  UpdatePaymentStatusRequest,
  ClearCompletedResponse,
  MerchantMeResponse,
  MerchantProfile,
  QrCodeResponse,
  OnboardingStatusResponse,
  MenuResponse,
  MerchantMetricRange,
  ScansOrdersSeries,
  CreateTicketRequest,
  Ticket,
  TicketStats,
  UpdateTicketStatusRequest,
  TicketScanValidationResponse,
  RegisterDeviceRequest,
  RegisteredDevice,
  PublicCreateQuickPaymentRequest,
  QuickPaymentCode,
  QuickPayTrackingMetrics,
  QuickPayInitiateResponse,
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentStatusResponse,
  PaymentProvidersResponse,
  TicketPurchaseRequest,
  TicketPurchaseResponse,
  TicketEventInfo,
  AttendeeTicketView,
  EventTicketTrackingMetrics,
  PagedResult,
  PaginationMeta,
  FeeConfig,
} from './types'

export type CatalogListParams = {
  page?: number
  size?: number
  search?: string
  category?: string
  available?: boolean
  lodging?: boolean
}

export type OrdersListParams = {
  page?: number
  size?: number
  search?: string
  status?: string
  paymentStatus?: string
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, String(value))
  }
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export interface UpdateMerchantProfileRequest {
  businessName?: string
  businessDescription?: string
  businessAddress?: string
  phoneNumber?: string
  businessLogoUrl?: string | null
}

export const merchantAuthApi = {
  me: async (): Promise<MerchantMeResponse> => {
    return api.get<MerchantMeResponse>('/auth/merchant/me')
  },

  updateProfile: async (data: UpdateMerchantProfileRequest): Promise<MerchantProfile> => {
    return api.patch<MerchantProfile>('/auth/merchant/profile', data)
  },

  onboarding: async (merchantId: string): Promise<OnboardingStatusResponse> => {
    return api.get<OnboardingStatusResponse>(`/auth/merchant/onboarding?merchantId=${merchantId}`)
  },

  completeOnboarding: async (merchantId: string): Promise<void> => {
    await api.post(`/auth/merchant/onboarding/complete?merchantId=${merchantId}`)
  },

  getQrCode: async (merchantId: string): Promise<QrCodeResponse> => {
    return api.get<QrCodeResponse>(`/auth/merchant/qr-code?merchantId=${merchantId}`)
  },

  generateQrCode: async (merchantId: string, reason = 'MANUAL'): Promise<QrCodeResponse> => {
    return api.post<QrCodeResponse>(
      `/auth/merchant/qr-code/generate?merchantId=${merchantId}&reason=${reason}`
    )
  },

  markPrinted: async (merchantId: string): Promise<void> => {
    await api.post(`/auth/merchant/qr-code/mark-printed?merchantId=${merchantId}`)
  },
}

export const businessApi = {
  list: async (): Promise<Business[]> => {
    const response = await api.get<BusinessesResponse>('/businesses')
    return response.businesses
  },

  get: async (businessId: string): Promise<Business> => {
    const response = await api.get<BusinessResponse>(`/businesses/${businessId}`)
    return response.business
  },

  create: async (data: CreateBusinessRequest): Promise<Business> => {
    const response = await api.post<BusinessResponse>('/businesses', data)
    return response.business
  },

  getByQr: async (qrToken: string): Promise<Business> => {
    const response = await api.get<BusinessResponse>(`/qr/${qrToken}`)
    return response.business
  },

  getMenu: async (businessId: string, qr?: string): Promise<MenuResponse> => {
    const url = `/businesses/${businessId}/menu${qr ? `?qr=${encodeURIComponent(qr)}` : ''}`
    return api.get<MenuResponse>(url)
  },

  /** Record a QR open once (separate from menu GET so remounts don't inflate counts). */
  recordScan: async (businessId: string, qr?: string): Promise<void> => {
    const url = `/businesses/${businessId}/scans${qr ? `?qr=${encodeURIComponent(qr)}` : ''}`
    await api.post(url, {})
  },

  getScansOrders: async (
    businessId: string,
    range: MerchantMetricRange = 'week',
  ): Promise<ScansOrdersSeries> => {
    return api.get(`/businesses/${businessId}/analytics/scans-orders?range=${range}`)
  },
}

export const catalogApi = {
  /** Full catalog (no page params) — used when embedding items on the business. */
  list: async (businessId: string): Promise<CatalogItem[]> => {
    const response = await api.get<CatalogItemsResponse>(`/businesses/${businessId}/catalog`)
    return response.items
  },

  /** Server-paginated catalog list with optional filters. */
  listPaged: async (businessId: string, params: CatalogListParams = {}): Promise<PagedResult<CatalogItem>> => {
    const qs = buildQuery({
      page: params.page ?? 1,
      size: params.size ?? 20,
      search: params.search,
      category: params.category,
      available: params.available,
      lodging: params.lodging,
    })
    const response = await api.get<CatalogItemsResponse>(`/businesses/${businessId}/catalog${qs}`)
    const pagination: PaginationMeta = response.pagination ?? {
      page: params.page ?? 1,
      size: params.size ?? response.items.length,
      totalItems: response.items.length,
      totalPages: 1,
    }
    return { items: response.items, pagination }
  },

  get: async (businessId: string, itemId: string): Promise<CatalogItem> => {
    const response = await api.get<CatalogItemResponse>(`/businesses/${businessId}/catalog/${itemId}`)
    return response.item
  },

  create: async (businessId: string, data: CreateCatalogItemRequest): Promise<CatalogItem> => {
    const response = await api.post<CatalogItemResponse>(`/businesses/${businessId}/catalog`, {
      name: data.name,
      category: data.category,
      price: data.price,
      description: data.description,
      imageUrl: data.imageUrl ?? null,
      imageUrls: data.imageUrls ?? [],
      details: data.details ?? '',
      ingredients: data.ingredients ?? [],
      available: data.available ?? true,
      discountPercent: data.discountPercent ?? 0,
      itemKind: data.itemKind ?? 'FOOD',
      capacity: data.capacity,
      amenities: data.amenities ?? [],
      unitsAvailable: data.unitsAvailable,
    })
    return response.item
  },

  update: async (businessId: string, itemId: string, data: UpdateCatalogItemRequest): Promise<CatalogItem> => {
    const response = await api.patch<CatalogItemResponse>(
      `/businesses/${businessId}/catalog/${itemId}`,
      data
    )
    return response.item
  },

  updateAvailability: async (businessId: string, itemId: string, available: boolean): Promise<CatalogItem> => {
    const response = await api.patch<CatalogItemResponse>(
      `/businesses/${businessId}/catalog/${itemId}/availability`,
      { available }
    )
    return response.item
  },

  delete: async (businessId: string, itemId: string): Promise<void> => {
    await api.delete(`/businesses/${businessId}/catalog/${itemId}`)
  },

  listCategories: async (businessId: string): Promise<string[]> => {
    const response = await api.get<CategoriesResponse>(`/businesses/${businessId}/catalog/categories`)
    return response.categories
  },

  addCategory: async (businessId: string, name: string): Promise<string[]> => {
    const response = await api.post<CategoriesResponse>(`/businesses/${businessId}/catalog/categories`, { name })
    return response.categories
  },
}

export const ordersApi = {
  /** Full order list (no page params) — reports, metrics, realtime refresh. */
  list: async (businessId: string): Promise<Order[]> => {
    const response = await api.get<OrdersResponse>(`/businesses/${businessId}/orders`)
    return response.orders
  },

  /** Server-paginated orders list with optional filters. */
  listPaged: async (businessId: string, params: OrdersListParams = {}): Promise<PagedResult<Order>> => {
    const qs = buildQuery({
      page: params.page ?? 1,
      size: params.size ?? 20,
      search: params.search,
      status: params.status,
      paymentStatus: params.paymentStatus,
    })
    const response = await api.get<OrdersResponse>(`/businesses/${businessId}/orders${qs}`)
    const pagination: PaginationMeta = response.pagination ?? {
      page: params.page ?? 1,
      size: params.size ?? response.orders.length,
      totalItems: response.orders.length,
      totalPages: 1,
    }
    return { items: response.orders, pagination }
  },

  create: async (businessId: string, data: CreateOrderRequest): Promise<Order> => {
    const response = await api.post<OrderResponse>(`/businesses/${businessId}/orders`, data)
    return response.order
  },

  updateStatus: async (orderId: string, status: UpdateOrderStatusRequest['status']): Promise<Order> => {
    const response = await api.patch<OrderResponse>(`/orders/${orderId}/status`, { status })
    return response.order
  },

  updatePayment: async (
    orderId: string,
    paymentStatus: UpdatePaymentStatusRequest['paymentStatus']
  ): Promise<Order> => {
    const response = await api.patch<OrderResponse>(`/orders/${orderId}/payment`, { paymentStatus })
    return response.order
  },

  clearCompleted: async (businessId: string): Promise<{ deleted: number; message: string }> => {
    return api.delete<ClearCompletedResponse>(`/businesses/${businessId}/orders/completed`)
  },

  trackPublic: async (publicId: string, phone: string): Promise<CustomerOrderTracking> => {
    const params = new URLSearchParams({ phone: phone.trim() })
    const response = await api.get<CustomerOrderTrackingResponse>(
      `/orders/public/${encodeURIComponent(publicId)}?${params}`
    )
    return response.order
  },
}

export const ticketsApi = {
  create: async (data: CreateTicketRequest): Promise<Ticket> => {
    return api.post<Ticket>('/tickets', data)
  },

  list: async (eventName?: string): Promise<Ticket[]> => {
    const suffix = eventName ? `?eventName=${encodeURIComponent(eventName)}` : ''
    return api.get<Ticket[]>(`/tickets${suffix}`)
  },

  getStats: async (search?: string): Promise<TicketStats[]> => {
    const suffix = search ? `?search=${encodeURIComponent(search)}` : ''
    return api.get<TicketStats[]>(`/tickets/stats${suffix}`)
  },

  updateStatus: async (ticketId: string, status: UpdateTicketStatusRequest['status']): Promise<Ticket> => {
    return api.patch<Ticket>(`/tickets/${ticketId}/status`, { status })
  },

  scanPayload: async (data: {
    payload: string
    scannedBy?: string
    scanLocation?: string
    deviceInfo?: string
  }): Promise<TicketScanValidationResponse> => {
    return api.post<TicketScanValidationResponse>('/tickets/scan', data)
  },
}

export const devicesApi = {
  check: async (deviceId: string): Promise<boolean> => {
    return api.get<boolean>(`/devices/${encodeURIComponent(deviceId)}/check`)
  },

  get: async (deviceId: string): Promise<RegisteredDevice> => {
    return api.get<RegisteredDevice>(`/devices/${encodeURIComponent(deviceId)}`)
  },

  register: async (data: RegisterDeviceRequest): Promise<RegisteredDevice> => {
    return api.post<RegisteredDevice>('/devices/register', data)
  },
}

export const quickPaymentsApi = {
  createPublic: async (data: PublicCreateQuickPaymentRequest): Promise<QuickPaymentCode> => {
    return api.post<QuickPaymentCode>('/quick-payments/public/codes', data)
  },

  track: async (trackingNumber: string): Promise<QuickPayTrackingMetrics> => {
    return api.get<QuickPayTrackingMetrics>(
      `/quick-payments/public/track/${encodeURIComponent(trackingNumber.trim())}`
    )
  },

  getByQr: async (qrToken: string): Promise<QuickPaymentCode> => {
    return api.get<QuickPaymentCode>(`/quick-payments/codes/qr/${encodeURIComponent(qrToken)}`)
  },

  pay: async (
    qrToken: string,
    data: { customerPhone: string; customerName?: string; paymentMethod?: string }
  ): Promise<QuickPayInitiateResponse> => {
    return api.post<QuickPayInitiateResponse>(
      `/quick-payments/codes/qr/${encodeURIComponent(qrToken)}/pay`,
      data
    )
  },
}

export const paymentsApi = {
  providers: async (): Promise<PaymentProvidersResponse> => {
    return api.get<PaymentProvidersResponse>('/payments/providers')
  },

  initiate: async (
    data: PaymentInitiateRequest,
    options?: { idempotencyKey?: string },
  ): Promise<PaymentInitiateResponse> => {
    const headers: Record<string, string> = {}
    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey
    }
    return api.post<PaymentInitiateResponse>('/payments/initiate', data, { headers })
  },

  status: async (paymentId: string): Promise<PaymentStatusResponse> => {
    return api.get<PaymentStatusResponse>(`/payments/${encodeURIComponent(paymentId)}/status`)
  },
}

export const feesApi = {
  get: async (): Promise<FeeConfig> => {
    return api.get<FeeConfig>('/fees')
  },
}

export const publicTicketsApi = {
  getEvent: async (masterQrToken: string): Promise<TicketEventInfo> => {
    return api.get<TicketEventInfo>(`/tickets/public/event/${encodeURIComponent(masterQrToken)}`)
  },

  purchase: async (data: TicketPurchaseRequest): Promise<TicketPurchaseResponse> => {
    return api.post<TicketPurchaseResponse>('/tickets/public/purchase', data)
  },

  view: async (accessToken: string): Promise<AttendeeTicketView> => {
    return api.get<AttendeeTicketView>(`/tickets/public/view/${encodeURIComponent(accessToken)}`)
  },

  createEvent: async (data: CreateTicketRequest): Promise<Ticket> => {
    return api.post<Ticket>('/tickets/public/events', data)
  },

  track: async (ticketId: string): Promise<EventTicketTrackingMetrics> => {
    const id = ticketId.trim().replace(/^#/, '')
    return api.get<EventTicketTrackingMetrics>(
      `/tickets/public/track/${encodeURIComponent(id)}`
    )
  },

  validate: async (data: {
    payload: string
    eventId?: string
    scannedBy?: string
    scanLocation?: string
    deviceInfo?: string
  }): Promise<TicketScanValidationResponse> => {
    return api.post<TicketScanValidationResponse>('/tickets/public/validate', data)
  },
}

export const imagesApi = {
  search: async (query: string, perPage = 20): Promise<ImageSearchResponse> => {
    const params = new URLSearchParams({
      q: query,
      perPage: String(perPage),
    })
    return api.get<ImageSearchResponse>(`/images/search?${params.toString()}`)
  },

  importFromUrl: async (url: string): Promise<string> => {
    const response = await api.post<{ imageUrl: string }>('/images/import', { url })
    return response.imageUrl
  },
}

async function fetchUsdToUgxFrom(url: string): Promise<number | null> {
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) return null
  const data = await res.json() as { rates?: Record<string, number> }
  const ugx = data?.rates?.UGX
  return typeof ugx === 'number' && Number.isFinite(ugx) && ugx > 0 ? ugx : null
}

export const fxApi = {
  /** Live UGX-per-USD quote for customer price hints. */
  ugxPerUsd: async (): Promise<number> => {
    const primary = await fetchUsdToUgxFrom('https://open.er-api.com/v6/latest/USD')
    if (primary) return primary
    const backup = await fetchUsdToUgxFrom('https://api.exchangerate.host/latest?base=USD&symbols=UGX')
    if (backup) return backup
    throw new Error('Unable to fetch live FX rate')
  },
}

export const scannyApi = {
  merchant: merchantAuthApi,
  businesses: businessApi,
  catalog: catalogApi,
  images: imagesApi,
  orders: ordersApi,
  tickets: ticketsApi,
  devices: devicesApi,
  quickPayments: quickPaymentsApi,
  payments: paymentsApi,
  fees: feesApi,
  fx: fxApi,
  publicTickets: publicTicketsApi,
}

export default scannyApi
