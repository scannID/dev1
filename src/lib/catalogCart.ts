/** Cart line identity: same item with different removals stays distinct. */

export function normalizeRemovedIngredients(removed?: string[] | null): string[] {
  if (!removed?.length) return []
  return [...new Set(removed.map((name) => name.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )
}

export function cartLineKey(itemId: string, removedIngredients?: string[] | null): string {
  const removed = normalizeRemovedIngredients(removedIngredients)
  return removed.length === 0 ? itemId : `${itemId}::${removed.join('|')}`
}

export function parseCartLineKey(lineKey: string): { itemId: string; removedIngredients: string[] } {
  const sep = lineKey.indexOf('::')
  if (sep < 0) {
    return { itemId: lineKey, removedIngredients: [] }
  }
  const itemId = lineKey.slice(0, sep)
  const removedPart = lineKey.slice(sep + 2)
  return {
    itemId,
    removedIngredients: removedPart ? removedPart.split('|').filter(Boolean) : [],
  }
}

export function formatRemovedIngredients(removed?: string[] | null): string {
  const list = normalizeRemovedIngredients(removed)
  if (list.length === 0) return ''
  return list.map((name) => `No ${name}`).join(', ')
}

export function newIngredientId(): string {
  return `ing-${Math.random().toString(36).slice(2, 10)}`
}
