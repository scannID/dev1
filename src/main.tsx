import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import LandingPage from './LandingPage'
import EventTicketPage from './EventTicket'
import CustomerMenu from './CustomerMenu'
import keycloak from './keycloak'

// Check if this is a customer menu view (has ?bid= parameter)
const urlParams = new URLSearchParams(window.location.search)
const businessId = urlParams.get('bid')

// If businessId exists, show customer menu directly without authentication
if (businessId) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <CustomerMenu businessId={businessId} />
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
    // Redirect to Keycloak login page
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

  if (view === 'app')    return <App onLogout={handleLogout} kcUsername={kcUsername} />
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
      // Only store session flag if token belongs to the merchant client
      if (keycloak.tokenParsed?.azp === 'scanny-client') {
        sessionStorage.setItem(SESSION_KEY, '1')
      }
    }
  })
  .catch(() => { kcInitPromise = Promise.resolve(false) })
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode><Root /></StrictMode>
    )
  })
}
