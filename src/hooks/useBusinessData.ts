// Loads merchant session (me) + business + orders from the API

import { useState, useEffect, useCallback } from 'react'
import { scanitApi } from '../api/services'
import type {
  Business,
  CatalogItem,
  MerchantProfile,
  OnboardingStatusResponse,
  Order,
} from '../api/types'

const BUSINESSES_KEY = 'scanny-businesses-v2'
const ORDERS_KEY = 'scanny-orders-v1'

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

      const me = await scanitApi.merchant.me()
      const business: Business = {
        ...me.business,
        items: me.business.items ?? [],
      }

      setMerchant(me.merchant)
      setOnboarding(me.onboarding)
      setBusinesses([business])
      localStorage.setItem(BUSINESSES_KEY, JSON.stringify([business]))

      const orderList = await scanitApi.orders.list(business.id)
      setOrders(orderList)
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orderList))
    } catch (err) {
      console.error('Failed to load merchant session:', err)
      setError(err instanceof Error ? err.message : 'Failed to load merchant data')

      try {
        const cachedBiz = localStorage.getItem(BUSINESSES_KEY)
        if (cachedBiz) setBusinesses(JSON.parse(cachedBiz))
        const cachedOrders = localStorage.getItem(ORDERS_KEY)
        if (cachedOrders) setOrders(JSON.parse(cachedOrders))
      } catch {
        // ignore cache parse errors
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOrders = useCallback(async (businessId: string) => {
    try {
      setError(null)
      const data = await scanitApi.orders.list(businessId)
      setOrders(data)
      localStorage.setItem(ORDERS_KEY, JSON.stringify(data))
    } catch (err) {
      console.error('Failed to load orders:', err)
      setError(err instanceof Error ? err.message : 'Failed to load orders')
    }
  }, [])

  const refreshBusiness = useCallback(async (businessId: string) => {
    try {
      const business = await scanitApi.businesses.get(businessId)
      const withItems: Business = { ...business, items: business.items ?? [] }
      setBusinesses([withItems])
      localStorage.setItem(BUSINESSES_KEY, JSON.stringify([withItems]))
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
    loadSession()
  }, [loadSession])

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
