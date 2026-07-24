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
import TicketGatePage from './tickets/TicketGatePage'
import keycloak, { hasMerchantSession, initKeycloak, waitForKeycloak } from './keycloak'
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

function resolveGateRoute(): string | null {
  const match = window.location.pathname.match(/^\/gate\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : null
}

function goToLanding() {
  window.location.href = '/'
}

const customerRoute = resolveCustomerRoute()
const payToken = resolvePayRoute()
const trackNumber = resolveTrackRoute()
const ticketViewToken = resolveTicketViewRoute()
const gateToken = resolveGateRoute()
const ticketMasterToken = resolveTicketPurchaseRoute()

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
} else if (gateToken) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <TicketGatePage gateToken={gateToken} />
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
  const MERCHANT_REDIRECT_URI = window.location.origin

  type View = 'landing' | 'app'

  function Root() {
    const [view, setView] = useState<View>('landing')
    const [darkMode, setDarkMode] = useState(() => readDarkMode())
    const [marketingSlug, setMarketingSlug] = useState<MarketingSlug | null>(() =>
      slugFromPathname(window.location.pathname),
    )

    useEffect(() => {
      const syncPath = () => setMarketingSlug(slugFromPathname(window.location.pathname))
      window.addEventListener('popstate', syncPath)
      return () => window.removeEventListener('popstate', syncPath)
    }, [])

    // Restore dashboard after Keycloak redirect (same pattern as admin console)
    useEffect(() => {
      const hadSession = sessionStorage.getItem(SESSION_KEY) === '1'
      if (!hadSession && !hasMerchantSession()) return

      waitForKeycloak()
        .then((authenticated) => {
          if (authenticated && hasMerchantSession()) {
            sessionStorage.setItem(SESSION_KEY, '1')
            setView('app')
          } else {
            sessionStorage.removeItem(SESSION_KEY)
          }
        })
        .catch(() => {
          sessionStorage.removeItem(SESSION_KEY)
        })
    }, [])

    useEffect(() => {
      function handleKeyPress(e: KeyboardEvent) {
        if (e.key === 'd' || e.key === 'D') {
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
          setDarkMode((prev: boolean) => {
            const newMode = !prev
            persistDarkMode(newMode)
            return newMode
          })
        }
      }
      window.addEventListener('keydown', handleKeyPress)
      return () => window.removeEventListener('keydown', handleKeyPress)
    }, [])

    useEffect(() => {
      applyDarkMode(darkMode)
    }, [darkMode])

    function handleGetStarted() {
      keycloak.login({ redirectUri: MERCHANT_REDIRECT_URI, prompt: 'login' }).catch(console.error)
    }

    function handleLogout() {
      sessionStorage.removeItem(SESSION_KEY)
      if (keycloak.authenticated) {
        keycloak.logout({ redirectUri: MERCHANT_REDIRECT_URI })
      } else {
        setView('landing')
      }
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

    return <LandingPage onGetStarted={handleGetStarted} />
  }

  initKeycloak()
    .then((authenticated) => {
      if (authenticated && hasMerchantSession()) {
        sessionStorage.setItem(SESSION_KEY, '1')
      } else {
        sessionStorage.removeItem(SESSION_KEY)
      }
    })
    .catch(() => {
      sessionStorage.removeItem(SESSION_KEY)
    })
    .finally(() => {
      createRoot(document.getElementById('root')!).render(
        <StrictMode>
          <Root />
        </StrictMode>
      )
    })
}
