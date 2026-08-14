import { useEffect } from 'react'

const BASE_URL = 'https://kode.ug'
const SITE_SUFFIX = ' — Kode'
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`

export interface PageMeta {
  /** Page <title>. The site suffix " — Kode" is appended automatically unless suppressSuffix is true. */
  title: string
  description: string
  /** Canonical path, e.g. "/pricing". Defaults to current pathname. */
  canonicalPath?: string
  /** Suppress appending " — Kode" to the title (use for the home page which already includes it). */
  suppressSuffix?: boolean
  /** OG image URL — defaults to the global og-image.png */
  ogImage?: string
  /** OG type — defaults to "website" */
  ogType?: string
  /** Robots directive — defaults to "index, follow" */
  robots?: string
}

/**
 * Sets document.title, meta description, canonical, and key OG/Twitter tags
 * for the current route. Call once per page-level component.
 *
 * This is a client-side-only approach. For full SSR/SSG support, consider
 * migrating to Next.js App Router where these become static generateMetadata()
 * exports — at that point, delete this hook and move values to generateMetadata.
 */
export function usePageMeta({
  title,
  description,
  canonicalPath,
  suppressSuffix = false,
  ogImage = DEFAULT_IMAGE,
  ogType = 'website',
  robots = 'index, follow',
}: PageMeta): void {
  useEffect(() => {
    const fullTitle = suppressSuffix ? title : `${title}${SITE_SUFFIX}`
    const canonical = `${BASE_URL}${canonicalPath ?? window.location.pathname}`

    // Title
    document.title = fullTitle

    // Helper — get-or-create a meta tag
    function setMeta(selector: string, attr: string, value: string) {
      let el = document.head.querySelector<HTMLMetaElement>(selector)
      if (!el) {
        el = document.createElement('meta')
        const parts = selector.match(/\[(.+?)="(.+?)"\]/)
        if (parts) el.setAttribute(parts[1], parts[2])
        document.head.appendChild(el)
      }
      el.setAttribute(attr, value)
    }

    // Helper — get-or-create a link tag
    function setLink(rel: string, href: string) {
      let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
      if (!el) {
        el = document.createElement('link')
        el.setAttribute('rel', rel)
        document.head.appendChild(el)
      }
      el.setAttribute('href', href)
    }

    setMeta('meta[name="description"]', 'content', description)
    setMeta('meta[name="robots"]', 'content', robots)
    setLink('canonical', canonical)

    // Open Graph
    setMeta('meta[property="og:title"]', 'content', fullTitle)
    setMeta('meta[property="og:description"]', 'content', description)
    setMeta('meta[property="og:url"]', 'content', canonical)
    setMeta('meta[property="og:type"]', 'content', ogType)
    setMeta('meta[property="og:image"]', 'content', ogImage)

    // Twitter / X
    setMeta('meta[name="twitter:title"]', 'content', fullTitle)
    setMeta('meta[name="twitter:description"]', 'content', description)
    setMeta('meta[name="twitter:image"]', 'content', ogImage)
  }, [title, description, canonicalPath, suppressSuffix, ogImage, ogType, robots])
}
