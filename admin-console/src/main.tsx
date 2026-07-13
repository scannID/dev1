import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './admin-index.css'
import './admin.css'
import AdminLogin from './AdminLogin'
import AdminApp from './AdminApp'
import adminKeycloak from './api/keycloak'

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
    console.log('[ADMIN] Checking session on mount, hadSession:', hadSession)
    if (!hadSession) return

    console.log('[ADMIN] Restoring session...')
    initKc()
      .then((authenticated) => {
        console.log('[ADMIN] Session restore - authenticated:', authenticated)
        if (authenticated) {
          const name = adminKeycloak.tokenParsed?.name
            || adminKeycloak.tokenParsed?.preferred_username
            || adminKeycloak.tokenParsed?.email
            || 'Admin'
          console.log('[ADMIN] User authenticated as:', name)
          setKcUsername(name)
          setView('app')
        } else {
          console.log('[ADMIN] Not authenticated, clearing session')
          sessionStorage.removeItem(SESSION_KEY)
        }
      })
      .catch((err) => {
        console.error('[ADMIN] Session restore error:', err)
        sessionStorage.removeItem(SESSION_KEY)
      })
  }, [])

  function handleLogin() {
    console.log('[ADMIN] Login button clicked, redirecting to Keycloak...')
    console.log('[ADMIN] Redirect URI:', 'http://localhost:5174')
    adminKeycloak.login({ redirectUri: 'http://localhost:5174' }).catch((err) => {
      console.error('[ADMIN] Login error:', err)
    })
  }

  function handleLogout() {
    console.log('[ADMIN] Logout initiated')
    sessionStorage.removeItem(SESSION_KEY)
    if (adminKeycloak.authenticated) {
      console.log('[ADMIN] Logging out from Keycloak')
      adminKeycloak.logout({ redirectUri: 'http://localhost:5174' })
    } else {
      console.log('[ADMIN] No active Keycloak session, returning to landing')
      setView('landing')
    }
  }

  if (view === 'app') {
    return <AdminApp kcUsername={kcUsername} onLogout={handleLogout} />
  }

  return <AdminLogin onLogin={handleLogin} />
}

// Module-level init — handles the post-login redirect (code in URL)
console.log('[ADMIN] Initializing Keycloak...')
console.log('[ADMIN] Keycloak config:', {
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'scanny',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'admin-console'
})

adminKeycloak
  .init({ onLoad: 'check-sso', checkLoginIframe: false })
  .then((authenticated) => {
    console.log('[ADMIN] Keycloak init complete - authenticated:', authenticated)
    kcInitPromise = Promise.resolve(authenticated)
    if (authenticated) {
      console.log('[ADMIN] Token parsed:', adminKeycloak.tokenParsed)
      console.log('[ADMIN] Client (azp):', adminKeycloak.tokenParsed?.azp)
      // Only store the flag if Keycloak authenticated via THIS client
      const expectedClient = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'admin-console'
      if (adminKeycloak.tokenParsed?.azp === expectedClient) {
        console.log('[ADMIN] Correct client, storing session')
        sessionStorage.setItem(SESSION_KEY, '1')
      } else {
        console.warn('[ADMIN] Wrong client, expected', expectedClient, 'but got:', adminKeycloak.tokenParsed?.azp)
      }
    } else {
      console.log('[ADMIN] Not authenticated')
    }
  })
  .catch((err) => { 
    console.error('[ADMIN] Keycloak init error:', err)
    kcInitPromise = Promise.resolve(false) 
  })
  .finally(() => {
    console.log('[ADMIN] Rendering app')
    createRoot(document.getElementById('admin-root')!).render(
      <StrictMode><Root /></StrictMode>
    )
  })
