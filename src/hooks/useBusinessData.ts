// Loads merchant or staff session via the same Keycloak login

import { useState, useEffect, useCallback, useMemo } from 'react'
import { scannyApi } from '../api/services'
import { clearStaffSession, getStaffBusinessId, setStaffBusinessId } from '../api/client'
import { operationsApi } from '../api/operations'
import keycloak, {
  hasMerchantSession,
  hasPortalSession,
  isStaffSession,
  waitForKeycloak,
} from '../keycloak'
import type {
  Business,
  CatalogItem,
  MerchantProfile,
  OnboardingStatusResponse,
  Order,
} from '../api/types'

const SELECTED_BRANCH_KEY = 'scanny-selected-business-id'

function storageKeyForMerchant(merchantId: string) {
  return `${SELECTED_BRANCH_KEY}:${merchantId}`
}

function normalizeBusiness(business: Business): Business {
  return { ...business, items: business.items ?? [] }
}

export function useBusinessData() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingStatusResponse | null>(null)
  const [staffMode, setStaffMode] = useState(false)
  const [staffName, setStaffName] = useState<string | null>(null)
  const [staffRole, setStaffRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedBusiness = useMemo(() => {
    if (!businesses.length) return null
    return businesses.find((b) => b.id === selectedBusinessId) ?? businesses[0]
  }, [businesses, selectedBusinessId])

  const selectBusiness = useCallback(
    async (businessId: string) => {
      if (staffMode) {
        setStaffBusinessId(businessId)
        setSelectedBusinessId(businessId)
        try {
          const me = await operationsApi.staffMe(businessId)
          const withItems = normalizeBusiness(me.business)
          setBusinesses([withItems])
          setStaffName(me.staff.displayName || me.staff.email)
          setStaffRole(me.staff.role)
          const orderList = await scannyApi.orders.list(businessId)
          setOrders(orderList)
        } catch (err) {
          console.error('Failed to switch staff branch:', err)
          setError(err instanceof Error ? err.message : 'Failed to switch branch')
        }
        return
      }
      setSelectedBusinessId(businessId)
      if (merchant?.id) {
        localStorage.setItem(storageKeyForMerchant(merchant.id), businessId)
      }
      try {
        const full = await scannyApi.businesses.get(businessId)
        const withItems = normalizeBusiness(full)
        setBusinesses((current) => {
          const exists = current.some((b) => b.id === businessId)
          if (!exists) return [...current, withItems]
          return current.map((b) => (b.id === businessId ? withItems : b))
        })
        const orderList = await scannyApi.orders.list(businessId)
        setOrders(orderList)
      } catch (err) {
        console.error('Failed to switch branch:', err)
        setError(err instanceof Error ? err.message : 'Failed to switch branch')
      }
    },
    [merchant, staffMode],
  )

  const loadStaffSession = useCallback(async () => {
    await waitForKeycloak()
    if (!isStaffSession() && !hasPortalSession()) {
      throw new Error('Not authenticated')
    }
    const preferred = getStaffBusinessId() || undefined
    const me = await operationsApi.staffMe(preferred)
    setStaffBusinessId(me.business.id)
    setStaffMode(true)
    setStaffName(me.staff.displayName || me.staff.email)
    setStaffRole(me.staff.role)
    setMerchant(null)
    setOnboarding(null)
    const withItems = normalizeBusiness(me.business)
    setBusinesses([withItems])
    setSelectedBusinessId(withItems.id)
    const orderList = await scannyApi.orders.list(withItems.id)
    setOrders(orderList)
  }, [])

  const loadMerchantSession = useCallback(async () => {
    await waitForKeycloak()
    if (!keycloak.authenticated) {
      throw new Error('Not authenticated')
    }
    await keycloak.updateToken(5).catch(() => undefined)
    if (!keycloak.token) {
      throw new Error('Not authenticated')
    }

    const me = await scannyApi.merchant.me()
    const list = (me.businesses?.length ? me.businesses : [me.business]).map(normalizeBusiness)
    const preferred =
      localStorage.getItem(storageKeyForMerchant(me.merchant.id)) ||
      list.find((b) => b.primary)?.id ||
      list[0]?.id ||
      null

    setStaffMode(false)
    setStaffName(null)
    setStaffRole(null)
    setMerchant(me.merchant)
    setOnboarding(me.onboarding)
    setBusinesses(list)
    setSelectedBusinessId(preferred)

    const activeId = preferred ?? list[0]?.id
    if (activeId) {
      const orderList = await scannyApi.orders.list(activeId)
      setOrders(orderList)
      try {
        const full = await scannyApi.businesses.get(activeId)
        const withItems = normalizeBusiness(full)
        setBusinesses((current) => current.map((b) => (b.id === activeId ? withItems : b)))
      } catch {
        // keep me payload
      }
    }
  }, [])

  const loadSession = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      await waitForKeycloak()
      if (isStaffSession() || (hasPortalSession() && !hasMerchantSession())) {
        await loadStaffSession()
      } else {
        await loadMerchantSession()
      }
    } catch (err) {
      console.error('Failed to load session:', err)
      setError(err instanceof Error ? err.message : 'Failed to load session')
      setBusinesses([])
      setOrders([])
      setMerchant(null)
      setOnboarding(null)
      setSelectedBusinessId(null)
      setStaffMode(false)
      setStaffName(null)
      setStaffRole(null)
    } finally {
      setLoading(false)
    }
  }, [loadMerchantSession, loadStaffSession])

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
      const withItems = normalizeBusiness(business)
      setBusinesses((current) => {
        const exists = current.some((b) => b.id === businessId)
        if (!exists) return [...current, withItems]
        return current.map((b) => (b.id === businessId ? withItems : b))
      })
      return withItems
    } catch (err) {
      console.error('Failed to refresh business:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh business')
      return null
    }
  }, [])

  const refreshBranches = useCallback(async () => {
    if (staffMode || !selectedBusiness?.id) return
    try {
      const branches = await operationsApi.listBranches(selectedBusiness.id)
      await loadMerchantSession()
      return branches
    } catch (err) {
      console.error('Failed to refresh branches:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh branches')
      return null
    }
  }, [loadMerchantSession, selectedBusiness, staffMode])

  const updateLocalItems = useCallback((businessId: string, items: CatalogItem[]) => {
    setBusinesses((current) =>
      current.map((b) => (b.id === businessId ? { ...b, items } : b)),
    )
  }, [])

  const logoutStaff = useCallback(() => {
    clearStaffSession()
    setStaffMode(false)
    setStaffName(null)
    setStaffRole(null)
    setBusinesses([])
    setOrders([])
    setSelectedBusinessId(null)
  }, [])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  return {
    businesses,
    selectedBusiness,
    selectedBusinessId: selectedBusiness?.id ?? null,
    selectBusiness,
    orders,
    merchant,
    onboarding,
    staffMode,
    staffName,
    staffRole,
    loading,
    error,
    refreshBusinesses: loadSession,
    refreshBusiness,
    refreshBranches,
    loadOrders,
    setOrders,
    setBusinesses,
    updateLocalItems,
    logoutStaff,
  }
}

export default useBusinessData
