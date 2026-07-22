// Custom hook for order operations with API integration

import { useState, useCallback } from 'react'
import { scannyApi } from '../api/services'
import { ApiError } from '../api/client'
import type { Order, CreateOrderRequest, OrderStatus, PaymentStatus } from '../api/types'

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

export function useOrders(businessId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createOrder = useCallback(async (data: CreateOrderRequest): Promise<Order> => {
    try {
      setLoading(true)
      setError(null)
      return await scannyApi.orders.create(businessId, data)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to create order')
      console.error('Failed to create order:', err)
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  const updateStatus = useCallback(async (orderId: string, status: OrderStatus): Promise<Order> => {
    try {
      setLoading(true)
      setError(null)
      return await scannyApi.orders.updateStatus(orderId, status)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to update order status')
      console.error('Failed to update order status:', err)
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const updatePayment = useCallback(async (orderId: string, paymentStatus: PaymentStatus): Promise<Order> => {
    try {
      setLoading(true)
      setError(null)
      return await scannyApi.orders.updatePayment(orderId, paymentStatus)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to update payment status')
      console.error('Failed to update payment status:', err)
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const clearCompleted = useCallback(async (): Promise<{ deleted: number; message: string }> => {
    try {
      setLoading(true)
      setError(null)
      return await scannyApi.orders.clearCompleted(businessId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to clear completed orders')
      console.error('Failed to clear completed orders:', err)
      setError(message)
      throw new Error(message)
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
