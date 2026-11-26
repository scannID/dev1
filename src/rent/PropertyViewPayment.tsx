import { type FormEvent, useState, useEffect } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { MoMoPhoneInput } from '../components/MoMoPhoneInput'
import './PropertyViewPayment.css'

interface PropertyViewPaymentProps {
  propertyToken: string
  onPaymentSuccess: () => void
}

type PaymentPhase = 'form' | 'processing' | 'success' | 'failed'

// Generate or retrieve device ID
function getDeviceId(): string {
  const STORAGE_KEY = 'scanny-device-id'
  let deviceId = localStorage.getItem(STORAGE_KEY)
  if (!deviceId) {
    deviceId = 'device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem(STORAGE_KEY, deviceId)
  }
  return deviceId
}

// Check if this device has paid for this property within 12 hours
function hasValidPayment(propertyToken: string): boolean {
  const STORAGE_KEY = `property-view-${propertyToken}`
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return false
  
  try {
    const data = JSON.parse(stored)
    const deviceId = getDeviceId()
    const now = Date.now()
    const expiryTime = data.paidAt + (12 * 60 * 60 * 1000) // 12 hours
    
    return data.deviceId === deviceId && now < expiryTime
  } catch {
    return false
  }
}

// Store payment success for this device
function storePaymentSuccess(propertyToken: string): void {
  const STORAGE_KEY = `property-view-${propertyToken}`
  const data = {
    deviceId: getDeviceId(),
    paidAt: Date.now(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export default function PropertyViewPayment({
  propertyToken,
  onPaymentSuccess,
}: PropertyViewPaymentProps) {
  const [phone, setPhone] = useState('')
  const [phase, setPhase] = useState<PaymentPhase>('form')
  const [error, setError] = useState<string | null>(null)

  const VIEWING_FEE = 5000

  // Check if already paid on mount
  useEffect(() => {
    if (hasValidPayment(propertyToken)) {
      // Already paid within 12 hours on this device - skip to results
      onPaymentSuccess()
    }
  }, [propertyToken, onPaymentSuccess])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return

    setError(null)
    setPhase('processing')

    try {
      // STUB: Auto-success after 2 seconds (no real API call)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      
      // Store payment success for this device
      storePaymentSuccess(propertyToken)
      
      setPhase('success')
      setTimeout(() => {
        onPaymentSuccess()
      }, 1500)
      
      /* TODO: Replace with real API when backend is ready
      const response = await rentPublicApi.initiatePropertyViewPayment(propertyToken, { phone })
      
      if (!response.success) {
        throw new Error(response.message || 'Payment initiation failed')
      }

      // Poll for payment completion
      const maxPolls = 60
      let pollCount = 0
      
      const pollInterval = setInterval(async () => {
        try {
          const status = await rentPublicApi.pollPropertyViewPaymentStatus(response.transactionRef)
          
          if (status.status === 'Completed') {
            clearInterval(pollInterval)
            setPhase('success')
            setTimeout(() => {
              onPaymentSuccess()
            }, 1500)
          } else if (status.status === 'Failed') {
            clearInterval(pollInterval)
            setPhase('failed')
            setError(status.failureReason || 'Payment failed. Please try again.')
          }
          
          pollCount++
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval)
            setPhase('failed')
            setError('Payment is taking too long. Please try again or check your phone.')
          }
        } catch (err) {
          clearInterval(pollInterval)
          setPhase('failed')
          setError(err instanceof Error ? err.message : 'Failed to check payment status')
        }
      }, 1000)
      */
      
    } catch (err) {
      setPhase('failed')
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.')
    }
  }

  return (
    <div className="pvp-page">
      <div className="pvp-container">
        {/* Animated Koddly Logo Header */}
        <div className="pvp-header">
          <div className="pvp-logo-wrap">
            <img
              src="/koddlylogo3.png"
              alt="Koddly"
              className="pvp-logo-animated"
            />
          </div>
        </div>

        {/* Payment Form */}
        {phase === 'form' && (
          <div className="pvp-card">
            <div className="pvp-fee-banner">
              <p className="pvp-fee-label">Viewing Fee</p>
              <p className="pvp-fee-amount">5,000 UGX</p>
            </div>

            <p className="pvp-description">
              Pay to view available units and property details
            </p>

            <form onSubmit={handleSubmit} className="pvp-form">
              <div className="pvp-field-large">
                <label htmlFor="pvp-phone" className="pvp-label-large">
                  Mobile Money Number <span className="pvp-required">*</span>
                </label>
                <div className="pvp-input-wrapper">
                  <MoMoPhoneInput
                    id="pvp-phone"
                    value={phone}
                    onChange={setPhone}
                    placeholder="07XX XXX XXX"
                    required
                  />
                </div>
                <span className="pvp-hint">
                  MTN or Airtel - You'll receive a prompt on your phone
                </span>
              </div>

              {error && (
                <div className="pvp-error">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="pvp-btn pvp-btn-primary"
                disabled={!phone.trim()}
              >
                Pay 5,000 UGX to See Results
              </button>
            </form>
          </div>
        )}

        {/* Processing State */}
        {phase === 'processing' && (
          <div className="pvp-card pvp-card-center">
            <div className="pvp-processing-icon">
              <Loader2 size={48} className="pvp-spin" />
            </div>
            <h2 className="pvp-status-title">Processing Payment</h2>
            <p className="pvp-status-desc">
              Check your phone for the mobile money prompt and approve the payment of 2,000 UGX
            </p>
            <div className="pvp-phone-display">{phone}</div>
          </div>
        )}

        {/* Success State */}
        {phase === 'success' && (
          <div className="pvp-card pvp-card-center">
            <div className="pvp-success-icon">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="pvp-status-title pvp-success">Payment Successful!</h2>
            <p className="pvp-status-desc">
              Loading property details...
            </p>
          </div>
        )}

        {/* Failed State */}
        {phase === 'failed' && (
          <div className="pvp-card pvp-card-center">
            <div className="pvp-error-icon">
              <AlertCircle size={48} />
            </div>
            <h2 className="pvp-status-title pvp-error">Payment Failed</h2>
            <p className="pvp-status-desc">
              {error || 'The payment could not be processed. Please try again.'}
            </p>
            <button
              type="button"
              className="pvp-btn pvp-btn-secondary"
              onClick={() => {
                setPhase('form')
                setError(null)
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Footer */}
        <footer className="pvp-footer">
          <p className="pvp-footer-text">Secure payment powered by Qbilabs SMC Ltd</p>
        </footer>
      </div>
    </div>
  )
}
