/**
 * TicketTransferAcceptPage
 *
 * Route: /ticket/transfer/:transferToken
 *
 * The recipient of a ticket transfer lands here. The page:
 * 1. Loads transfer info (event name, type, original holder) via GET /transfer/:token
 * 2. Shows a form for the recipient to enter their name + WhatsApp number
 * 3. POSTs to /transfer/accept — backend rotates the access token and delivers
 *    the new ticket via WhatsApp
 * 4. Redirects to the new ticket view URL on success
 */

import { type FormEvent, useEffect, useState } from 'react'
import { publicTicketsApi } from '../api/services'
import type { TransferInfoResponse } from '../api/types'
import { KodeMark } from '../customer/KodeMark'
import { MusicInstrumentLoader } from './MusicInstrumentLoader'
import { MoMoPhoneInput } from '../components/MoMoPhoneInput'
import '../components/MoMoPhoneInput.css'
import './TicketCustomer.css'

type Props = { transferToken: string }

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return null
  }
}

function formatExpiry(iso: string | null | undefined) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}

export default function TicketTransferAcceptPage({ transferToken }: Props) {
  const [info, setInfo]           = useState<TransferInfoResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone]           = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('tk-app')
    document.body.classList.add('tk-app')
    return () => {
      document.documentElement.classList.remove('tk-app')
      document.body.classList.remove('tk-app')
    }
  }, [])

  // Load transfer info
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const data = await publicTicketsApi.getTransferInfo(transferToken)
        if (!cancelled) setInfo(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Invalid transfer link')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [transferToken])

  async function handleAccept(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setSubmitError('Your name is required'); return }
    if (!phone.trim() || phone === '0') { setSubmitError('Your WhatsApp number is required'); return }
    try {
      setSubmitting(true)
      setSubmitError(null)
      const res = await publicTicketsApi.acceptTransfer({
        transferToken,
        newHolderName: name.trim(),
        newHolderPhone: phone.trim(),
      })
      setDone(true)
      // Give the user a moment to see the success screen then redirect
      setTimeout(() => {
        window.location.href = res.viewUrl
      }, 2200)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not accept transfer. The link may have expired.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="tk-shell tk-centered tk-boot">
        <MusicInstrumentLoader />
      </div>
    )
  }

  // ── Error / invalid link ──────────────────────────────────────────────────────
  if (error || !info) {
    return (
      <div className="tk-shell tk-centered">
        <div className="tk-panel tk-empty tk-enter">
          <p className="tk-hero-kicker">Kode</p>
          <h2>Invalid transfer link</h2>
          <p className="tk-error" role="alert" style={{ textAlign: 'left' }}>
            {error ?? 'This transfer link is not valid.'}
          </p>
        </div>
      </div>
    )
  }

  // ── Expired or revoked ────────────────────────────────────────────────────────
  if (!info.valid) {
    return (
      <div className="tk-shell tk-centered">
        <div className="tk-panel tk-empty tk-enter">
          <p className="tk-hero-kicker">Kode</p>
          <h2>Transfer unavailable</h2>
          <p className="tk-muted-note" style={{ marginTop: 8, lineHeight: 1.6 }}>
            {info.message ?? 'This transfer link has expired or has already been used.'}
          </p>
        </div>
      </div>
    )
  }

  const dateLabel = formatDate(info.eventDate)
  const expiryLabel = formatExpiry(info.expiresAt)

  // ── Success ───────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="tk-shell tk-centered">
        <div className="tk-panel tk-enter" style={{ textAlign: 'center', gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--tk-ok)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12l5 5L20 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Ticket transferred!</h2>
          <p className="tk-hint" style={{ margin: 0 }}>
            Your ticket for <strong>{info.eventName}</strong> is on its way to your WhatsApp. Redirecting…
          </p>
        </div>
      </div>
    )
  }

  // ── Accept form ───────────────────────────────────────────────────────────────
  return (
    <div className="tk-shell">
      <header className="tk-topbar">
        <div className="tk-brand">
          <KodeMark size={28} />
          <div>
            <strong>Kode</strong>
            <span>Ticket transfer</span>
          </div>
        </div>
      </header>

      <main className="tk-main">
        {/* Event summary card */}
        <header className="tk-hero tk-enter">
          <p className="tk-hero-kicker">You've been sent a ticket</p>
          <h1>{info.eventName}</h1>
          <p className="tk-hero-meta">
            {[info.ticketType, dateLabel].filter(Boolean).join(' · ')}
          </p>
        </header>

        <div className="tk-panel tk-enter" style={{ gap: 6, padding: '14px 18px' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--tk-muted)' }}>
            Transferred from <strong style={{ color: 'var(--tk-text)' }}>{info.originalHolderName}</strong>
          </p>
          {expiryLabel ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--tk-muted)' }}>
              Link expires {expiryLabel}
            </p>
          ) : null}
        </div>

        <form onSubmit={handleAccept} className="tk-panel tk-enter" noValidate>
          <p className="tk-section-label" style={{ marginBottom: 14 }}>Your details</p>

          <div className="tk-fields">
            <label className="tk-field">
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Okello"
                autoComplete="name"
                required
                disabled={submitting}
              />
            </label>

            <label className="tk-field" htmlFor="xfr-phone">
              WhatsApp number
              <MoMoPhoneInput
                id="xfr-phone"
                value={phone}
                onChange={setPhone}
                placeholder="07XX XXX XXX"
                required
                disabled={submitting}
              />
              <p className="tk-hint">
                Your new ticket and entry QR will be delivered here via WhatsApp.
              </p>
            </label>
          </div>

          {submitError ? (
            <div className="tk-error" role="alert">{submitError}</div>
          ) : null}

          <button
            type="submit"
            className="tk-cta"
            disabled={submitting || !name.trim() || phone === '0'}
          >
            {submitting ? 'Accepting transfer…' : 'Accept ticket →'}
          </button>

          <p className="tk-trust-note">
            Accepting this transfer will invalidate the original holder's pass.
          </p>
        </form>
      </main>
    </div>
  )
}
