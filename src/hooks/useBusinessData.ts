// Custom hook for business data with API integration
// Handles loading, caching, and syncing with backend

import { useState, useEffect, useCallback } from 'react'
import { scanitApi } from '../api/services'
import type { Business, CatalogItem, Order } from '../api/types'

// Storage keys for backward compatibility
const BUSINESSES_KEY = 'scanny-businesses-v2'
const ORDERS_KEY = 'scanny-orders-v1'

export function useBusinessData() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load businesses from API
  const loadBusinesses = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await scanitApi.businesses.list()
      setBusinesses(data)
      
      // Also cache in localStorage for offline support
      localStorage.setItem(BUSINESSES_KEY, JSON.stringify(data))
    } catch (err) {
      console.error('Failed to load businesses:', err)
      setError(err instanceof Error ? err.message : 'Failed to load businesses')
      
      // Fallback to localStorage if API fails
      try {
        const cached = localStorage.getItem(BUSINESSES_KEY)
        if (cached) {
          setBusinesses(JSON.parse(cached))
        }
      } catch (e) {
        console.error('Failed to load from cache:', e)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Load orders for a business from API
  const loadOrders = useCallback(async (businessId: string) => {
    try {
      setError(null)
      const data = await scanitApi.orders.list(businessId)
      setOrders(data)
      
      // Cache in localStorage
      localStorage.setItem(ORDERS_KEY, JSON.stringify(data))
    } catch (err) {
      console.error('Failed to load orders:', err)
      setError(err instanceof Error ? err.message : 'Failed to load orders')
      
      // Fallback to localStorage
      try {
        const cached = localStorage.getItem(ORDERS_KEY)
        if (cached) {
          setOrders(JSON.parse(cached))
        }
      } catch (e) {
        console.error('Failed to load orders from cache:', e)
      }
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadBusinesses()
  }, [loadBusinesses])

  return {
    businesses,
    orders,
    loading,
    error,
    refreshBusinesses: loadBusinesses,
    loadOrders,
    setOrders, // For optimistic updates
  }
}

export default useBusinessData
