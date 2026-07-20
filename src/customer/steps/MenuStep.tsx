import { useEffect, useMemo, useState } from 'react'
import { Plus, Minus, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import type { CatalogItem } from '../../api/types'
import { currency } from '../utils'

const PAGE_SIZE = 10

export function MenuStep({
  items,
  cart,
  selectedCategory,
  onCategory,
  onAdd,
  onUpdateQty,
}: {
  items: CatalogItem[]
  cart: Record<string, number>
  selectedCategory: string
  onCategory: (category: string) => void
  onAdd: (itemId: string) => void
  onUpdateQty: (itemId: string, delta: number) => void
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const categories = useMemo(
    () => ['all', ...new Set(items.map((item) => item.category))],
    [items],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      if (!item.available) return false
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false
      if (!needle) return true
      return (
        item.name.toLowerCase().includes(needle) ||
        (item.description || '').toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle)
      )
    })
  }, [items, selectedCategory, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [selectedCategory, query])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  function selectCategory(category: string) {
    onCategory(category)
  }

  return (
    <div className="cm-step cm-step-enter">
      <div className="cm-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search menu…"
          aria-label="Search menu"
          autoComplete="off"
        />
      </div>

      <div className="cm-cats" role="tablist" aria-label="Categories">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={selectedCategory === category}
            className={selectedCategory === category ? 'active' : ''}
            onClick={() => selectCategory(category)}
          >
            {category === 'all' ? 'All' : category}
          </button>
        ))}
      </div>

      <div className="cm-list">
        {pageItems.map((item) => {
          const qty = cart[item.id] || 0
          return (
            <article key={item.id} className="cm-row">
              <div className="cm-row-body">
                <h3>{item.name}</h3>
                {item.description ? <p>{item.description}</p> : null}
                <strong>{currency(item.price)}</strong>
              </div>
              {qty === 0 ? (
                <button type="button" className="cm-add" onClick={() => onAdd(item.id)}>
                  <Plus size={16} /> Add
                </button>
              ) : (
                <div className="cm-qty">
                  <button type="button" onClick={() => onUpdateQty(item.id, -1)} aria-label={`Remove one ${item.name}`}>
                    <Minus size={14} />
                  </button>
                  <span>{qty}</span>
                  <button type="button" onClick={() => onUpdateQty(item.id, 1)} aria-label={`Add one ${item.name}`}>
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </article>
          )
        })}
        {filtered.length === 0 && (
          <p className="cm-empty">
            {query.trim() ? 'No items match your search.' : 'No items available in this category.'}
          </p>
        )}
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="cm-pager">
          <button
            type="button"
            className="cm-pager-btn"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="cm-pager-label">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="cm-pager-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
