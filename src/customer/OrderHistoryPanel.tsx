import { useState } from 'react'
import { toast } from 'sonner'
import { operationsApi } from '../api/operations'
import { currency } from './utils'

const SESSION_KEY = 'kodte:customer-history-session'

type HistoryOrder = {
  publicId: string
  businessName: string
  total: number
  status: string
  createdAt: string
}

export function OrderHistoryPanel({
  initialPhone = '',
  onClose,
}: {
  initialPhone?: string
  onClose: () => void
}) {
  const [phone, setPhone] = useState(initialPhone)
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [orders, setOrders] = useState<HistoryOrder[]>([])
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || '')
  const [busy, setBusy] = useState(false)

  function validateLocalPhone(value: string) {
    const digits = value.replace(/\D/g, '')
    if (!/^0[67]\d{8}$/.test(digits)) {
      return 'Use a UG number that starts with 0 (07XXXXXXXX)'
    }
    return null
  }

  async function requestCode() {
    if (!phone.trim()) {
      toast.error('Enter your phone number')
      return
    }
    const phoneError = validateLocalPhone(phone)
    if (phoneError) {
      toast.error(phoneError)
      return
    }
    const normalizedPhone = phone.replace(/\D/g, '')
    setBusy(true)
    try {
      await operationsApi.requestHistoryCode(normalizedPhone)
      setCodeSent(true)
      toast.success('Verification code sent')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send code')
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    const phoneError = validateLocalPhone(phone)
    if (phoneError) {
      toast.error(phoneError)
      return
    }
    const normalizedPhone = phone.replace(/\D/g, '')
    setBusy(true)
    try {
      const result = await operationsApi.verifyHistory(normalizedPhone, code.trim())
      sessionStorage.setItem(SESSION_KEY, result.sessionToken)
      setSessionToken(result.sessionToken)
      setOrders(result.orders)
      toast.success('History unlocked')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setBusy(false)
    }
  }

  async function refresh() {
    if (!sessionToken) return
    setBusy(true)
    try {
      const result = await operationsApi.listHistory(sessionToken)
      setOrders(result.orders)
      setSessionToken(result.sessionToken)
      sessionStorage.setItem(SESSION_KEY, result.sessionToken)
    } catch (err) {
      sessionStorage.removeItem(SESSION_KEY)
      setSessionToken('')
      setOrders([])
      toast.error(err instanceof Error ? err.message : 'Session expired')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="customer-overlay">
      <div className="customer-overlay-card">
        <div className="customer-overlay-header">
          <h2>Order history</h2>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </div>

        {!sessionToken ? (
          <div className="history-form">
            <label>
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" />
            </label>
            {codeSent ? (
              <label>
                Code
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="1234" />
              </label>
            ) : null}
            <div className="history-actions">
              {!codeSent ? (
                <button type="button" disabled={busy} onClick={() => void requestCode()}>
                  Send code
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => void verify()}>
                  Verify
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="history-list">
            <button type="button" className="customer-secondary-btn" disabled={busy} onClick={() => void refresh()}>
              Refresh
            </button>
            <ul>
              {orders.map((order) => (
                <li key={order.publicId}>
                  <strong>{order.businessName}</strong>
                  <span> · {currency(order.total)} · {order.status}</span>
                  <div className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
              {orders.length === 0 ? <li>No recent orders for this phone.</li> : null}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
