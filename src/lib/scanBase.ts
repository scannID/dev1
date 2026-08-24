/** Prefer LAN scan base so phone QRs work even if the UI is open on localhost. */
export function scanBaseOrigin(): string {
  const configured = String(import.meta.env.VITE_SCAN_BASE_URL || '').replace(/\/$/, '')

  // If running in a browser, prefer the actual window origin whenever it is
  // non-local. This means a ticket created on LAN A opens correctly on LAN B
  // because the URL resolves against whichever host is currently serving the app.
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return window.location.origin
    }
  }

  // Localhost fallback: use VITE_SCAN_BASE_URL if it points somewhere non-local.
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) {
    return configured
  }

  return configured || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
}

/** Returns true for any hostname that is LAN-local or loopback. */
function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    // private IPv4 ranges: 10.x, 172.16-31.x, 192.168.x
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname) ||
    /^192\.168\.\d+\.\d+$/.test(hostname)
  )
}

/** Paid ticket QR must be a phone-openable gate URL (never a hardcoded LAN IP). */
export function buildTicketGateUrl(qrPayload: string): string {
  const payload = qrPayload.trim()
  if (!payload) return `${scanBaseOrigin()}/ticket/gate`
  if (payload.startsWith('http://') || payload.startsWith('https://')) {
    try {
      const parsed = new URL(payload)
      // Always rewrite LAN/local IPs so the URL works regardless of which
      // network the viewer is on — same behaviour as the restaurant QR.
      if (isLocalHostname(parsed.hostname)) {
        return `${scanBaseOrigin()}${parsed.pathname}${parsed.search}${parsed.hash}`
      }
      return payload
    } catch {
      // fall through
    }
  }
  return `${scanBaseOrigin()}/ticket/gate?p=${encodeURIComponent(payload)}`
}

/** Event manager QR opens gate setup with event prefilled (must still start session). */
export function buildEventManagerGateUrl(eventId: string): string {
  const normalized = eventId.trim().replace(/^#/, '').toUpperCase()
  if (!normalized) return `${scanBaseOrigin()}/ticket/gate`
  return `${scanBaseOrigin()}/ticket/gate?eventId=${encodeURIComponent(normalized)}`
}
