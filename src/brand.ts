/** Public product brand — keep distinct from internal package/client ids (scanny-*). */
export const APP_NAME = 'Kodte'

/** Public apex domain for marketing copy and ticket footers until VITE_SCAN_BASE_URL is set. */
export const APP_DOMAIN_FALLBACK = 'kodte.com'

export function appDomain(): string {
  const base = import.meta.env.VITE_SCAN_BASE_URL as string | undefined
  if (base) {
    try {
      return new URL(base).host
    } catch {
      /* ignore */
    }
  }
  return APP_DOMAIN_FALLBACK
}

export function appOrigin(): string {
  const base = import.meta.env.VITE_SCAN_BASE_URL as string | undefined
  if (base) return base.replace(/\/$/, '')
  return `https://${APP_DOMAIN_FALLBACK}`
}