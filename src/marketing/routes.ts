export type MarketingSlug =
  | 'how-it-works'
  | 'dashboard'
  | 'ordering'
  | 'pricing'
  | 'about'
  | 'careers'
  | 'contact'
  | 'press'
  | 'help'
  | 'guides'
  | 'status'
  | 'api'
  | 'privacy'
  | 'terms'
  | 'security'
  | 'cookies'

export const MARKETING_SLUGS: MarketingSlug[] = [
  'how-it-works',
  'dashboard',
  'ordering',
  'pricing',
  'about',
  'careers',
  'contact',
  'press',
  'help',
  'guides',
  'status',
  'api',
  'privacy',
  'terms',
  'security',
  'cookies',
]

export type FooterLink = { label: string; href: string; slug?: MarketingSlug }

export const footerCols: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '/how-it-works', slug: 'how-it-works' },
      { label: 'Merchant dashboard', href: '/dashboard', slug: 'dashboard' },
      { label: 'Customer ordering', href: '/ordering', slug: 'ordering' },
      { label: 'Pricing', href: '/pricing', slug: 'pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about', slug: 'about' },
      { label: 'Careers', href: '/careers', slug: 'careers' },
      { label: 'Contact', href: '/contact', slug: 'contact' },
      { label: 'Press', href: '/press', slug: 'press' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Help center', href: '/help', slug: 'help' },
      { label: 'Guides', href: '/guides', slug: 'guides' },
      { label: 'Status', href: '/status', slug: 'status' },
      { label: 'API', href: '/api', slug: 'api' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy', slug: 'privacy' },
      { label: 'Terms', href: '/terms', slug: 'terms' },
      { label: 'Security', href: '/security', slug: 'security' },
      { label: 'Cookies', href: '/cookies', slug: 'cookies' },
    ],
  },
]

export function pathForSlug(slug: MarketingSlug): string {
  return `/${slug}`
}

export function slugFromPathname(pathname: string): MarketingSlug | null {
  const clean = pathname.replace(/\/+$/, '') || '/'
  const match = clean.match(/^\/([a-z0-9-]+)$/)
  if (!match) return null
  const slug = match[1] as MarketingSlug
  return MARKETING_SLUGS.includes(slug) ? slug : null
}

export function navigateMarketing(path: string) {
  if (window.location.pathname === path) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo(0, 0)
}
