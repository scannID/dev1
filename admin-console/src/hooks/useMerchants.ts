import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/services'
import type { Merchant, MerchantSummary, MerchantsListResponse } from '../api/types'

type LoadParams = {
  page?: number
  limit?: number
  search?: string
  silent?: boolean
}

export function useMerchants(params: { page: number; limit: number; search?: string }) {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [summary, setSummary] = useState<MerchantSummary | null>(null)
  const [pagination, setPagination] = useState<MerchantsListResponse['pagination'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMerchants = useCallback(async (opts?: LoadParams) => {
    const page = opts?.page ?? params.page
    const limit = opts?.limit ?? params.limit
    const search = opts?.search ?? params.search
    const silent = opts?.silent ?? false
    try {
      if (!silent) setLoading(true)
      setError(null)
      const response = await adminApi.merchants.list({
        page,
        limit,
        search: search?.trim() || undefined,
      })
      setMerchants(response.merchants)
      setSummary(response.summary)
      setPagination(response.pagination)
    } catch (err) {
      console.error('Failed to load merchants:', err)
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load merchants')
        setMerchants([])
        setSummary(null)
        setPagination(null)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [params.page, params.limit, params.search])

  useEffect(() => {
    void loadMerchants()
  }, [loadMerchants])

  return {
    merchants,
    summary,
    pagination,
    loading,
    error,
    refresh: (search?: string) => loadMerchants({ search, silent: false }),
  }
}

export default useMerchants
