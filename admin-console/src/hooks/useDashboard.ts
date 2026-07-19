import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/services'
import type { DashboardMetrics, ActivityEvent, TopMerchant } from '../api/types'

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([])
  const [topMerchants, setTopMerchants] = useState<TopMerchant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
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
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      setMetrics(null)
      setRecentActivity([])
      setTopMerchants([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [metricsData, activityData, topData] = await Promise.all([
          adminApi.dashboard.getMetrics(),
          adminApi.dashboard.getRecentActivity(),
          adminApi.dashboard.getTopMerchants('month', 'orders', 5),
        ])
        if (cancelled) return
        setMetrics(metricsData)
        setRecentActivity(activityData)
        setTopMerchants(topData)
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load dashboard:', err)
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
        setMetrics(null)
        setRecentActivity([])
        setTopMerchants([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    metrics,
    recentActivity,
    topMerchants,
    loading,
    error,
    refresh: loadDashboard,
  }
}

export default useDashboard
