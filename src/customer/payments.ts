/**
 * Customer payment adapter — delegates to the pluggable backend payment gateway.
 * Provider implementations live server-side; swap MTN/Airtel by configuring scanny.payments.*.
 */

import { paymentsApi } from '../api/services'
import type { PaymentIntentStatus } from '../api/types'

export type PaymentProvider = 'MTN' | 'Airtel'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED'

export interface InitiatePaymentInput {
  orderId: string
  provider: PaymentProvider
  phone: string
  amount: number
  businessId: string
  customerName?: string
}

export interface InitiateSplitPaymentInput {
  splitId: string
  provider: PaymentProvider
  phone: string
  amount: number
  businessId: string
  customerName?: string
}

export interface PaymentResult {
  paymentId: string
  status: PaymentStatus
}

function mapStatus(status: PaymentIntentStatus): PaymentStatus {
  if (status === 'Paid') return 'PAID'
  if (status === 'Failed' || status === 'Cancelled') return 'FAILED'
  return 'PENDING'
}

export const payments = {
  async initiate(input: InitiatePaymentInput): Promise<PaymentResult> {
    const response = await paymentsApi.initiate({
      context: 'ORDER',
      referenceId: input.orderId,
      provider: input.provider,
      amount: input.amount,
      currency: 'UGX',
      customerPhone: input.phone,
      customerName: input.customerName,
      businessId: input.businessId,
    })
    return {
      paymentId: response.paymentId,
      status: mapStatus(response.status),
    }
  },

  async initiateSplit(input: InitiateSplitPaymentInput): Promise<PaymentResult> {
    const response = await paymentsApi.initiate({
      context: 'ORDER_SPLIT',
      referenceId: input.splitId,
      provider: input.provider,
      amount: input.amount,
      currency: 'UGX',
      customerPhone: input.phone,
      customerName: input.customerName,
      businessId: input.businessId,
    })
    return {
      paymentId: response.paymentId,
      status: mapStatus(response.status),
    }
  },

  async status(paymentId: string): Promise<{ status: PaymentStatus }> {
    const response = await paymentsApi.status(paymentId)
    return { status: mapStatus(response.status) }
  },
}
