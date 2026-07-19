import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/services'
import type { Merchant, MerchantSummary } from '../api/types'

export function useMerchants() {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [summary, setSummary] = useState<MerchantSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMerchants = useCallback(async (search?: string) => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminApi.merchants.list({ limit: 100, search })
      setMerchants(response.merchants)
      setSummary(response.summary)
    } catch (err) {
      console.error('Failed to load merchants:', err)
      setError(err instanceof Error ? err.message : 'Failed to load merchants')
      setMerchants([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await adminApi.merchants.list({ limit: 100 })
        if (cancelled) return
        setMerchants(response.merchants)
        setSummary(response.summary)
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load merchants:', err)
        setError(err instanceof Error ? err.message : 'Failed to load merchants')
        setMerchants([])
        setSummary(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    merchants,
    summary,
    loading,
    error,
    refresh: loadMerchants,
  }
}

export default useMerchants
