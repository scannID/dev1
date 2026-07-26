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
import EventTicketPage from './EventTicket'
import keycloak, {
  hasMerchantSession,
  initKeycloak,
  logoutMerchant,
  waitForKeycloak,
} from './keycloak'
import { applyDarkMode, initThemeFromStorage, persistDarkMode, readDarkMode } from './lib/theme'

initThemeFromStorage()

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
  return match ? decodeURIComponent(match[1]) : null
}

function resolveCreateEventRoute(): boolean {
  return /^\/create-event\/?$/.test(window.location.pathname)
}

function goToLanding() {
  window.location.href = '/'
}

const customerRoute = resolveCustomerRoute()
const payToken = resolvePayRoute()
const trackNumber = resolveTrackRoute()
const ticketViewToken = resolveTicketViewRoute()
const ticketMasterToken = resolveTicketPurchaseRoute()
const createEventRoute = resolveCreateEventRoute()

if (customerRoute) {
  document.documentElement.classList.add('cm-app')
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
      <div style={{ minHeight: '100svh', width: '100%', overflow: 'hidden' }}>
        <EventTicketPage onBack={goToLanding} />
      </div>
    </StrictMode>
  )
} else if (ticketViewToken) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <TicketViewPage accessToken={ticketViewToken} />
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

  type View = 'landing' | 'app'

  function Root() {
    const [view, setView] = useState<View>('landing')
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

    // Restore dashboard only after intentional login or an existing merchant session flag.
    // Ambient Keycloak SSO (e.g. admin logged in) must not open the merchant app.
    useEffect(() => {
      const hadSession = sessionStorage.getItem(SESSION_KEY) === '1'
      const hadIntent = sessionStorage.getItem(LOGIN_INTENT_KEY) === '1'
      if (!hadSession && !hadIntent) return

      waitForKeycloak()
        .then((authenticated) => {
          sessionStorage.removeItem(LOGIN_INTENT_KEY)
          if (authenticated && hasMerchantSession()) {
            sessionStorage.setItem(SESSION_KEY, '1')
            setAuthError(null)
            setView('app')
            return
          }
          sessionStorage.removeItem(SESSION_KEY)
          if (hadIntent && authenticated && !hasMerchantSession()) {
            setAuthError('This account is not a merchant. Use a MERCHANT user, or open the admin console.')
          }
        })
        .catch(() => {
          sessionStorage.removeItem(LOGIN_INTENT_KEY)
          sessionStorage.removeItem(SESSION_KEY)
        })
    }, [])

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
      sessionStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(LOGIN_INTENT_KEY)
      logoutMerchant(MERCHANT_REDIRECT_URI)
    }

    function handleBackToLanding() {
      sessionStorage.removeItem(SESSION_KEY)
      setView('landing')
    }

    const kcUsername = keycloak.authenticated && keycloak.tokenParsed
      ? (keycloak.tokenParsed.name || keycloak.tokenParsed.preferred_username || keycloak.tokenParsed.email || '')
      : ''

    if (view === 'app') {
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

  // Complete OAuth redirect via check-sso; do not promote ambient SSO into a merchant session.
  initKeycloak()
    .then((authenticated) => {
      const hadSession = sessionStorage.getItem(SESSION_KEY) === '1'
      const hadIntent = sessionStorage.getItem(LOGIN_INTENT_KEY) === '1'
      if (authenticated && hasMerchantSession() && (hadSession || hadIntent)) {
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
          <Root />
        </StrictMode>
      )
    })
}
