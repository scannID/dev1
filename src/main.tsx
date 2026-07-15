import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import LandingPage from './LandingPage'
import EventTicketPage from './EventTicket'
import CustomerMenu from './CustomerMenu'
import keycloak from './keycloak'

function resolveCustomerRoute(): { businessId: string; qrToken: string | null } | null {
  const url = new URL(window.location.href)
  const bid = url.searchParams.get('bid')
  const qr = url.searchParams.get('qr')

  // Preferred deep link from backend: /b/{businessId}?qr=TOKEN
  const pathMatch = url.pathname.match(/^\/b\/([^/]+)\/?$/)
  if (pathMatch) {
    return { businessId: decodeURIComponent(pathMatch[1]), qrToken: qr }
  }

  // Legacy: ?bid=
  if (bid) {
    return { businessId: bid, qrToken: qr }
  }

  // QR-only link with path /b?qr=TOKEN — resolve via API later if needed
  return null
}

const customerRoute = resolveCustomerRoute()

// Customer menu — no Keycloak
if (customerRoute) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <CustomerMenu businessId={customerRoute.businessId} qrToken={customerRoute.qrToken} />
    </StrictMode>
  )
} else {
  const SESSION_KEY = 'scanny-merchant-authenticated'

  let kcInitPromise: Promise<boolean> | null = null

  function initKeycloak() {
    if (!kcInitPromise) {
      kcInitPromise = keycloak.init({ onLoad: 'check-sso', checkLoginIframe: false })
    }
    return kcInitPromise
  }

  type View = 'landing' | 'app' | 'ticket'

  function Root() {
    const [view, setView] = useState<View>('landing')
    const [darkMode, setDarkMode] = useState(() => {
      const saved = localStorage.getItem('scanny-dark-mode')
      return saved ? JSON.parse(saved) : false
    })

    // Restore session only if THIS app's flag is set
    useEffect(() => {
      const hadSession = sessionStorage.getItem(SESSION_KEY) === '1'
      if (!hadSession) return

      initKeycloak()
        .then((authenticated) => {
          if (authenticated) {
            setView('app')
          } else {
            sessionStorage.removeItem(SESSION_KEY)
          }
        })
        .catch(() => sessionStorage.removeItem(SESSION_KEY))
    }, [])

    useEffect(() => {
      function handleKeyPress(e: KeyboardEvent) {
        if (e.key === 'd' || e.key === 'D') {
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
          setDarkMode((prev: boolean) => {
            const newMode = !prev
            localStorage.setItem('scanny-dark-mode', JSON.stringify(newMode))
            return newMode
          })
        }
      }
      window.addEventListener('keydown', handleKeyPress)
      return () => window.removeEventListener('keydown', handleKeyPress)
    }, [])

    useEffect(() => {
      document.body.classList.toggle('dark-mode', darkMode)
    }, [darkMode])

    function handleGetStarted() {
      keycloak.login({ redirectUri: window.location.origin }).catch(console.error)
    }

    function handleLogout() {
      sessionStorage.removeItem(SESSION_KEY)
      localStorage.removeItem('scanny-orders-v1')
      localStorage.removeItem('scanny-businesses-v2')
      if (keycloak.authenticated) {
        keycloak.logout({ redirectUri: window.location.origin })
      } else {
        setView('landing')
      }
    }

    const kcUsername = keycloak.authenticated && keycloak.tokenParsed
      ? (keycloak.tokenParsed.name || keycloak.tokenParsed.preferred_username || keycloak.tokenParsed.email || '')
      : ''

    if (view === 'app') return <App onLogout={handleLogout} kcUsername={kcUsername} />
    if (view === 'ticket') return <EventTicketPage onBack={() => setView('landing')} />
    return (
      <LandingPage
        onGetStarted={handleGetStarted}
        onCreateTicket={() => setView('ticket')}
      />
    )
  }

  // Module-level init — handles post-login redirect (auth code in URL)
  keycloak
    .init({ onLoad: 'check-sso', checkLoginIframe: false })
    .then((authenticated) => {
      kcInitPromise = Promise.resolve(authenticated)
      if (authenticated) {
        if (keycloak.tokenParsed?.azp === 'scanny-client') {
          sessionStorage.setItem(SESSION_KEY, '1')
        }
      }
    })
    .catch(() => {
      kcInitPromise = Promise.resolve(false)
    })
    .finally(() => {
      createRoot(document.getElementById('root')!).render(
        <StrictMode>
          <Root />
        </StrictMode>
      )
    })
}
