// Custom hook for orders data with API integration

import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/services'
import type { AdminOrder } from '../api/types'

export function useOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const ordersData = await adminApi.orders.list()
      setOrders(ordersData)
    } catch (err) {
      console.error('Failed to load orders:', err)
      setError(err instanceof Error ? err.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadByStatus = useCallback(async (status: string) => {
    try {
      setLoading(true)
      setError(null)
      const ordersData = await adminApi.orders.getByStatus(status)
      setOrders(ordersData)
    } catch (err) {
      console.error('Failed to load orders by status:', err)
      setError(err instanceof Error ? err.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadByPaymentStatus = useCallback(async (paymentStatus: string) => {
    try {
      setLoading(true)
      setError(null)
      const ordersData = await adminApi.orders.getByPaymentStatus(paymentStatus)
      setOrders(ordersData)
    } catch (err) {
      console.error('Failed to load orders by payment status:', err)
      setError(err instanceof Error ? err.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  return {
    orders,
    loading,
    error,
    refresh: loadOrders,
    loadByStatus,
    loadByPaymentStatus,
  }
}

export default useOrders
