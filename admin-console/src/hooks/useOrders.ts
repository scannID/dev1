import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/services'
import type { AdminOrder, OrdersListResponse } from '../api/types'

export function useOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [summary, setSummary] = useState<OrdersListResponse['summary'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadOrders = useCallback(async (params?: { status?: string; paymentStatus?: string; search?: string }) => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminApi.orders.list({ limit: 100, ...params })
      setOrders(response.orders)
      setSummary(response.summary)
    } catch (err) {
      console.error('Failed to load orders:', err)
      setError(err instanceof Error ? err.message : 'Failed to load orders')
      setOrders([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await adminApi.orders.list({ limit: 100 })
        if (cancelled) return
        setOrders(response.orders)
        setSummary(response.summary)
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load orders:', err)
        setError(err instanceof Error ? err.message : 'Failed to load orders')
        setOrders([])
        setSummary(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    orders,
    summary,
    loading,
    error,
    refresh: loadOrders,
  }
}

export default useOrders
