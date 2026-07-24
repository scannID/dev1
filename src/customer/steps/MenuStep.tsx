import { useEffect, useMemo, useState } from 'react'
import { Plus, Minus, Search, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import type { CatalogItem } from '../../api/types'
import { getCategoryImage } from '../../lib/categoryImages'
import { cartLineKey, normalizeRemovedIngredients } from '../../lib/catalogCart'
import { currency } from '../utils'

const PAGE_SIZE = 20

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
  onAdd: (itemId: string, removedIngredients?: string[]) => void
  onUpdateQty: (lineKey: string, delta: number) => void
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [sheetItemId, setSheetItemId] = useState<string | null>(null)
  const [removedByItem, setRemovedByItem] = useState<Record<string, string[]>>({})

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
        (item.details || '').toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle)
      )
    })
  }, [items, selectedCategory, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const sheetItem = sheetItemId ? items.find((item) => item.id === sheetItemId) ?? null : null

  useEffect(() => {
    setPage(1)
    setSheetItemId(null)
  }, [selectedCategory, query])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    if (!sheetItemId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheetItemId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetItemId])

  function selectCategory(category: string) {
    onCategory(category)
  }

  function toggleIngredient(itemId: string, ingredientName: string, included: boolean) {
    setRemovedByItem((prev) => {
      const current = new Set(prev[itemId] ?? [])
      if (included) current.delete(ingredientName)
      else current.add(ingredientName)
      return { ...prev, [itemId]: normalizeRemovedIngredients([...current]) }
    })
  }

  function itemQty(itemId: string) {
    return Object.entries(cart).reduce((sum, [key, qty]) => {
      const base = key.includes('::') ? key.slice(0, key.indexOf('::')) : key
      return base === itemId ? sum + qty : sum
    }, 0)
  }

  function addConfigured(item: CatalogItem) {
    const removed = removedByItem[item.id] ?? []
    onAdd(item.id, removed)
  }

  function quickAdd(item: CatalogItem) {
    if ((item.ingredients ?? []).length > 0) {
      setSheetItemId(item.id)
      return
    }
    onAdd(item.id)
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
            <img
              src={getCategoryImage(category)}
              alt=""
              className="cm-cat-icon"
              aria-hidden="true"
            />
            {category === 'all' ? 'All' : category}
          </button>
        ))}
      </div>

      <div className="cm-menu-grid">
        {pageItems.map((item) => {
          const qty = itemQty(item.id)
          const thumb = item.imageUrl || getCategoryImage(item.category)
          const hasCustom = (item.ingredients ?? []).length > 0

          return (
            <article key={item.id} className="cm-menu-card">
              <button
                type="button"
                className="cm-menu-card-hit"
                onClick={() => setSheetItemId(item.id)}
                aria-label={`View ${item.name}`}
              >
                <div className="cm-menu-card-media">
                  <img src={thumb} alt="" className="cm-menu-card-img" />
                </div>
                <div className="cm-menu-card-copy">
                  <h3>{item.name}</h3>
                  {item.description ? <p>{item.description}</p> : <p className="cm-menu-card-spacer">&nbsp;</p>}
                  <strong>{currency(item.price)}</strong>
                </div>
              </button>

              <div className="cm-menu-card-footer">
                {qty === 0 ? (
                  <button
                    type="button"
                    className="cm-add compact"
                    onClick={() => quickAdd(item)}
                  >
                    <Plus size={15} />
                    {hasCustom ? 'Options' : 'Add'}
                  </button>
                ) : (
                  <div className="cm-qty compact-inline">
                    <button
                      type="button"
                      onClick={() => {
                        if (hasCustom) setSheetItemId(item.id)
                        else onUpdateQty(cartLineKey(item.id), -1)
                      }}
                      aria-label={`Remove one ${item.name}`}
                    >
                      <Minus size={14} />
                    </button>
                    <span>{qty}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (hasCustom) setSheetItemId(item.id)
                        else onUpdateQty(cartLineKey(item.id), 1)
                      }}
                      aria-label={`Add one ${item.name}`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>
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

      {sheetItem ? (
        <ItemDetailSheet
          item={sheetItem}
          removed={removedByItem[sheetItem.id] ?? []}
          cartQty={(() => {
            const removed = removedByItem[sheetItem.id] ?? []
            return cart[cartLineKey(sheetItem.id, removed)] || 0
          })()}
          totalForItem={itemQty(sheetItem.id)}
          onClose={() => setSheetItemId(null)}
          onToggleIngredient={(name, included) => toggleIngredient(sheetItem.id, name, included)}
          onAdd={() => addConfigured(sheetItem)}
          onUpdateQty={(delta) => {
            const removed = removedByItem[sheetItem.id] ?? []
            onUpdateQty(cartLineKey(sheetItem.id, removed), delta)
          }}
        />
      ) : null}
    </div>
  )
}

function ItemDetailSheet({
  item,
  removed,
  cartQty,
  totalForItem,
  onClose,
  onToggleIngredient,
  onAdd,
  onUpdateQty,
}: {
  item: CatalogItem
  removed: string[]
  cartQty: number
  totalForItem: number
  onClose: () => void
  onToggleIngredient: (name: string, included: boolean) => void
  onAdd: () => void
  onUpdateQty: (delta: number) => void
}) {
  const thumb = item.imageUrl || getCategoryImage(item.category)
  const ingredients = item.ingredients ?? []
  const details = item.details || item.description

  return (
    <div className="cm-track-overlay" role="dialog" aria-modal="true" aria-label={item.name}>
      <button type="button" className="cm-track-backdrop" aria-label="Close item details" onClick={onClose} />
      <div className="cm-track-sheet cm-item-sheet">
        <div className="cm-item-sheet-handle" aria-hidden="true" />
        <div className="cm-track-sheet-header">
          <div>
            <p className="cm-item-sheet-cat">{item.category}</p>
            <h2>{item.name}</h2>
            <p className="cm-item-sheet-price">{currency(item.price)}</p>
          </div>
          <button type="button" className="cm-track-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="cm-item-sheet-media">
          <img src={thumb} alt="" />
        </div>

        {details ? <p className="cm-item-sheet-details">{details}</p> : null}

        {ingredients.length > 0 ? (
          <div className="cm-ingredients calm">
            <div className="cm-ingredients-head">
              <span className="cm-ingredients-label">Customize</span>
              <span className="cm-ingredients-hint">Tap to leave out</span>
            </div>
            <ul>
              {ingredients.map((ingredient) => {
                const included = !removed.includes(ingredient.name)
                return (
                  <li key={ingredient.id}>
                    <button
                      type="button"
                      className={`cm-ingredient calm${included ? ' on' : ''}`}
                      onClick={() => onToggleIngredient(ingredient.name, !included)}
                    >
                      <span className="cm-ingredient-check" aria-hidden="true">
                        {included ? <Check size={12} /> : null}
                      </span>
                      <span className="cm-ingredient-name">{ingredient.name}</span>
                      <span className="cm-ingredient-state">{included ? 'Included' : 'Left out'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        <div className="cm-item-sheet-actions">
          {cartQty === 0 ? (
            <button type="button" className="cm-add sheet" onClick={onAdd}>
              <Plus size={16} /> Add to cart · {currency(item.price)}
            </button>
          ) : (
            <div className="cm-item-sheet-qty-row">
              <div className="cm-qty">
                <button type="button" onClick={() => onUpdateQty(-1)} aria-label={`Remove one ${item.name}`}>
                  <Minus size={14} />
                </button>
                <span>{cartQty}</span>
                <button type="button" onClick={() => onUpdateQty(1)} aria-label={`Add one ${item.name}`}>
                  <Plus size={14} />
                </button>
              </div>
              <button type="button" className="cm-add sheet" onClick={onAdd}>
                <Plus size={16} /> Add another
              </button>
            </div>
          )}
          {totalForItem > cartQty ? (
            <span className="cm-menu-other-qty">{totalForItem} in cart with other options</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
