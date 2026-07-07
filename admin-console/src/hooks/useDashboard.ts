// Custom hook for dashboard data with API integration

import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/services'
import type { DashboardMetrics, PendingOrder, RecentActivity } from '../api/types'

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Load all dashboard data in parallel
      const [metricsData, pendingData, activityData] = await Promise.all([
        adminApi.dashboard.getMetrics(),
        adminApi.dashboard.getPendingOrders(),
        adminApi.dashboard.getRecentActivity(),
      ])

      setMetrics(metricsData)
      setPendingOrders(pendingData)
      setRecentActivity(activityData)
    } catch (err) {
      console.error('Failed to load dashboard:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  return {
    metrics,
    pendingOrders,
    recentActivity,
    loading,
    error,
    refresh: loadDashboard,
  }
}

export default useDashboard
