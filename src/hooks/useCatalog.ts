// Custom hook for catalog operations with API integration

import { useState, useCallback } from 'react'
import { scanitApi } from '../api/services'
import type { CatalogItem, CreateCatalogItemRequest, UpdateCatalogItemRequest } from '../api/types'

export function useCatalog(businessId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createItem = useCallback(async (data: CreateCatalogItemRequest): Promise<CatalogItem | null> => {
    try {
      setLoading(true)
      setError(null)
      const item = await scanitApi.catalog.create(businessId, data)
      return item
    } catch (err) {
      console.error('Failed to create catalog item:', err)
      setError(err instanceof Error ? err.message : 'Failed to create item')
      return null
    } finally {
      setLoading(false)
    }
  }, [businessId])

  const updateItem = useCallback(async (itemId: string, data: UpdateCatalogItemRequest): Promise<CatalogItem | null> => {
    try {
      setLoading(true)
      setError(null)
      const item = await scanitApi.catalog.update(businessId, itemId, data)
      return item
    } catch (err) {
      console.error('Failed to update catalog item:', err)
      setError(err instanceof Error ? err.message : 'Failed to update item')
      return null
    } finally {
      setLoading(false)
    }
  }, [businessId])

  const toggleAvailability = useCallback(async (itemId: string, available: boolean): Promise<CatalogItem | null> => {
    try {
      setLoading(true)
      setError(null)
      const item = await scanitApi.catalog.updateAvailability(businessId, itemId, available)
      return item
    } catch (err) {
      console.error('Failed to toggle availability:', err)
      setError(err instanceof Error ? err.message : 'Failed to toggle availability')
      return null
    } finally {
      setLoading(false)
    }
  }, [businessId])

  const deleteItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      setLoading(true)
      setError(null)
      await scanitApi.catalog.delete(businessId, itemId)
      return true
    } catch (err) {
      console.error('Failed to delete catalog item:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete item')
      return false
    } finally {
      setLoading(false)
    }
  }, [businessId])

  return {
    loading,
    error,
    createItem,
    updateItem,
    toggleAvailability,
    deleteItem,
  }
}

export default useCatalog
