import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_PAGE_SIZE_OPTIONS } from './usePagination'
import type { PaginationResult } from './usePagination'

export type UseServerPaginationOptions = {
  totalItems: number
  initialPageSize?: number
  pageSizeOptions?: readonly number[]
  resetKey?: string | number
}

/**
 * Pagination controls driven by server `totalItems` (does not slice locally).
 * Pair with an API fetch that uses `page` + `pageSize`.
 */
export function useServerPagination(
  options: UseServerPaginationOptions,
): Omit<PaginationResult<never>, 'pageItems'> & { pageItems: undefined } {
  const pageSizeOptions = options.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(options.initialPageSize ?? 10)

  useEffect(() => {
    setPage(1)
  }, [options.resetKey])

  const totalItems = Math.max(0, options.totalItems)
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1)
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const firstItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const lastItem = Math.min(currentPage * pageSize, totalItems)

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size)
    setPage(1)
  }, [])

  return {
    pageItems: undefined,
    page: currentPage,
    pageSize,
    totalPages,
    totalItems,
    firstItem,
    lastItem,
    pageSizeOptions,
    setPage,
    setPageSize,
  }
}
