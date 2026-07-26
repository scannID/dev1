/** Cart line identity: same item with different removals or stay dates stays distinct. */

export function normalizeRemovedIngredients(removed?: string[] | null): string[] {
  if (!removed?.length) return []
  return [...new Set(removed.map((name) => name.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )
}

export function cartLineKey(
  itemId: string,
  removedIngredients?: string[] | null,
  stay?: { checkInDate: string; checkOutDate: string } | null,
): string {
  if (stay?.checkInDate && stay?.checkOutDate) {
    return `${itemId}::stay:${stay.checkInDate}:${stay.checkOutDate}`
  }
  const removed = normalizeRemovedIngredients(removedIngredients)
  return removed.length === 0 ? itemId : `${itemId}::${removed.join('|')}`
}

export function parseCartLineKey(lineKey: string): {
  itemId: string
  removedIngredients: string[]
  checkInDate?: string
  checkOutDate?: string
} {
  const sep = lineKey.indexOf('::')
  if (sep < 0) {
    return { itemId: lineKey, removedIngredients: [] }
  }
  const itemId = lineKey.slice(0, sep)
  const rest = lineKey.slice(sep + 2)
  if (rest.startsWith('stay:')) {
    const [, checkInDate, checkOutDate] = rest.split(':')
    return {
      itemId,
      removedIngredients: [],
      checkInDate,
      checkOutDate,
    }
  }
  return {
    itemId,
    removedIngredients: rest ? rest.split('|').filter(Boolean) : [],
  }
}

export function nightsBetween(checkInDate: string, checkOutDate: string): number {
  const start = Date.parse(`${checkInDate}T00:00:00`)
  const end = Date.parse(`${checkOutDate}T00:00:00`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 1
  return Math.max(1, Math.round((end - start) / 86_400_000))
}

export function isLodgingItem(item: { itemKind?: string | null }): boolean {
  return item.itemKind === 'ROOM' || item.itemKind === 'SUITE'
}

export function formatRemovedIngredients(removed?: string[] | null): string {
  const list = normalizeRemovedIngredients(removed)
  if (list.length === 0) return ''
  return list.map((name) => `No ${name}`).join(', ')
}

export function newIngredientId(): string {
  return `ing-${Math.random().toString(36).slice(2, 10)}`
}
