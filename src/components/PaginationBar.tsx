import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PaginationResult } from '../hooks/usePagination'

type PaginationBarProps = {
  pagination: Pick<
    PaginationResult<unknown>,
    | 'page'
    | 'pageSize'
    | 'totalPages'
    | 'totalItems'
    | 'firstItem'
    | 'lastItem'
    | 'pageSizeOptions'
    | 'setPage'
    | 'setPageSize'
  >
  /** Extra class on the outer bar (e.g. report-card padding). */
  className?: string
  /** Hide the bar entirely when the list is empty. */
  hideWhenEmpty?: boolean
}

function pageButtons(current: number, total: number): (number | '…')[] {
  return Array.from({ length: total }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === total || Math.abs(p - current) <= 1)
    .reduce<(number | '…')[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
      acc.push(p)
      return acc
    }, [])
}

export function PaginationBar({
  pagination,
  className = '',
  hideWhenEmpty = true,
}: PaginationBarProps) {
  const {
    page,
    pageSize,
    totalPages,
    totalItems,
    firstItem,
    lastItem,
    pageSizeOptions,
    setPage,
    setPageSize,
  } = pagination

  if (hideWhenEmpty && totalItems === 0) return null

  return (
    <div className={`pagination-bar ${className}`.trim()}>
      <div className="pagination-bar-meta">
        <span className="pagination-bar-summary">
          {totalItems === 0
            ? 'No items'
            : `Showing ${firstItem}–${lastItem} of ${totalItems}`}
        </span>
        <label className="pagination-bar-size">
          <span>Per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger className="h-7 w-[72px] text-xs" aria-label="Items per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="">
              {pageSizeOptions.map((size) => (
                <SelectItem className="" key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="pagination-bar-nav">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        {totalPages > 1 &&
          pageButtons(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? 'default' : 'outline'}
                size="sm"
                className="h-7 w-7 text-xs p-0"
                onClick={() => setPage(p as number)}
              >
                {p}
              </Button>
            ),
          )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
