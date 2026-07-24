import type { CatalogItem } from '../api/types'

export function discountPercentOf(item: Pick<CatalogItem, 'discountPercent'> | number | null | undefined): number {
  if (typeof item === 'number') return Math.max(0, Math.min(100, item))
  const value = item?.discountPercent ?? 0
  return Math.max(0, Math.min(100, value))
}

/** Sale unit price after knocking off discountPercent from list price. */
export function effectivePrice(listPrice: number, discountPercent?: number | null): number
export function effectivePrice(item: Pick<CatalogItem, 'price' | 'discountPercent'>): number
export function effectivePrice(
  listPriceOrItem: number | Pick<CatalogItem, 'price' | 'discountPercent'>,
  discountPercent?: number | null,
): number {
  if (typeof listPriceOrItem === 'object') {
    return effectivePrice(listPriceOrItem.price, listPriceOrItem.discountPercent)
  }
  const percent = discountPercentOf(discountPercent)
  if (percent === 0) return listPriceOrItem
  return Math.round(listPriceOrItem * (100 - percent) / 100)
}

export function isOnOffer(item: Pick<CatalogItem, 'discountPercent' | 'available'>): boolean {
  return (item.available !== false) && discountPercentOf(item) > 0
}
