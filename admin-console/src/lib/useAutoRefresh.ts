import { useEffect } from 'react'

/** Poll a data loader on an interval (e.g. admin dashboards). */
export function useAutoRefresh(
  refresh: () => void | Promise<void>,
  intervalMs = 15000,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => {
      void refresh()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [refresh, intervalMs, enabled])
}
