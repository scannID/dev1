export const COOKIE_CONSENT_KEY = 'kode-cookie-consent'
const COOKIE_CONSENT_CLIENT_ID_KEY = 'kode-cookie-consent-client-id'

export type CookieConsentChoice = 'accepted' | 'essential'

export function getCookieConsent(): CookieConsentChoice | null {
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (value === 'accepted' || value === 'essential') return value
    return null
  } catch {
    return null
  }
}

export function hasCookieConsent(): boolean {
  return getCookieConsent() !== null
}

export function setCookieConsent(choice: CookieConsentChoice) {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice)
    localStorage.setItem(`${COOKIE_CONSENT_KEY}:at`, String(Date.now()))
  } catch {
    /* private mode / blocked storage */
  }
}

export function getCookieConsentClientId(): string {
  try {
    const existing = localStorage.getItem(COOKIE_CONSENT_CLIENT_ID_KEY)
    if (existing && existing.trim()) return existing
    const created = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `cc-${Date.now()}-${Math.random().toString(16).slice(2)}`
    localStorage.setItem(COOKIE_CONSENT_CLIENT_ID_KEY, created)
    return created
  } catch {
    return 'cc-unavailable'
  }
}
