import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/services'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { useAdminMetricsRealtime } from '../lib/useAdminMetricsRealtime'
import type { DashboardMetrics, ActivityEvent, TopMerchant } from '../api/types'

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([])
  const [topMerchants, setTopMerchants] = useState<TopMerchant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setError(null)
      const [metricsData, activityData, topData] = await Promise.all([
        adminApi.dashboard.getMetrics(),
        adminApi.dashboard.getRecentActivity(),
        adminApi.dashboard.getTopMerchants('month', 'orders', 5),
      ])
      setMetrics(metricsData)
      setRecentActivity(activityData)
      setTopMerchants(topData)
    } catch (err) {
      console.error('Failed to load dashboard:', err)
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
        setMetrics(null)
        setRecentActivity([])
        setTopMerchants([])
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard(false)
  }, [loadDashboard])

  // Realtime primary; slow poll as backup if the socket drops.
  useAdminMetricsRealtime(() => loadDashboard(true))
  useAutoRefresh(() => void loadDashboard(true), 60000)

  return {
    metrics,
    recentActivity,
    topMerchants,
    loading,
    error,
    refresh: () => loadDashboard(false),
  }
}

export default useDashboard
