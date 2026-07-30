/** Prefer LAN scan base so phone QRs work even if the UI is open on localhost. */
export function scanBaseOrigin(): string {
  const configured = String(import.meta.env.VITE_SCAN_BASE_URL || '').replace(/\/$/, '')
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) {
    return configured
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return window.location.origin
    }
  }
  return configured || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
}

/** Paid ticket QR must be a phone-openable gate URL (never localhost). */
export function buildTicketGateUrl(qrPayload: string): string {
  const payload = qrPayload.trim()
  if (!payload) return `${scanBaseOrigin()}/ticket/gate`
  if (payload.startsWith('http://') || payload.startsWith('https://')) {
    try {
      const parsed = new URL(payload)
      if (/localhost|127\.0\.0\.1/i.test(parsed.hostname)) {
        return `${scanBaseOrigin()}${parsed.pathname}${parsed.search}${parsed.hash}`
      }
      return payload
    } catch {
      // fall through
    }
  }
  return `${scanBaseOrigin()}/ticket/gate?p=${encodeURIComponent(payload)}`
}
