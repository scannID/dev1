import { type FormEvent, useEffect, useState } from 'react'
import { publicTicketsApi } from '../api/services'
import type { GateScanResponse } from '../api/types'

type Props = { gateToken: string }

export default function TicketGatePage({ gateToken }: Props) {
  const [eventName, setEventName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<GateScanResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    publicTicketsApi
      .getGateEvent(gateToken)
      .then((e) => setEventName(e.eventName))
      .catch(() => setError('Invalid gate link'))
      .finally(() => setLoading(false))
  }, [gateToken])

  async function handleScan(e: FormEvent) {
    e.preventDefault()
    const qrToken = code.trim()
    if (!qrToken) return
    try {
      setScanning(true)
      setError(null)
      const res = await publicTicketsApi.gateScan(gateToken, qrToken)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
      setResult(null)
    } finally {
      setScanning(false)
    }
  }

  if (loading) {
    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <p className="scanny-hint" style={{ textAlign: 'center' }}>Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="scanny-page">
      <div className="scanny-page-narrow">
        <div className="scanny-card">
          <p className="scanny-eyebrow">Gate check</p>
          <h1 className="scanny-title">{eventName || 'Event'}</h1>
          <p className="scanny-sub">Paste the code from the attendee&apos;s ticket QR. No login needed.</p>

          <form onSubmit={handleScan} className="scanny-form">
            <label className="scanny-field">
              <span className="scanny-label">Ticket code</span>
              <input
                className="scanny-input scanny-mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste from QR scan…"
                autoComplete="off"
              />
            </label>
            <button type="submit" disabled={scanning} className="scanny-btn scanny-btn-primary">
              {scanning ? 'Checking…' : 'Check ticket'}
            </button>
          </form>

          {error ? <p className="scanny-error" role="alert" style={{ marginTop: 16 }}>{error}</p> : null}

          {result ? (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 12,
                background: result.valid ? 'color-mix(in srgb, var(--primary) 20%, var(--card))' : 'color-mix(in srgb, var(--destructive) 15%, var(--card))',
                border: `1px solid ${result.valid ? 'var(--primary)' : 'var(--destructive)'}`,
              }}
            >
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
                {result.valid ? '✓ Admitted' : '✗ Denied'}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 15 }}>{result.message}</p>
              {result.holderName ? (
                <p style={{ margin: '12px 0 0', fontSize: 14 }}>
                  <strong>{result.holderName}</strong> · {result.ticketType}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
