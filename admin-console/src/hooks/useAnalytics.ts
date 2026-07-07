// Custom hook for analytics data with API integration

import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/services'
import type { TicketAnalytics, QuickPaymentAnalytics, DeviceAnalytics, RevenueBreakdown } from '../api/types'

export function useAnalytics() {
  const [ticketAnalytics, setTicketAnalytics] = useState<TicketAnalytics | null>(null)
  const [quickPaymentAnalytics, setQuickPaymentAnalytics] = useState<QuickPaymentAnalytics | null>(null)
  const [deviceAnalytics, setDeviceAnalytics] = useState<DeviceAnalytics | null>(null)
  const [revenueBreakdown, setRevenueBreakdown] = useState<RevenueBreakdown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Load all analytics in parallel
      const [tickets, quickPayments, devices, revenue] = await Promise.all([
        adminApi.analytics.getTicketAnalytics(),
        adminApi.analytics.getQuickPaymentAnalytics(),
        adminApi.analytics.getDeviceAnalytics(),
        adminApi.analytics.getRevenueBreakdown(),
      ])

      setTicketAnalytics(tickets)
      setQuickPaymentAnalytics(quickPayments)
      setDeviceAnalytics(devices)
      setRevenueBreakdown(revenue)
    } catch (err) {
      console.error('Failed to load analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  return {
    ticketAnalytics,
    quickPaymentAnalytics,
    deviceAnalytics,
    revenueBreakdown,
    loading,
    error,
    refresh: loadAnalytics,
  }
}

export default useAnalytics
