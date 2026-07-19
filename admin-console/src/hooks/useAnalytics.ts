import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/services'
import type {
  TicketAnalytics,
  QuickPaymentAnalytics,
  DeviceAnalytics,
  RevenueOverview,
} from '../api/types'

export function useAnalytics() {
  const [ticketAnalytics, setTicketAnalytics] = useState<TicketAnalytics | null>(null)
  const [quickPaymentAnalytics, setQuickPaymentAnalytics] = useState<QuickPaymentAnalytics | null>(null)
  const [deviceAnalytics, setDeviceAnalytics] = useState<DeviceAnalytics | null>(null)
  const [revenueOverview, setRevenueOverview] = useState<RevenueOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [tickets, quickPayments, devices, revenue] = await Promise.all([
        adminApi.analytics.getTicketAnalytics(),
        adminApi.analytics.getQuickPaymentAnalytics(),
        adminApi.analytics.getDeviceAnalytics(),
        adminApi.analytics.getRevenueOverview(),
      ])
      setTicketAnalytics(tickets)
      setQuickPaymentAnalytics(quickPayments)
      setDeviceAnalytics(devices)
      setRevenueOverview(revenue)
    } catch (err) {
      console.error('Failed to load analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [tickets, quickPayments, devices, revenue] = await Promise.all([
          adminApi.analytics.getTicketAnalytics(),
          adminApi.analytics.getQuickPaymentAnalytics(),
          adminApi.analytics.getDeviceAnalytics(),
          adminApi.analytics.getRevenueOverview(),
        ])
        if (cancelled) return
        setTicketAnalytics(tickets)
        setQuickPaymentAnalytics(quickPayments)
        setDeviceAnalytics(devices)
        setRevenueOverview(revenue)
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load analytics:', err)
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    ticketAnalytics,
    quickPaymentAnalytics,
    deviceAnalytics,
    revenueOverview,
    loading,
    error,
    refresh: loadAnalytics,
  }
}

export default useAnalytics
