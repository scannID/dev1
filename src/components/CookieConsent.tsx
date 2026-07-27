import { useEffect, useState } from 'react'
import {
  getCookieConsentClientId,
  getCookieConsent,
  setCookieConsent,
  type CookieConsentChoice,
} from '../lib/cookieConsent'
import { api } from '../api/client'
import './CookieConsent.css'

type CookieConsentProps = {
  /** Customer menu uses the orange accent shell. */
  variant?: 'default' | 'customer'
}

export function CookieConsent({ variant = 'default' }: CookieConsentProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(getCookieConsent() === null)
  }, [])

  function accept(choice: CookieConsentChoice) {
    setCookieConsent(choice)
    setVisible(false)
    void api.post('/consents/cookies', {
      choice,
      clientId: getCookieConsentClientId(),
      source: 'merchant-web',
      path: window.location.pathname,
    }).catch(() => {
      // Keep UX non-blocking; local consent remains saved.
    })
  }

  if (!visible) return null

  return (
    <div
      className={`cookie-consent${variant === 'customer' ? ' cookie-consent--customer' : ''}`}
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
    >
      <div className="cookie-consent-panel">
        <p className="cookie-consent-text">
          We use essential cookies and local storage for sign-in, your cart, and preferences.{' '}
          <a href="/cookies">Cookie policy</a>
        </p>
        <div className="cookie-consent-actions">
          <button
            type="button"
            className="cookie-consent-btn cookie-consent-btn-ghost"
            onClick={() => accept('essential')}
          >
            Essential only
          </button>
          <button
            type="button"
            className="cookie-consent-btn cookie-consent-btn-primary"
            onClick={() => accept('accepted')}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}

export default CookieConsent
