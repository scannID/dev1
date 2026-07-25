import { useState, useEffect, useCallback, useRef } from 'react'
import { adminApi } from '../api/services'
import { useAdminMetricsRealtime } from '../lib/useAdminMetricsRealtime'
import type { DashboardMetrics, ActivityEvent, TopMerchant } from '../api/types'

function sameJson(a: unknown, b: unknown) {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([])
  const [topMerchants, setTopMerchants] = useState<TopMerchant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const loadDashboard = useCallback(async (silent = false) => {
    if (inFlight.current && silent) return
    inFlight.current = true
    try {
      if (!silent) setLoading(true)

      const metricsPromise = adminApi.dashboard.getMetrics().then((metricsData) => {
        setMetrics((prev) => (sameJson(prev, metricsData) ? prev : metricsData))
        return metricsData
      })
      const activityPromise = adminApi.dashboard.getRecentActivity().then((activityData) => {
        setRecentActivity((prev) => (sameJson(prev, activityData) ? prev : activityData))
        return activityData
      })
      const topPromise = adminApi.dashboard.getTopMerchants('month', 'orders', 5).then((topData) => {
        setTopMerchants((prev) => (sameJson(prev, topData) ? prev : topData))
        return topData
      })

      const results = await Promise.allSettled([metricsPromise, activityPromise, topPromise])
      const firstError = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
      if (firstError && !silent) {
        const reason = firstError.reason
        setError(reason instanceof Error ? reason.message : 'Failed to load dashboard')
      } else if (!firstError) {
        setError(null)
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err)
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
        setMetrics(null)
        setRecentActivity([])
        setTopMerchants([])
      }
    } finally {
      inFlight.current = false
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard(false)
  }, [loadDashboard])

  // Realtime + its own 60s poll fallback — no second interval (that caused blinky refreshes).
  useAdminMetricsRealtime(() => loadDashboard(true))

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
