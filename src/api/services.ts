// API Service Functions
// All backend API calls organized by domain

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
  UpdateAvailabilityRequest,
  Order,
  OrderResponse,
  OrdersResponse,
  CreateOrderRequest,
  UpdateOrderStatusRequest,
  UpdatePaymentStatusRequest,
  ClearCompletedResponse,
} from './types'

// ============================================================================
// BUSINESS API
// ============================================================================

export const businessApi = {
  // List all businesses
  list: async (): Promise<Business[]> => {
    const response = await api.get<BusinessesResponse>('/businesses')
    return response.businesses
  },

  // Get single business
  get: async (businessId: string): Promise<Business> => {
    const response = await api.get<BusinessResponse>(`/businesses/${businessId}`)
    return response.business
  },

  // Create new business
  create: async (data: CreateBusinessRequest): Promise<Business> => {
    const response = await api.post<BusinessResponse>('/businesses', data)
    return response.business
  },

  // Get business by QR token
  getByQr: async (qrToken: string): Promise<Business> => {
    const response = await api.get<BusinessResponse>(`/qr/${qrToken}`)
    return response.business
  },

  // Get business menu (for customer view)
  getMenu: async (businessId: string, qr?: string): Promise<{ business: Business; items: CatalogItem[] }> => {
    const url = `/businesses/${businessId}/menu${qr ? `?qr=${qr}` : ''}`
    return api.get(url)
  },
}

// ============================================================================
// CATALOG API
// ============================================================================

export const catalogApi = {
  // List all catalog items for a business
  list: async (businessId: string): Promise<CatalogItem[]> => {
    const response = await api.get<CatalogItemsResponse>(`/businesses/${businessId}/catalog`)
    return response.items
  },

  // Get single catalog item
  get: async (businessId: string, itemId: string): Promise<CatalogItem> => {
    const response = await api.get<CatalogItemResponse>(`/businesses/${businessId}/catalog/${itemId}`)
    return response.item
  },

  // Create new catalog item
  create: async (businessId: string, data: CreateCatalogItemRequest): Promise<CatalogItem> => {
    const response = await api.post<CatalogItemResponse>(`/businesses/${businessId}/catalog`, data)
    return response.item
  },

  // Update catalog item
  update: async (businessId: string, itemId: string, data: UpdateCatalogItemRequest): Promise<CatalogItem> => {
    const response = await api.patch<CatalogItemResponse>(`/businesses/${businessId}/catalog/${itemId}`, data)
    return response.item
  },

  // Toggle item availability
  updateAvailability: async (businessId: string, itemId: string, available: boolean): Promise<CatalogItem> => {
    const response = await api.patch<CatalogItemResponse>(
      `/businesses/${businessId}/catalog/${itemId}/availability`,
      { available }
    )
    return response.item
  },

  // Delete catalog item
  delete: async (businessId: string, itemId: string): Promise<void> => {
    await api.delete(`/businesses/${businessId}/catalog/${itemId}`)
  },
}

// ============================================================================
// ORDERS API
// ============================================================================

export const ordersApi = {
  // List orders for a business
  list: async (businessId: string): Promise<Order[]> => {
    const response = await api.get<OrdersResponse>(`/businesses/${businessId}/orders`)
    return response.orders
  },

  // Create new order
  create: async (businessId: string, data: CreateOrderRequest): Promise<Order> => {
    const response = await api.post<OrderResponse>(`/businesses/${businessId}/orders`, data)
    return response.order
  },

  // Update order status
  updateStatus: async (orderId: string, status: UpdateOrderStatusRequest['status']): Promise<Order> => {
    const response = await api.patch<OrderResponse>(`/orders/${orderId}/status`, { status })
    return response.order
  },

  // Update payment status
  updatePayment: async (orderId: string, paymentStatus: UpdatePaymentStatusRequest['paymentStatus']): Promise<Order> => {
    const response = await api.patch<OrderResponse>(`/orders/${orderId}/payment`, { paymentStatus })
    return response.order
  },

  // Clear completed orders
  clearCompleted: async (businessId: string): Promise<{ deleted: number; message: string }> => {
    return api.delete<ClearCompletedResponse>(`/businesses/${businessId}/orders/completed`)
  },
}

// ============================================================================
// Combined API Export
// ============================================================================

export const scanitApi = {
  businesses: businessApi,
  catalog: catalogApi,
  orders: ordersApi,
}

export default scanitApi
