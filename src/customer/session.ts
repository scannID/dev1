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
