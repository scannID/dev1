// Custom hook for catalog operations with API integration

import { useState, useCallback } from 'react'
import { scannyApi } from '../api/services'
import { ApiError } from '../api/client'
import type { CatalogItem, CreateCatalogItemRequest, UpdateCatalogItemRequest } from '../api/types'

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

export function useCatalog(businessId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createItem = useCallback(async (data: CreateCatalogItemRequest): Promise<CatalogItem> => {
    try {
      setLoading(true)
      setError(null)
      return await scannyApi.catalog.create(businessId, data)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to create item')
      console.error('Failed to create catalog item:', err)
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  const updateItem = useCallback(async (itemId: string, data: UpdateCatalogItemRequest): Promise<CatalogItem> => {
    try {
      setLoading(true)
      setError(null)
      return await scannyApi.catalog.update(businessId, itemId, data)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to update item')
      console.error('Failed to update catalog item:', err)
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  const toggleAvailability = useCallback(async (itemId: string, available: boolean): Promise<CatalogItem> => {
    try {
      setLoading(true)
      setError(null)
      return await scannyApi.catalog.updateAvailability(businessId, itemId, available)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to toggle availability')
      console.error('Failed to toggle availability:', err)
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  const deleteItem = useCallback(async (itemId: string): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      await scannyApi.catalog.delete(businessId, itemId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to delete item')
      console.error('Failed to delete catalog item:', err)
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  const addCategory = useCallback(async (name: string): Promise<string[]> => {
    try {
      setLoading(true)
      setError(null)
      return await scannyApi.catalog.addCategory(businessId, name)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to add category')
      console.error('Failed to add category:', err)
      setError(message)
      throw new Error(message)
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
    addCategory,
  }
}

export default useCatalog
