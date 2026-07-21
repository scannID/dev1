import type { PaymentProvider } from './payments'

export type CheckoutStep = 'menu' | 'cart' | 'details' | 'pay' | 'waiting' | 'done'

export interface CheckoutDraft {
  cart: Record<string, number>
  customerName: string
  customerLocation: string
  customerNote: string
  provider: PaymentProvider
  phone: string
  saveNumber: boolean
  step?: CheckoutStep
}

function storageKey(businessId: string) {
  return `scanny-checkout:${businessId}`
}

export function loadCheckoutDraft(businessId: string): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(storageKey(businessId))
    if (!raw) return null
    return JSON.parse(raw) as CheckoutDraft
  } catch {
    return null
  }
}

export function saveCheckoutDraft(businessId: string, draft: CheckoutDraft) {
  try {
    sessionStorage.setItem(storageKey(businessId), JSON.stringify(draft))
  } catch {
    // ignore quota / private mode
  }
}

export function clearCheckoutDraft(businessId: string) {
  try {
    sessionStorage.removeItem(storageKey(businessId))
  } catch {
    // ignore
  }
}

export interface ActiveOrderTracking {
  publicId: string
  orderId: string
  phone: string
}

function activeOrderKey(businessId: string) {
  return `scanny-active-order:${businessId}`
}

export function loadActiveOrder(businessId: string): ActiveOrderTracking | null {
  try {
    const raw = sessionStorage.getItem(activeOrderKey(businessId))
    if (!raw) return null
    return JSON.parse(raw) as ActiveOrderTracking
  } catch {
    return null
  }
}

export function saveActiveOrder(businessId: string, tracking: ActiveOrderTracking) {
  try {
    sessionStorage.setItem(activeOrderKey(businessId), JSON.stringify(tracking))
  } catch {
    // ignore
  }
}

export function clearActiveOrder(businessId: string) {
  try {
    sessionStorage.removeItem(activeOrderKey(businessId))
  } catch {
    // ignore
  }
}
