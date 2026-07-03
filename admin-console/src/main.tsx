import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import './admin.css'
import AdminLogin from './AdminLogin'
import AdminApp from './AdminApp'
import adminKeycloak from './keycloak'

// Isolated session key — only this app sets/reads this key
const SESSION_KEY = 'scanny-admin-authenticated'

let kcInitPromise: Promise<boolean> | null = null

function initKc() {
  if (!kcInitPromise) {
    kcInitPromise = adminKeycloak.init({ onLoad: 'check-sso', checkLoginIframe: false })
  }
  return kcInitPromise
}

type View = 'landing' | 'app'

function Root() {
  const [view, setView] = useState<View>('landing')
  const [kcUsername, setKcUsername] = useState('Admin')

  // Restore session only if THIS app's flag is set
  useEffect(() => {
    const hadSession = sessionStorage.getItem(SESSION_KEY) === '1'
    if (!hadSession) return

    initKc()
      .then((authenticated) => {
        if (authenticated) {
          const name = adminKeycloak.tokenParsed?.name
            || adminKeycloak.tokenParsed?.preferred_username
            || adminKeycloak.tokenParsed?.email
            || 'Admin'
          setKcUsername(name)
          setView('app')
        } else {
          sessionStorage.removeItem(SESSION_KEY)
        }
      })
      .catch(() => sessionStorage.removeItem(SESSION_KEY))
  }, [])

  function handleLogin() {
    adminKeycloak.login({ redirectUri: 'http://localhost:5174' }).catch(console.error)
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY)
    if (adminKeycloak.authenticated) {
      adminKeycloak.logout({ redirectUri: 'http://localhost:5174' })
    } else {
      setView('landing')
    }
  }

  if (view === 'app') {
    return <AdminApp kcUsername={kcUsername} onLogout={handleLogout} />
  }

  return <AdminLogin onLogin={handleLogin} />
}

// Module-level init — handles the post-login redirect (code in URL)
adminKeycloak
  .init({ onLoad: 'check-sso', checkLoginIframe: false })
  .then((authenticated) => {
    kcInitPromise = Promise.resolve(authenticated)
    if (authenticated) {
      // Only store the flag if Keycloak authenticated via THIS client
      if (adminKeycloak.tokenParsed?.azp === 'superadmin') {
        sessionStorage.setItem(SESSION_KEY, '1')
      }
    }
  })
  .catch(() => { kcInitPromise = Promise.resolve(false) })
  .finally(() => {
    createRoot(document.getElementById('admin-root')!).render(
      <StrictMode><Root /></StrictMode>
    )
  })
