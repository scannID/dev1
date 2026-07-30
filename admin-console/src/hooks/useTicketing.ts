import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../api/services'
import type { AdminTicket, CreatedEventSummary, TicketAnalytics } from '../api/types'

export function useTicketing() {
  const [createdEvents, setCreatedEvents] = useState<CreatedEventSummary[]>([])
  const [analytics, setAnalytics] = useState<TicketAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (search?: string) => {
    setLoading(true)
    setError(null)
    try {
      const [events, analyticsData] = await Promise.all([
        adminApi.tickets.listCreatedEvents(search),
        adminApi.tickets.getAnalytics(),
      ])
      setCreatedEvents(events)
      setAnalytics(analyticsData)
    } catch (err) {
      setCreatedEvents([])
      setAnalytics(null)
      setError(err instanceof Error ? err.message : 'Failed to load ticketing data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { createdEvents, analytics, loading, error, refresh }
}

export async function loadEventTickets(eventName: string): Promise<AdminTicket[]> {
  return adminApi.tickets.list(eventName)
}

export default useTicketing
