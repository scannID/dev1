import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../api/services'
import type { AdminTicket, TicketAnalytics, TicketEventStats } from '../api/types'

export function useTicketing() {
  const [events, setEvents] = useState<TicketEventStats[]>([])
  const [analytics, setAnalytics] = useState<TicketAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (search?: string) => {
    setLoading(true)
    setError(null)
    try {
      const [stats, analyticsData] = await Promise.all([
        adminApi.tickets.getStats(search),
        adminApi.tickets.getAnalytics(),
      ])
      setEvents(stats)
      setAnalytics(analyticsData)
    } catch (err) {
      setEvents([])
      setAnalytics(null)
      setError(err instanceof Error ? err.message : 'Failed to load ticketing data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { events, analytics, loading, error, refresh }
}

export async function loadEventTickets(eventName: string): Promise<AdminTicket[]> {
  return adminApi.tickets.list(eventName)
}

export default useTicketing
