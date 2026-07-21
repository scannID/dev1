import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/services'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import type { AdminOrder, OrdersListResponse } from '../api/types'

export function useOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [summary, setSummary] = useState<OrdersListResponse['summary'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadOrders = useCallback(async (params?: { status?: string; paymentStatus?: string; search?: string; silent?: boolean }) => {
    const { silent, ...query } = params ?? {}
    try {
      if (!silent) setLoading(true)
      setError(null)
      const response = await adminApi.orders.list({ limit: 100, ...query })
      setOrders(response.orders)
      setSummary(response.summary)
    } catch (err) {
      console.error('Failed to load orders:', err)
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load orders')
        setOrders([])
        setSummary(null)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOrders({ silent: false })
  }, [loadOrders])

  useAutoRefresh(() => void loadOrders({ silent: true }), 15000)

  return {
    orders,
    summary,
    loading,
    error,
    refresh: (params?: { status?: string; paymentStatus?: string; search?: string }) =>
      loadOrders({ ...params, silent: false }),
  }
}

export default useOrders
