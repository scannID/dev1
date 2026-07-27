const DEVICE_KEY = 'scanny-device-id'
let liveUgxPerUsd: number | null = null

/** Fallback when `/api/fees` has not loaded yet. Backend is source of truth. */
export const DEFAULT_SERVICE_FEE_UGX = 700

/** @deprecated Prefer fee from `/api/fees`. Kept as fallback for receipts/boot. */
export const SERVICE_FEE_UGX = DEFAULT_SERVICE_FEE_UGX

export function withServiceFee(subtotal: number, serviceFeeUgx: number = DEFAULT_SERVICE_FEE_UGX) {
  if (subtotal <= 0) return 0
  return subtotal + Math.max(0, serviceFeeUgx)
}

export function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function usdEquiv(amount: number): string | null {
  const ugxPerUsd = liveUgxPerUsd ?? Number(import.meta.env.VITE_UGX_PER_USD ?? '3700')
  if (!Number.isFinite(ugxPerUsd) || ugxPerUsd <= 0 || amount === 0) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / ugxPerUsd)
}

export function setLiveUgxPerUsd(rate: number | null) {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return
  liveUgxPerUsd = rate
}

/** Works on http://LAN-IP too — crypto.randomUUID is HTTPS/localhost-only. */
function newDeviceToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()
  }
  const bytes = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = `SCN-${newDeviceToken()}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'S'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function formatUgPhoneHint(value: string) {
  const digits = value.replace(/[^\d+]/g, '')
  return digits
}
