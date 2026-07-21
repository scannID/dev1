import type { Business } from '../api/types'

export function businessCategories(business: Business): string[] {
  if (business.categories?.length) {
    return business.categories
  }
  return [...new Set((business.items ?? []).map((item) => item.category).filter(Boolean))]
}
