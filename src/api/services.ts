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
} from './types'

export const merchantAuthApi = {
  me: async (): Promise<MerchantMeResponse> => {
    return api.get<MerchantMeResponse>('/auth/merchant/me')
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

export const scanitApi = {
  merchant: merchantAuthApi,
  businesses: businessApi,
  catalog: catalogApi,
  orders: ordersApi,
  tickets: ticketsApi,
}

export default scanitApi
