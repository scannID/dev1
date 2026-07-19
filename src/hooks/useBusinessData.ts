// Loads merchant session (me) + business + orders from the API

import { useState, useEffect, useCallback } from 'react'
import { scannyApi } from '../api/services'
import type {
  Business,
  CatalogItem,
  MerchantProfile,
  OnboardingStatusResponse,
  Order,
} from '../api/types'

export function useBusinessData() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSession = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const me = await scannyApi.merchant.me()
      const business: Business = {
        ...me.business,
        items: me.business.items ?? [],
      }

      setMerchant(me.merchant)
      setOnboarding(me.onboarding)
      setBusinesses([business])

      const orderList = await scannyApi.orders.list(business.id)
      setOrders(orderList)
    } catch (err) {
      console.error('Failed to load merchant session:', err)
      setError(err instanceof Error ? err.message : 'Failed to load merchant data')
      setBusinesses([])
      setOrders([])
      setMerchant(null)
      setOnboarding(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOrders = useCallback(async (businessId: string) => {
    if (!businessId) return
    try {
      setError(null)
      const data = await scannyApi.orders.list(businessId)
      setOrders(data)
    } catch (err) {
      console.error('Failed to load orders:', err)
      setError(err instanceof Error ? err.message : 'Failed to load orders')
    }
  }, [])

  const refreshBusiness = useCallback(async (businessId: string) => {
    try {
      const business = await scannyApi.businesses.get(businessId)
      const withItems: Business = { ...business, items: business.items ?? [] }
      setBusinesses([withItems])
      return withItems
    } catch (err) {
      console.error('Failed to refresh business:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh business')
      return null
    }
  }, [])

  const updateLocalItems = useCallback((businessId: string, items: CatalogItem[]) => {
    setBusinesses((current) =>
      current.map((b) => (b.id === businessId ? { ...b, items } : b))
    )
  }, [])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const me = await scannyApi.merchant.me()
        if (cancelled) return

        const business: Business = {
          ...me.business,
          items: me.business.items ?? [],
        }

        setMerchant(me.merchant)
        setOnboarding(me.onboarding)
        setBusinesses([business])

        const orderList = await scannyApi.orders.list(business.id)
        if (cancelled) return
        setOrders(orderList)
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load merchant session:', err)
        setError(err instanceof Error ? err.message : 'Failed to load merchant data')
        setBusinesses([])
        setOrders([])
        setMerchant(null)
        setOnboarding(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    businesses,
    orders,
    merchant,
    onboarding,
    loading,
    error,
    refreshBusinesses: loadSession,
    refreshBusiness,
    loadOrders,
    setOrders,
    setBusinesses,
    updateLocalItems,
  }
}

export default useBusinessData
