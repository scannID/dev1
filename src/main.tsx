import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import LandingPage from './LandingPage'
import EventTicketPage from './EventTicket'
import keycloak from './keycloak'

type View = 'landing' | 'app' | 'ticket'

// Module-level flag — survives StrictMode double-invoke because it lives
// outside React's component lifecycle entirely.
let kcInitPromise: Promise<boolean> | null = null

function initKeycloak() {
  if (!kcInitPromise) {
    kcInitPromise = keycloak.init({ onLoad: 'check-sso', checkLoginIframe: false })
  }
  return kcInitPromise
}

function Root() {
  const [view, setView] = useState<View>('landing')
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('scanny-dark-mode')
    return saved ? JSON.parse(saved) : false
  })

  // On mount: silently check for an existing Keycloak session.
  // Only moves to 'app' if the user already authenticated in a previous visit.
  useEffect(() => {
    const hadSession = sessionStorage.getItem('scanny-kc-authenticated') === '1'
    if (!hadSession) return

    initKeycloak()
      .then((authenticated) => {
        if (authenticated) {
          setView('app')
        } else {
          sessionStorage.removeItem('scanny-kc-authenticated')
        }
      })
      .catch(() => sessionStorage.removeItem('scanny-kc-authenticated'))
  }, [])

  // Toggle dark mode with 'D' key
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

  // "Get Started" — initialize Keycloak then immediately redirect to login
  function handleGetStarted() {
    initKeycloak()
      .then(() => {
        // Whether or not there's already a session, send them to the login page
        keycloak.login({ redirectUri: window.location.origin })
      })
      .catch(console.error)
  }

  function handleLogout() {
    sessionStorage.removeItem('scanny-kc-authenticated')
    localStorage.removeItem('scanny-orders-v1')
    localStorage.removeItem('scanny-businesses-v2')
    keycloak.logout({ redirectUri: window.location.origin })
  }

  if (view === 'app')    return <App onLogout={handleLogout} />
  if (view === 'ticket') return <EventTicketPage onBack={() => setView('landing')} />
  return (
    <LandingPage
      onGetStarted={handleGetStarted}
      onCreateTicket={() => setView('ticket')}
    />
  )
}

// After Keycloak redirects back post-login, pick up the auth code from the URL
// and exchange it for a token before React even renders.
keycloak
  .init({ onLoad: 'check-sso', checkLoginIframe: false })
  .then((authenticated) => {
    kcInitPromise = Promise.resolve(authenticated)
    if (authenticated) {
      sessionStorage.setItem('scanny-kc-authenticated', '1')
    }
  })
  .catch(() => {
    kcInitPromise = Promise.resolve(false)
  })
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <Root />
      </StrictMode>,
    )
  })
