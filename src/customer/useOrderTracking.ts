import { useEffect, useState } from 'react'
import { ordersApi } from '../api/services'
import type { CustomerOrderTracking, OrderStatus } from '../api/types'

const TERMINAL: OrderStatus[] = ['Completed', 'Cancelled']

export function useOrderTracking(
  publicId: string | null,
  phone: string,
  enabled: boolean,
  pollMs = 5000
) {
  const [order, setOrder] = useState<CustomerOrderTracking | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !publicId || !phone.trim()) {
      return
    }

    let cancelled = false
    let intervalId: number | undefined

    const fetchStatus = async () => {
      try {
        const result = await ordersApi.trackPublic(publicId, phone)
        if (cancelled) return result
        setOrder(result)
        setError(null)
        if (TERMINAL.includes(result.status) && intervalId !== undefined) {
          window.clearInterval(intervalId)
        }
        return result
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load order status')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    setLoading(true)
    void fetchStatus()

    intervalId = window.setInterval(() => {
      void fetchStatus()
    }, pollMs)

    return () => {
      cancelled = true
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
      }
    }
  }, [publicId, phone, enabled, pollMs])

  return { order, loading, error }
}
