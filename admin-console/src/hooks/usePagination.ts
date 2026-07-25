import { useEffect, useMemo, useState } from 'react'

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

export type UsePaginationOptions = {
  initialPageSize?: number
  pageSizeOptions?: readonly number[]
  resetKey?: string | number
}

export type PaginationResult<T> = {
  pageItems: T[]
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  firstItem: number
  lastItem: number
  pageSizeOptions: readonly number[]
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

export function usePagination<T>(
  items: T[],
  options: UsePaginationOptions = {},
): PaginationResult<T> {
  const pageSizeOptions = options.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS
  const initialPageSize = options.initialPageSize ?? 20

  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  useEffect(() => {
    setPage(1)
  }, [options.resetKey])

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1)
  const currentPage = Math.min(Math.max(1, page), totalPages)

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize],
  )

  const firstItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const lastItem = Math.min(currentPage * pageSize, totalItems)

  function setPageSize(size: number) {
    setPageSizeState(size)
    setPage(1)
  }

  return {
    pageItems,
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
