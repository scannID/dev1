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
  CreateCatalogItemRequest,
  UpdateCatalogItemRequest,
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
  QrCodeResponse,
  OnboardingStatusResponse,
  MenuResponse,
  CreateTicketRequest,
  Ticket,
  TicketStats,
  UpdateTicketStatusRequest,
  RegisterDeviceRequest,
  RegisteredDevice,
  PublicCreateQuickPaymentRequest,
  QuickPaymentCode,
  QuickPayTrackingMetrics,
  QuickPayInitiateResponse,
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentStatusResponse,
  TicketPurchaseRequest,
  TicketPurchaseResponse,
  TicketEventInfo,
  AttendeeTicketView,
  GateScanResponse,
  GateEventResponse,
} from './types'

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
}

export const catalogApi = {
  list: async (businessId: string): Promise<CatalogItem[]> => {
    const response = await api.get<CatalogItemsResponse>(`/businesses/${businessId}/catalog`)
    return response.items
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
      available: data.available ?? true,
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
}

export const ordersApi = {
  list: async (businessId: string): Promise<Order[]> => {
    const response = await api.get<OrdersResponse>(`/businesses/${businessId}/orders`)
    return response.orders
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

  initiate: async (data: PaymentInitiateRequest): Promise<PaymentInitiateResponse> => {
    return api.post<PaymentInitiateResponse>('/payments/initiate', data)
  },

  status: async (paymentId: string): Promise<PaymentStatusResponse> => {
    return api.get<PaymentStatusResponse>(`/payments/${encodeURIComponent(paymentId)}/status`)
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

  getGateEvent: async (gateToken: string): Promise<GateEventResponse> => {
    return api.get<GateEventResponse>(`/tickets/public/gate/${encodeURIComponent(gateToken)}`)
  },

  gateScan: async (gateToken: string, qrToken: string): Promise<GateScanResponse> => {
    return api.post<GateScanResponse>(`/tickets/public/gate/${encodeURIComponent(gateToken)}/scan`, { qrToken })
  },
}

export const scannyApi = {
  merchant: merchantAuthApi,
  businesses: businessApi,
  catalog: catalogApi,
  orders: ordersApi,
  tickets: ticketsApi,
  devices: devicesApi,
  quickPayments: quickPaymentsApi,
  payments: paymentsApi,
  publicTickets: publicTicketsApi,
}

export default scannyApi
