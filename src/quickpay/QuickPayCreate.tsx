import { type FormEvent, type ReactNode, useState } from 'react'
import QRCode from 'qrcode'
import { quickPaymentsApi } from '../api/services'
import type { QuickPaymentCode } from '../api/types'

function money(amount: number, currency: string) {
  return `${amount.toLocaleString()} ${currency}`
}

type Props = {
  onBack: () => void
  onOpenTrack: (trackingNumber: string) => void
}

export default function QuickPayCreate({ onBack, onOpenTrack }: Props) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [paymentDestination, setPaymentDestination] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<QuickPaymentCode | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsedAmount = Number(amount.replace(/,/g, ''))
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid amount greater than zero.')
      return
    }
    try {
      setSubmitting(true)
      const code = await quickPaymentsApi.createPublic({
        description: description.trim(),
        amount: Math.round(parsedAmount),
        currency: 'UGX',
        ownerName: ownerName.trim(),
        ownerPhone: ownerPhone.trim() || undefined,
        ownerEmail: ownerEmail.trim(),
        paymentDestination: paymentDestination.trim(),
        paymentDestinationType: 'MobileMoney',
      })
      const dataUrl = await QRCode.toDataURL(code.qrCodeUrl, {
        color: { dark: '#0d1612', light: '#ffffff' },
        margin: 1,
        width: 280,
        errorCorrectionLevel: 'M',
      })
      setQrDataUrl(dataUrl)
      setCreated(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create payment QR')
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <button type="button" onClick={onBack} className="scanny-back">← Back to home</button>
          <div className="scanny-card">
            <p className="scanny-eyebrow">Your payment QR is ready</p>
            <h1 className="scanny-title">{created.description}</h1>
            <p className="scanny-sub">
              {money(created.amount, created.currency)} · pays to {created.paymentDestination}
            </p>

            <div className="scanny-qr-wrap">
              {qrDataUrl ? <img src={qrDataUrl} alt="Payment QR code" width={240} height={240} /> : null}
            </div>

            <div className="scanny-panel">
              <p className="scanny-stat-label">Tracking number</p>
              <p className="scanny-stat-value scanny-mono" style={{ fontSize: 22 }}>
                {created.trackingNumber}
              </p>
              <p className="scanny-hint" style={{ marginTop: 8 }}>
                Save this number to check payments later. No login needed.
              </p>
            </div>

            <p className={created.emailSent ? 'scanny-hint scanny-hint-ok' : 'scanny-error'} style={{ marginTop: 16 }}>
              {created.emailSent
                ? `Details sent to ${created.ownerEmail}`
                : `QR created. We could not send email to ${created.ownerEmail} — keep your tracking number.`}
            </p>

            <div className="scanny-actions">
              <button type="button" className="scanny-btn scanny-btn-primary" onClick={() => onOpenTrack(created.trackingNumber)}>
                View metrics
              </button>
              <a href={created.qrCodeUrl} className="scanny-btn scanny-btn-secondary">
                Open customer pay link
              </a>
              {qrDataUrl ? (
                <a href={qrDataUrl} download={`${created.trackingNumber}.png`} className="scanny-btn scanny-btn-secondary">
                  Download QR
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="scanny-page">
      <div className="scanny-page-narrow">
        <button type="button" onClick={onBack} className="scanny-back">← Back to home</button>
        <div className="scanny-card">
          <p className="scanny-eyebrow">No account needed</p>
          <h1 className="scanny-title">Create a payment QR</h1>
          <p className="scanny-sub">
            One fixed amount — parking, tips, entry fees, donations. Customers scan and pay; you track with a number emailed to you.
          </p>

          <form onSubmit={handleSubmit} className="scanny-form">
            <Field label="What is this for?" required>
              <input
                required
                className="scanny-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Parking — 2 hours"
                maxLength={255}
              />
            </Field>
            <Field label="Amount (UGX)" required>
              <input
                required
                className="scanny-input"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000"
              />
            </Field>
            <Field label="Your name" required>
              <input
                required
                className="scanny-input"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Jane Okello"
                maxLength={255}
              />
            </Field>
            <Field label="Email (QR details + tracking number)" required>
              <input
                required
                type="email"
                className="scanny-input"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={255}
              />
            </Field>
            <Field label="Mobile money number (where money goes)" required>
              <input
                required
                className="scanny-input"
                value={paymentDestination}
                onChange={(e) => setPaymentDestination(e.target.value)}
                placeholder="+256700111222"
                maxLength={128}
              />
            </Field>
            <Field label="Your phone (optional)">
              <input
                className="scanny-input"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="+256700111222"
                maxLength={32}
              />
            </Field>

            {error ? <p className="scanny-error" role="alert">{error}</p> : null}

            <button type="submit" disabled={submitting} className="scanny-btn scanny-btn-primary">
              {submitting ? 'Generating…' : 'Generate QR'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="scanny-field">
      <span className="scanny-label">
        {label}
        {required ? <span className="req"> *</span> : null}
      </span>
      {children}
    </label>
  )
}
