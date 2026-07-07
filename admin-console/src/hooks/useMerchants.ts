// Custom hook for merchants data with API integration

import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/services'
import type { Merchant, MerchantStats } from '../api/types'

export function useMerchants() {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [stats, setStats] = useState<MerchantStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMerchants = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Load merchants and stats in parallel
      const [merchantsData, statsData] = await Promise.all([
        adminApi.merchants.list(),
        adminApi.merchants.getStats(),
      ])

      setMerchants(merchantsData)
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load merchants:', err)
      setError(err instanceof Error ? err.message : 'Failed to load merchants')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMerchants()
  }, [loadMerchants])

  return {
    merchants,
    stats,
    loading,
    error,
    refresh: loadMerchants,
  }
}

export default useMerchants
