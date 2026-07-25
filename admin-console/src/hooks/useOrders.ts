import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/services'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import type { AdminOrder, OrdersListResponse } from '../api/types'

type LoadParams = {
  page?: number
  limit?: number
  status?: string
  paymentStatus?: string
  search?: string
  silent?: boolean
}

export function useOrders(params: { page: number; limit: number; search?: string }) {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [summary, setSummary] = useState<OrdersListResponse['summary'] | null>(null)
  const [pagination, setPagination] = useState<OrdersListResponse['pagination'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadOrders = useCallback(async (opts?: LoadParams) => {
    const { silent, ...query } = opts ?? {}
    try {
      if (!silent) setLoading(true)
      setError(null)
      const response = await adminApi.orders.list({
        page: query.page ?? params.page,
        limit: query.limit ?? params.limit,
        search: (query.search ?? params.search)?.trim() || undefined,
        status: query.status,
        paymentStatus: query.paymentStatus,
      })
      setOrders(response.orders)
      setSummary(response.summary)
      setPagination(response.pagination)
    } catch (err) {
      console.error('Failed to load orders:', err)
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load orders')
        setOrders([])
        setSummary(null)
        setPagination(null)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [params.page, params.limit, params.search])

  useEffect(() => {
    void loadOrders({ silent: false })
  }, [loadOrders])

  useAutoRefresh(() => void loadOrders({ silent: true }), 15000)

  return {
    orders,
    summary,
    pagination,
    loading,
    error,
    refresh: (query?: { status?: string; paymentStatus?: string; search?: string }) =>
      loadOrders({ ...query, silent: false }),
  }
}

export default useOrders
