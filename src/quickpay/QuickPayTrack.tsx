import { type FormEvent, useEffect, useState } from 'react'
import { quickPaymentsApi } from '../api/services'
import type { QuickPayTrackingMetrics, QuickPaymentTransaction } from '../api/types'

export const DEMO_TRACKING_NUMBER = 'TRK-DEMO2026'

function money(amount: number, currency: string) {
  return `${amount.toLocaleString()} ${currency}`
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function buildDemoMetrics(): QuickPayTrackingMetrics {
  const amount = 5000
  const currency = 'UGX'
  const recentTransactions: QuickPaymentTransaction[] = [
    {
      id: 1,
      codeId: 'QPC-DEMO01',
      transactionRef: 'TXN-DEMO-88421A1F',
      amount,
      currency,
      customerPhone: '+256700441122',
      customerName: 'Amina N.',
      paymentMethod: 'MobileMoney',
      paymentProvider: 'MTN',
      status: 'Completed',
      deviceInfo: null,
      location: 'Parking Lot A',
      createdAt: hoursAgo(2),
      completedAt: hoursAgo(2),
      failedAt: null,
      failureReason: null,
    },
    {
      id: 2,
      codeId: 'QPC-DEMO01',
      transactionRef: 'TXN-DEMO-91C0B3E2',
      amount,
      currency,
      customerPhone: '+256772889900',
      customerName: 'Joseph K.',
      paymentMethod: 'MobileMoney',
      paymentProvider: 'Airtel',
      status: 'Completed',
      deviceInfo: null,
      location: 'Parking Lot A',
      createdAt: hoursAgo(5),
      completedAt: hoursAgo(5),
      failedAt: null,
      failureReason: null,
    },
    {
      id: 3,
      codeId: 'QPC-DEMO01',
      transactionRef: 'TXN-DEMO-55AA109C',
      amount,
      currency,
      customerPhone: '+256701223344',
      customerName: 'Grace M.',
      paymentMethod: 'MobileMoney',
      paymentProvider: 'MTN',
      status: 'Pending',
      deviceInfo: null,
      location: '',
      createdAt: hoursAgo(1),
      completedAt: null,
      failedAt: null,
      failureReason: null,
    },
    {
      id: 4,
      codeId: 'QPC-DEMO01',
      transactionRef: 'TXN-DEMO-12FE77D0',
      amount,
      currency,
      customerPhone: '+256756110022',
      customerName: 'Paul O.',
      paymentMethod: 'MobileMoney',
      paymentProvider: 'MTN',
      status: 'Completed',
      deviceInfo: null,
      location: 'Gate 2',
      createdAt: hoursAgo(26),
      completedAt: hoursAgo(26),
      failedAt: null,
      failureReason: null,
    },
    {
      id: 5,
      codeId: 'QPC-DEMO01',
      transactionRef: 'TXN-DEMO-0B9911AA',
      amount,
      currency,
      customerPhone: '+256700998877',
      customerName: 'Sarah T.',
      paymentMethod: 'MobileMoney',
      paymentProvider: 'Airtel',
      status: 'Failed',
      deviceInfo: null,
      location: '',
      createdAt: hoursAgo(30),
      completedAt: null,
      failedAt: hoursAgo(30),
      failureReason: 'Insufficient balance',
    },
    {
      id: 6,
      codeId: 'QPC-DEMO01',
      transactionRef: 'TXN-DEMO-77CC4401',
      amount,
      currency,
      customerPhone: '+256781334455',
      customerName: 'David W.',
      paymentMethod: 'MobileMoney',
      paymentProvider: 'MTN',
      status: 'Completed',
      deviceInfo: null,
      location: 'Parking Lot A',
      createdAt: hoursAgo(48),
      completedAt: hoursAgo(48),
      failedAt: null,
      failureReason: null,
    },
  ]

  const completedPayments = recentTransactions.filter((t) => t.status === 'Completed').length
  const pendingPayments = recentTransactions.filter((t) => t.status === 'Pending').length
  const failedPayments = recentTransactions.filter((t) => t.status === 'Failed').length

  return {
    trackingNumber: DEMO_TRACKING_NUMBER,
    id: 'QPC-DEMO01',
    description: 'Parking — 2 hours',
    amount,
    currency,
    status: 'Active',
    usageCount: completedPayments,
    completedPayments,
    pendingPayments,
    failedPayments,
    totalCollected: completedPayments * amount,
    ownerName: 'Kampala Lot Owner',
    ownerEmail: 'owner@example.com',
    paymentDestination: '+256700111222',
    paymentDestinationType: 'MobileMoney',
    qrCodeUrl: `${window.location.origin}/pay/demo-parking-token`,
    trackUrl: `${window.location.origin}/track/${DEMO_TRACKING_NUMBER}`,
    createdAt: hoursAgo(120),
    lastUsedAt: hoursAgo(1),
    recentTransactions,
  }
}

type Props = {
  trackingNumber: string
  onBack: () => void
}

export default function QuickPayTrack({ trackingNumber: initial, onBack }: Props) {
  const [input, setInput] = useState(initial || DEMO_TRACKING_NUMBER)
  const [metrics, setMetrics] = useState<QuickPayTrackingMetrics | null>(null)
  const [isDemo, setIsDemo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(number: string) {
    const trimmed = number.trim().toUpperCase()
    if (!trimmed) {
      setError('Enter your tracking number')
      return
    }

    if (trimmed === DEMO_TRACKING_NUMBER) {
      setLoading(true)
      setError(null)
      const demo = buildDemoMetrics()
      setMetrics(demo)
      setIsDemo(true)
      setInput(demo.trackingNumber)
      window.history.replaceState({}, '', `/track/${encodeURIComponent(demo.trackingNumber)}`)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      setIsDemo(false)
      const data = await quickPaymentsApi.track(trimmed)
      setMetrics(data)
      setInput(data.trackingNumber)
      window.history.replaceState({}, '', `/track/${encodeURIComponent(data.trackingNumber)}`)
    } catch (err) {
      setMetrics(null)
      setError(err instanceof Error ? err.message : 'Could not load metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(initial || DEMO_TRACKING_NUMBER).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    load(input).catch(() => undefined)
  }

  return (
    <div className="scanny-page">
      <div className="scanny-page-wide">
        <button type="button" onClick={onBack} className="scanny-back">← Back to home</button>
        <div className="scanny-card">
          <p className="scanny-eyebrow">Payment QR metrics</p>
          <h1 className="scanny-title">Track with your number</h1>
          <p className="scanny-sub">
            Use the tracking number from your email or the create screen. Preview sample data with{' '}
            <button type="button" className="scanny-link-btn" onClick={() => load(DEMO_TRACKING_NUMBER)}>
              {DEMO_TRACKING_NUMBER}
            </button>
            .
          </p>

          <form onSubmit={handleSubmit} className="scanny-form" style={{ marginTop: 20, gridTemplateColumns: '1fr auto', alignItems: 'start' }}>
            <input
              className="scanny-input scanny-mono"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              placeholder="TRK-XXXXXXXX"
              spellCheck={false}
            />
            <button type="submit" disabled={loading} className="scanny-btn scanny-btn-primary">
              {loading ? 'Loading…' : 'Look up'}
            </button>
          </form>
          {error ? <p className="scanny-error" role="alert" style={{ marginTop: 12 }}>{error}</p> : null}

          {metrics ? (
            <div style={{ marginTop: 28 }}>
              {isDemo ? <p className="scanny-badge">Demo preview — sample parking QR metrics</p> : null}
              <h2 className="scanny-title" style={{ fontSize: 20 }}>{metrics.description}</h2>
              <p className="scanny-sub" style={{ marginTop: 6, fontSize: 14 }}>
                {money(metrics.amount, metrics.currency)} · {metrics.status} · {metrics.trackingNumber}
              </p>

              <div className="scanny-stat-grid">
                <div className="scanny-stat">
                  <p className="scanny-stat-label">Completed</p>
                  <p className="scanny-stat-value">{metrics.completedPayments}</p>
                </div>
                <div className="scanny-stat">
                  <p className="scanny-stat-label">Collected</p>
                  <p className="scanny-stat-value">{money(metrics.totalCollected, metrics.currency)}</p>
                </div>
                <div className="scanny-stat">
                  <p className="scanny-stat-label">Pending</p>
                  <p className="scanny-stat-value">{metrics.pendingPayments}</p>
                </div>
                <div className="scanny-stat">
                  <p className="scanny-stat-label">Failed</p>
                  <p className="scanny-stat-value">{metrics.failedPayments}</p>
                </div>
              </div>

              <p className="scanny-hint" style={{ marginTop: 18 }}>
                Pays to {metrics.paymentDestination} · Owner {metrics.ownerName} ({metrics.ownerEmail})
              </p>
              {!isDemo ? (
                <p style={{ margin: '6px 0 0', fontSize: 13 }}>
                  <a href={metrics.qrCodeUrl} className="scanny-link">Customer pay link</a>
                </p>
              ) : null}

              <h3 style={{ margin: '24px 0 10px', fontSize: 15, fontWeight: 700 }}>Recent payments</h3>
              {metrics.recentTransactions.length === 0 ? (
                <p className="scanny-hint">No payments yet. Share your QR to get started.</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {metrics.recentTransactions.map((tx) => (
                    <div key={tx.transactionRef} className="scanny-list-row">
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
                          {tx.customerName || 'Customer'} · {tx.customerPhone || '—'}
                        </p>
                        <p className="scanny-hint scanny-mono" style={{ marginTop: 4, fontSize: 12 }}>
                          {tx.transactionRef}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{money(tx.amount, tx.currency)}</p>
                        <p className="scanny-hint" style={{ marginTop: 4, fontSize: 12 }}>{tx.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
