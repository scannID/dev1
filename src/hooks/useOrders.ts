// Custom hook for order operations with API integration

import { useState, useCallback } from 'react'
import { scannyApi } from '../api/services'
import type { Order, CreateOrderRequest, OrderStatus, PaymentStatus } from '../api/types'

export function useOrders(businessId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createOrder = useCallback(async (data: CreateOrderRequest): Promise<Order | null> => {
    try {
      setLoading(true)
      setError(null)
      const order = await scannyApi.orders.create(businessId, data)
      return order
    } catch (err) {
      console.error('Failed to create order:', err)
      setError(err instanceof Error ? err.message : 'Failed to create order')
      return null
    } finally {
      setLoading(false)
    }
  }, [businessId])

  const updateStatus = useCallback(async (orderId: string, status: OrderStatus): Promise<Order | null> => {
    try {
      setLoading(true)
      setError(null)
      const order = await scannyApi.orders.updateStatus(orderId, status)
      return order
    } catch (err) {
      console.error('Failed to update order status:', err)
      setError(err instanceof Error ? err.message : 'Failed to update order status')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const updatePayment = useCallback(async (orderId: string, paymentStatus: PaymentStatus): Promise<Order | null> => {
    try {
      setLoading(true)
      setError(null)
      const order = await scannyApi.orders.updatePayment(orderId, paymentStatus)
      return order
    } catch (err) {
      console.error('Failed to update payment status:', err)
      setError(err instanceof Error ? err.message : 'Failed to update payment status')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const clearCompleted = useCallback(async (): Promise<{ deleted: number; message: string } | null> => {
    try {
      setLoading(true)
      setError(null)
      const result = await scannyApi.orders.clearCompleted(businessId)
      return result
    } catch (err) {
      console.error('Failed to clear completed orders:', err)
      setError(err instanceof Error ? err.message : 'Failed to clear completed orders')
      return null
    } finally {
      setLoading(false)
    }
  }, [businessId])

  return {
    loading,
    error,
    createOrder,
    updateStatus,
    updatePayment,
    clearCompleted,
  }
}

export default useOrders
