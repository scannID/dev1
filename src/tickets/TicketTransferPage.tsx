import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, Clock, Gift, ShieldAlert, Sparkles, UserCheck } from 'lucide-react'
import { publicTicketsApi } from '../api/services'
import type { TransferInfoResponse } from '../api/types'
import { MoMoPhoneInput } from '../components/MoMoPhoneInput'
import { DanceLoader } from '../components/DanceLoader'
import './TicketTransferPage.css'

interface Props {
  transferToken: string
}

export default function TicketTransferPage({ transferToken }: Props) {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<TransferInfoResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    publicTicketsApi
      .getTransferInfo(transferToken)
      .then((data) => {
        if (cancelled) return
        setInfo(data)
        if (!data.valid) {
          setError(data.message || 'This transfer link is no longer valid.')
        }
      })
      .catch((err: any) => {
        if (cancelled) return
        setError(err.message || 'Could not load transfer details.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [transferToken])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipientName.trim()) {
      setSubmitError('Please enter your full name.')
      return
    }
    if (!recipientPhone.trim() || recipientPhone.trim().length < 9) {
      setSubmitError('Please enter a valid phone number.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const response = await publicTicketsApi.acceptTransfer({
        transferToken,
        newHolderName: recipientName.trim(),
        newHolderPhone: recipientPhone.trim(),
        newHolderEmail: recipientEmail.trim() || undefined,
      })

      if (response.viewUrl) {
        window.location.href = response.viewUrl
      } else {
        window.location.reload()
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Transfer failed. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="xfr-page">
        <DanceLoader label="Loading ticket transfer…" />
      </div>
    )
  }

  if (error || !info || !info.valid) {
    return (
      <div className="xfr-page">
        <div className="xfr-card">
          <div className="xfr-badge-row">
            <span className="xfr-pill xfr-pill-invalid">
              <ShieldAlert size={14} />
              Transfer Unavailable
            </span>
          </div>
          <div className="xfr-header">
            <h1 className="xfr-title">Transfer Link Expired</h1>
            <p className="xfr-subtitle">
              {error || 'This transfer link has either expired, already been claimed, or was revoked.'}
            </p>
          </div>
          <button
            type="button"
            className="xfr-btn-submit"
            onClick={() => {
              window.location.href = '/'
            }}
          >
            Go to Homepage
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="xfr-page">
      <div className="xfr-card">
        <div className="xfr-badge-row">
          <span className="xfr-pill">
            <Gift size={14} />
            Ticket Gift / Transfer
          </span>
          {info.ticketType ? (
            <span className="xfr-pill">
              <Sparkles size={14} />
              {info.ticketType}
            </span>
          ) : null}
        </div>

        <div className="xfr-header">
          <p className="xfr-kicker">You've been sent a ticket</p>
          <h1 className="xfr-title">{info.eventName}</h1>
          {info.eventDate ? (
            <p className="xfr-subtitle">
              <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              {new Date(info.eventDate).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          ) : null}
        </div>

        {info.originalHolderName ? (
          <div className="xfr-sender-box">
            <div className="xfr-sender-icon">
              <UserCheck size={20} />
            </div>
            <div className="xfr-sender-details">
              <span className="xfr-sender-label">Transferred by</span>
              <span className="xfr-sender-name">{info.originalHolderName}</span>
            </div>
          </div>
        ) : null}

        <form className="xfr-form" onSubmit={handleSubmit}>
          {submitError ? <div className="xfr-error">{submitError}</div> : null}

          <div className="xfr-field">
            <label className="xfr-label" htmlFor="xfr-name">
              Your Full Name (matches your ID at the gate)
            </label>
            <input
              id="xfr-name"
              type="text"
              required
              className="xfr-input"
              placeholder="e.g. Sarah Namubiru"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="xfr-field">
            <label className="xfr-label">Your WhatsApp Phone Number</label>
            <MoMoPhoneInput
              value={recipientPhone}
              onChange={setRecipientPhone}
              disabled={submitting}
              placeholder="700 000 000"
            />
          </div>

          <div className="xfr-field">
            <label className="xfr-label" htmlFor="xfr-email">
              Email (Optional — for ticket backup)
            </label>
            <input
              id="xfr-email"
              type="email"
              className="xfr-input"
              placeholder="sarah@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button type="submit" className="xfr-btn-submit" disabled={submitting}>
            {submitting ? (
              'Claiming Ticket…'
            ) : (
              <>
                <span>Accept & Claim Ticket</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <p className="xfr-footer-note">
            Your new entry pass will be generated instantly and sent to your WhatsApp.
          </p>
        </form>
      </div>
    </div>
  )
}
