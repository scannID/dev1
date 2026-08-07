import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import LandingPage from './LandingPage'
import MarketingLayout from './marketing/MarketingLayout'
import { slugFromPathname, type MarketingSlug } from './marketing/routes'
import CustomerMenu from './CustomerMenu'
import QuickPayTrack from './quickpay/QuickPayTrack'
import QuickPayCustomer from './quickpay/QuickPayCustomer'
import TicketPurchasePage from './tickets/TicketPurchasePage'
import TicketViewPage from './tickets/TicketViewPage'
import GateScanPage from './tickets/GateScanPage'
import EventTicketPage from './EventTicket'
import keycloak, {
  hasPortalSession,
  initKeycloak,
  logoutMerchant,
  waitForKeycloak,
} from './keycloak'
import { applyDarkMode, initThemeFromStorage, persistDarkMode, readDarkMode } from './lib/theme'
import { DanceLoader } from './components/DanceLoader'
import { WaveLoader } from './components/WaveLoader'
import { CookieConsent } from './components/CookieConsent'
import { KitchenDisplayPage } from './kitchen/KitchenDisplayPage'
import { clearStaffSession } from './api/client'
import ReceiptPage from './receipt/ReceiptPage'

initThemeFromStorage()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

function resolveKitchenRoute(): string | null {
  const match = window.location.pathname.match(/^\/kitchen\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : null
}

function resolveCustomerRoute(): { businessId: string; qrToken: string | null } | null {
  const url = new URL(window.location.href)
  const bid = url.searchParams.get('bid')
  const qr = url.searchParams.get('qr')

  const pathMatch = url.pathname.match(/^\/b\/([^/]+)\/?$/)
  if (pathMatch) {
    return { businessId: decodeURIComponent(pathMatch[1]), qrToken: qr }
  }

  if (bid) {
    return { businessId: bid, qrToken: qr }
  }

  return null
}

function resolvePayRoute(): string | null {
  const match = window.location.pathname.match(/^\/pay\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : null
}

function resolveTrackRoute(): string | null {
  const match = window.location.pathname.match(/^\/track\/([^/]+)\/?$/)
  if (match) return decodeURIComponent(match[1])
  return new URL(window.location.href).searchParams.get('track')
}

function resolveTicketViewRoute(): string | null {
  const match = window.location.pathname.match(/^\/ticket\/view\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : null
}

function resolveTicketPurchaseRoute(): string | null {
  const match = window.location.pathname.match(/^\/ticket\/([^/]+)\/?$/)
  if (!match) return null
  const token = decodeURIComponent(match[1])
  // Reserved paths under /ticket/* — not event purchase tokens
  if (token === 'gate' || token === 'view') return null
  return token
}

function resolveCreateEventRoute(): boolean {
  return /^\/create-event\/?$/.test(window.location.pathname)
}

function resolveGateScanRoute(): boolean {
  return /^\/ticket\/gate\/?$/.test(window.location.pathname)
}

function resolveReceiptRoute(): string | null {
  const match = window.location.pathname.match(/^\/receipt\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : null
}

function goToLanding() {
  window.location.href = '/'
}

const customerRoute = resolveCustomerRoute()
const kitchenBusinessId = resolveKitchenRoute()
const payToken = resolvePayRoute()
const trackNumber = resolveTrackRoute()
const ticketViewToken = resolveTicketViewRoute()
const ticketMasterToken = resolveTicketPurchaseRoute()
const createEventRoute = resolveCreateEventRoute()
const gateScanRoute = resolveGateScanRoute()
const receiptOrderId = resolveReceiptRoute()

if (kitchenBusinessId) {
  function KitchenRoot() {
    const [ready, setReady] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
      let cancelled = false
      waitForKeycloak()
        .then((authenticated) => {
          if (cancelled) return
          if (authenticated && keycloak.token) {
            setReady(true)
            return
          }
          setError('Sign in to the merchant app first, then open Kitchen.')
        })
        .catch(() => {
          if (!cancelled) setError('Could not restore merchant session for kitchen.')
        })
      return () => {
        cancelled = true
      }
    }, [])

    if (error) {
      return (
        <main className="kitchen-shell">
          <p className="kitchen-empty">{error}</p>
        </main>
      )
    }
    if (!ready) {
      return (
        <main className="kitchen-shell">
          <DanceLoader label="Loading kitchen…" />
        </main>
      )
    }
    return <KitchenDisplayPage businessId={kitchenBusinessId} />
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <>
        <KitchenRoot />
        <CookieConsent />
      </>
    </StrictMode>,
  )
} else if (receiptOrderId !== null) {
  document.documentElement.classList.add('cm-app')
  applyDarkMode(false)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ReceiptPage />
    </StrictMode>,
  )
} else if (customerRoute) {
  document.documentElement.classList.add('cm-app')
  // Customer UI stays light + white — never inherit merchant dark mode / green-purple tokens.
  applyDarkMode(false)
  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport) {
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
    )
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <CustomerMenu businessId={customerRoute.businessId} qrToken={customerRoute.qrToken} />
    </StrictMode>
  )
} else if (createEventRoute) {
  applyDarkMode(false)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <>
        <div style={{ minHeight: '100svh', width: '100%', overflow: 'hidden' }}>
          <EventTicketPage onBack={goToLanding} />
        </div>
        <CookieConsent />
      </>
    </StrictMode>
  )
} else if (ticketViewToken) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <TicketViewPage accessToken={ticketViewToken} />
    </StrictMode>
  )
} else if (gateScanRoute) {
  const gateParams = new URL(window.location.href).searchParams
  const gatePayload = gateParams.get('p') || gateParams.get('payload')
  const gateEventId = gateParams.get('event') || gateParams.get('eventId')

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <>
        <GateScanPage initialPayload={gatePayload} initialEventId={gateEventId} />
        <CookieConsent />
      </>
    </StrictMode>
  )
} else if (ticketMasterToken) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <TicketPurchasePage masterQrToken={ticketMasterToken} />
    </StrictMode>
  )
} else if (payToken) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QuickPayCustomer qrToken={payToken} />
    </StrictMode>
  )
} else if (trackNumber) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QuickPayTrack trackingNumber={trackNumber} onBack={goToLanding} />
    </StrictMode>
  )
} else {
  const SESSION_KEY = 'scanny-merchant-authenticated'
  const LOGIN_INTENT_KEY = 'scanny-merchant-login-intent'
  const MERCHANT_REDIRECT_URI = window.location.origin

  type Phase = 'boot' | 'landing' | 'app' | 'redirecting'

  function needsAuthRestore() {
    return (
      sessionStorage.getItem(SESSION_KEY) === '1' ||
      sessionStorage.getItem(LOGIN_INTENT_KEY) === '1'
    )
  }

  function AuthBootScreen({ mode }: { mode: 'boot' | 'redirecting' }) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--background, #fff)',
          color: 'var(--foreground, #111)',
          fontFamily: 'Outfit, ui-sans-serif, system-ui, sans-serif',
        }}
      >
        {mode === 'redirecting' ? (
          <WaveLoader label="Signing you out…" />
        ) : (
          <DanceLoader label="Opening your portal…" />
        )}
      </div>
    )
  }

  function Root() {
    const [phase, setPhase] = useState<Phase>(() => (needsAuthRestore() ? 'boot' : 'landing'))
    const [authError, setAuthError] = useState<string | null>(null)
    const [darkMode, setDarkMode] = useState(() => readDarkMode())
    const [marketingSlug, setMarketingSlug] = useState<MarketingSlug | null>(() =>
      slugFromPathname(window.location.pathname),
    )

    useEffect(() => {
      const syncPath = () => setMarketingSlug(slugFromPathname(window.location.pathname))
      window.addEventListener('popstate', syncPath)
      return () => window.removeEventListener('popstate', syncPath)
    }, [])

    // Restore dashboard after intentional login or an existing Keycloak portal session.
    useEffect(() => {
      const hadSession = sessionStorage.getItem(SESSION_KEY) === '1'
      const hadIntent = sessionStorage.getItem(LOGIN_INTENT_KEY) === '1'
      if (!hadSession && !hadIntent) {
        setPhase((prev) => (prev === 'boot' ? 'landing' : prev))
        return
      }

      let cancelled = false
      waitForKeycloak()
        .then((authenticated) => {
          if (cancelled) return
          sessionStorage.removeItem(LOGIN_INTENT_KEY)
          if (authenticated && hasPortalSession()) {
            sessionStorage.setItem(SESSION_KEY, '1')
            setAuthError(null)
            setPhase('app')
            return
          }
          sessionStorage.removeItem(SESSION_KEY)
          if (hadIntent && authenticated && !hasPortalSession()) {
            setAuthError('This account cannot open the portal. Ask your owner to invite you, or use a merchant account.')
          }
          setPhase('landing')
        })
        .catch(() => {
          if (cancelled) return
          sessionStorage.removeItem(LOGIN_INTENT_KEY)
          sessionStorage.removeItem(SESSION_KEY)
          setPhase('landing')
        })

      return () => {
        cancelled = true
      }
    }, [phase])

    useEffect(() => {
      function handleKeyPress(e: KeyboardEvent) {
        if (e.key !== 'd' && e.key !== 'D') return
        if (e.metaKey || e.ctrlKey || e.altKey) return
        const target = e.target
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          (target instanceof HTMLElement && target.isContentEditable)
        ) {
          return
        }
        e.preventDefault()
        setDarkMode((prev: boolean) => {
          const newMode = !prev
          persistDarkMode(newMode)
          return newMode
        })
      }
      window.addEventListener('keydown', handleKeyPress)
      return () => window.removeEventListener('keydown', handleKeyPress)
    }, [])

    useEffect(() => {
      applyDarkMode(darkMode)
    }, [darkMode])

    function handleGetStarted() {
      setAuthError(null)
      sessionStorage.setItem(LOGIN_INTENT_KEY, '1')
      keycloak.login({ redirectUri: MERCHANT_REDIRECT_URI, prompt: 'login' }).catch((err) => {
        sessionStorage.removeItem(LOGIN_INTENT_KEY)
        console.error(err)
      })
    }

    function handleLogout() {
      setPhase('redirecting')
      sessionStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(LOGIN_INTENT_KEY)
      clearStaffSession()
      window.setTimeout(() => {
        logoutMerchant(MERCHANT_REDIRECT_URI)
      }, 650)
    }

    function handleBackToLanding() {
      sessionStorage.removeItem(SESSION_KEY)
      clearStaffSession()
      setPhase('landing')
    }

    const kcUsername = keycloak.authenticated && keycloak.tokenParsed
      ? (keycloak.tokenParsed.name || keycloak.tokenParsed.preferred_username || keycloak.tokenParsed.email || '')
      : ''

    if (phase === 'boot' || phase === 'redirecting') {
      return <AuthBootScreen mode={phase} />
    }

    if (phase === 'app') {
      return (
        <App
          onLogout={handleLogout}
          onBackToLanding={handleBackToLanding}
          kcUsername={kcUsername}
        />
      )
    }

    if (marketingSlug) {
      return <MarketingLayout slug={marketingSlug} onGetStarted={handleGetStarted} />
    }

    return (
      <>
        {authError ? (
          <div
            role="alert"
            style={{
              position: 'fixed',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              maxWidth: 'min(520px, 92vw)',
              padding: '10px 14px',
              borderRadius: 8,
              background: '#7f1d1d',
              color: '#fff',
              fontSize: 14,
              boxShadow: '0 8px 24px rgba(0,0,0,.25)',
            }}
          >
            {authError}
          </div>
        ) : null}
        <LandingPage
          onGetStarted={handleGetStarted}
          onCreateEventTicket={() => {
            window.location.href = '/create-event'
          }}
        />
      </>
    )
  }

  // Complete OAuth redirect via check-sso; do not promote ambient SSO into a portal session.
  initKeycloak()
    .then((authenticated) => {
      const hadSession = sessionStorage.getItem(SESSION_KEY) === '1'
      const hadIntent = sessionStorage.getItem(LOGIN_INTENT_KEY) === '1'
      if (authenticated && hasPortalSession() && (hadSession || hadIntent)) {
        sessionStorage.setItem(SESSION_KEY, '1')
        return
      }
      if (!hadIntent) {
        sessionStorage.removeItem(SESSION_KEY)
      }
    })
    .catch(() => {
      sessionStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(LOGIN_INTENT_KEY)
    })
    .finally(() => {
      createRoot(document.getElementById('root')!).render(
        <StrictMode>
          <>
            <Root />
            <CookieConsent />
          </>
        </StrictMode>
      )
    })
}
