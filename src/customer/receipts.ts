import type { PaymentProvider } from './payments'
import { SERVICE_FEE_UGX } from './utils'

export interface CustomerReceiptItem {
  itemId?: string
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
  removedIngredients?: string[]
}

export interface CustomerReceipt {
  id: string
  orderId: string
  businessId: string
  businessName: string
  businessLogoUrl?: string | null
  customerName: string
  customerPhone: string
  items: CustomerReceiptItem[]
  subtotal: number
  serviceFee: number
  total: number
  currency: 'UGX'
  paymentMethod: string
  paymentProvider: PaymentProvider
  paymentReference?: string | null
  paidAt: string
}

const STORAGE_KEY = 'scanny-receipts'
const MAX_RECEIPTS = 100

function readAll(): CustomerReceipt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomerReceipt[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(receipts: CustomerReceipt[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts.slice(0, MAX_RECEIPTS)))
  } catch {
    // ignore quota / private mode
  }
}

export function loadReceipts(): CustomerReceipt[] {
  return readAll().sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
  )
}

export function getReceiptCount(): number {
  return readAll().length
}

export function saveReceipt(receipt: CustomerReceipt): CustomerReceipt[] {
  const existing = readAll()
  if (existing.some((entry) => entry.orderId === receipt.orderId)) {
    return loadReceipts()
  }
  const next = [receipt, ...existing].slice(0, MAX_RECEIPTS)
  writeAll(next)
  return next
}

export function buildReceipt(input: {
  orderId: string
  businessId: string
  businessName: string
  businessLogoUrl?: string | null
  customerName: string
  customerPhone: string
  items: Array<{
    itemId?: string
    name: string
    quantity: number
    price: number
    removedIngredients?: string[]
  }>
  total: number
  provider: PaymentProvider
  paymentReference?: string | null
}): CustomerReceipt {
  const receiptItems: CustomerReceiptItem[] = input.items.map((item) => ({
    itemId: item.itemId,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    lineTotal: item.price * item.quantity,
    removedIngredients: item.removedIngredients,
  }))
  const subtotal = receiptItems.reduce((sum, item) => sum + item.lineTotal, 0)
  const serviceFee = subtotal > 0 ? SERVICE_FEE_UGX : 0

  return {
    id: input.orderId,
    orderId: input.orderId,
    businessId: input.businessId,
    businessName: input.businessName,
    businessLogoUrl: input.businessLogoUrl,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    items: receiptItems,
    subtotal,
    serviceFee,
    total: Math.max(input.total, subtotal + serviceFee),
    currency: 'UGX',
    paymentMethod: 'Mobile Money',
    paymentProvider: input.provider,
    paymentReference: input.paymentReference,
    paidAt: new Date().toISOString(),
  }
}

export function formatReceiptDate(iso: string) {
  return new Date(iso).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatReceiptDay(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
