import type { PaymentProvider } from './payments'

export type CheckoutStep = 'menu' | 'cart' | 'details' | 'pay' | 'waiting' | 'done'

/** How long a draft cart survives after last edit (guest closes phone / tab). */
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

export interface CheckoutDraft {
  cart: Record<string, number>
  customerName: string
  customerLocation: string
  customerNote: string
  provider: PaymentProvider
  phone: string
  saveNumber: boolean
  step?: CheckoutStep
  /** Epoch ms — used to expire abandoned drafts. */
  updatedAt?: number
}

function storageKey(businessId: string) {
  return `scanny-checkout:${businessId}`
}

function readRaw(key: string): string | null {
  try {
    const fromLocal = localStorage.getItem(key)
    if (fromLocal) return fromLocal
    // Migrate same-tab drafts saved before localStorage switch.
    const fromSession = sessionStorage.getItem(key)
    if (fromSession) {
      try {
        localStorage.setItem(key, fromSession)
        sessionStorage.removeItem(key)
      } catch {
        // keep session copy readable this load
      }
      return fromSession
    }
  } catch {
    // private mode / blocked storage
  }
  return null
}

function writeRaw(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
    try {
      sessionStorage.removeItem(key)
    } catch {
      // ignore
    }
  } catch {
    // ignore quota / private mode
  }
}

function removeRaw(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function isExpired(updatedAt?: number): boolean {
  if (!updatedAt || !Number.isFinite(updatedAt)) return false
  return Date.now() - updatedAt > DRAFT_TTL_MS
}

export function loadCheckoutDraft(businessId: string): CheckoutDraft | null {
  try {
    const raw = readRaw(storageKey(businessId))
    if (!raw) return null
    const draft = JSON.parse(raw) as CheckoutDraft
    if (isExpired(draft.updatedAt)) {
      removeRaw(storageKey(businessId))
      return null
    }
    return draft
  } catch {
    return null
  }
}

export function saveCheckoutDraft(businessId: string, draft: CheckoutDraft) {
  writeRaw(
    storageKey(businessId),
    JSON.stringify({
      ...draft,
      updatedAt: Date.now(),
    } satisfies CheckoutDraft),
  )
}

export function clearCheckoutDraft(businessId: string) {
  removeRaw(storageKey(businessId))
}

export interface ActiveOrderTracking {
  publicId: string
  orderId: string
  phone: string
  updatedAt?: number
}

function activeOrderKey(businessId: string) {
  return `scanny-active-order:${businessId}`
}

export function loadActiveOrder(businessId: string): ActiveOrderTracking | null {
  try {
    const raw = readRaw(activeOrderKey(businessId))
    if (!raw) return null
    const tracking = JSON.parse(raw) as ActiveOrderTracking
    if (isExpired(tracking.updatedAt)) {
      removeRaw(activeOrderKey(businessId))
      return null
    }
    return tracking
  } catch {
    return null
  }
}

export function saveActiveOrder(businessId: string, tracking: ActiveOrderTracking) {
  writeRaw(
    activeOrderKey(businessId),
    JSON.stringify({
      ...tracking,
      updatedAt: Date.now(),
    } satisfies ActiveOrderTracking),
  )
}

export function clearActiveOrder(businessId: string) {
  removeRaw(activeOrderKey(businessId))
}
