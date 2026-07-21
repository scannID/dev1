/** System-wide static images for menu categories (matched by name/keyword). */

const CATEGORY_FILES: Record<string, string> = {
  all: '/categories/default.svg',
  drinks: '/categories/drinks.svg',
  drink: '/categories/drinks.svg',
  beverages: '/categories/drinks.svg',
  beverage: '/categories/drinks.svg',
  juice: '/categories/drinks.svg',
  coffee: '/categories/drinks.svg',
  beer: '/categories/drinks.svg',
  wine: '/categories/drinks.svg',
  cocktails: '/categories/drinks.svg',
  meals: '/categories/meals.svg',
  meal: '/categories/meals.svg',
  food: '/categories/meals.svg',
  mains: '/categories/meals.svg',
  lunch: '/categories/meals.svg',
  dinner: '/categories/meals.svg',
  breakfast: '/categories/meals.svg',
  desserts: '/categories/desserts.svg',
  dessert: '/categories/desserts.svg',
  sweets: '/categories/desserts.svg',
  bakery: '/categories/desserts.svg',
  tickets: '/categories/tickets.svg',
  ticket: '/categories/tickets.svg',
  events: '/categories/tickets.svg',
  goods: '/categories/goods.svg',
  retail: '/categories/goods.svg',
  products: '/categories/goods.svg',
  merchandise: '/categories/goods.svg',
  services: '/categories/services.svg',
  service: '/categories/services.svg',
  parking: '/categories/services.svg',
  delivery: '/categories/services.svg',
}

const KEYWORD_MATCHES: Array<[string, string]> = [
  ['drink', '/categories/drinks.svg'],
  ['beverage', '/categories/drinks.svg'],
  ['juice', '/categories/drinks.svg'],
  ['coffee', '/categories/drinks.svg'],
  ['meal', '/categories/meals.svg'],
  ['food', '/categories/meals.svg'],
  ['main', '/categories/meals.svg'],
  ['dessert', '/categories/desserts.svg'],
  ['sweet', '/categories/desserts.svg'],
  ['ticket', '/categories/tickets.svg'],
  ['event', '/categories/tickets.svg'],
  ['good', '/categories/goods.svg'],
  ['product', '/categories/goods.svg'],
  ['retail', '/categories/goods.svg'],
  ['service', '/categories/services.svg'],
]

export function getCategoryImage(category: string): string {
  const key = category.trim().toLowerCase()
  if (!key || key === 'all') return CATEGORY_FILES.all
  if (CATEGORY_FILES[key]) return CATEGORY_FILES[key]

  for (const [needle, url] of KEYWORD_MATCHES) {
    if (key.includes(needle)) return url
  }

  return CATEGORY_FILES.all
}
