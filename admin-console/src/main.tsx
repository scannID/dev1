import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './admin-index.css'
import './admin.css'
import AdminLogin from './AdminLogin'
import AdminApp from './AdminApp'
import adminKeycloak from './api/keycloak'

// Isolated session key — only this app sets/reads this key
const SESSION_KEY = 'scanny-admin-authenticated'
const EXPECTED_CLIENT = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'scanny-admin'

let kcInitPromise: Promise<boolean> | null = null

function initKc() {
  if (!kcInitPromise) {
    kcInitPromise = adminKeycloak.init({ onLoad: 'check-sso', checkLoginIframe: false })
  }
  return kcInitPromise
}

function hasAdminRole(): boolean {
  const roles = (adminKeycloak.tokenParsed?.realm_access as { roles?: string[] } | undefined)?.roles ?? []
  return roles.includes('ADMIN')
}

function isAdminClient(): boolean {
  return adminKeycloak.tokenParsed?.azp === EXPECTED_CLIENT
}

function redirectUri() {
  return window.location.origin
}

type View = 'landing' | 'app'

function Root() {
  const [view, setView] = useState<View>('landing')
  const [kcUsername, setKcUsername] = useState('Admin')
  const [authError, setAuthError] = useState<string | null>(null)
  const [loginBusy, setLoginBusy] = useState(false)

  // Restore session only if THIS app's flag is set
  useEffect(() => {
    const hadSession = sessionStorage.getItem(SESSION_KEY) === '1'
    if (!hadSession) return

    initKc()
      .then((authenticated) => {
        if (authenticated && isAdminClient() && hasAdminRole()) {
          const name = adminKeycloak.tokenParsed?.name
            || adminKeycloak.tokenParsed?.preferred_username
            || adminKeycloak.tokenParsed?.email
            || 'Admin'
          setKcUsername(name)
          setView('app')
          return
        }
        sessionStorage.removeItem(SESSION_KEY)
      })
      .catch(() => {
        sessionStorage.removeItem(SESSION_KEY)
      })
  }, [])

  async function handleLogin() {
    setAuthError(null)
    setLoginBusy(true)
    try {
      await initKc()
      // Force the Keycloak login form — silent SSO can leave a merchant
      // session in place and make Sign in appear to do nothing.
      await adminKeycloak.login({
        redirectUri: redirectUri(),
        prompt: 'login',
      })
    } catch (err) {
      console.error('[ADMIN] Login error:', err)
      setAuthError(err instanceof Error ? err.message : 'Failed to start Keycloak login')
      setLoginBusy(false)
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY)
    if (adminKeycloak.authenticated) {
      adminKeycloak.logout({ redirectUri: redirectUri() })
    } else {
      setView('landing')
    }
  }

  if (view === 'app') {
    return <AdminApp kcUsername={kcUsername} onLogout={handleLogout} />
  }

  return (
    <AdminLogin
      onLogin={handleLogin}
      error={authError}
      busy={loginBusy}
    />
  )
}

console.log('[ADMIN] Initializing Keycloak...', {
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'scanny',
  clientId: EXPECTED_CLIENT,
})

kcInitPromise = adminKeycloak.init({ onLoad: 'check-sso', checkLoginIframe: false })

kcInitPromise
  .then((authenticated) => {
    console.log('[ADMIN] Keycloak init complete - authenticated:', authenticated)
    if (!authenticated) return

    console.log('[ADMIN] Token:', {
      azp: adminKeycloak.tokenParsed?.azp,
      roles: (adminKeycloak.tokenParsed?.realm_access as { roles?: string[] } | undefined)?.roles,
    })

    if (isAdminClient() && hasAdminRole()) {
      sessionStorage.setItem(SESSION_KEY, '1')
      return
    }

    sessionStorage.removeItem(SESSION_KEY)
    if (isAdminClient() && !hasAdminRole()) {
      console.warn('[ADMIN] Signed in without ADMIN realm role')
    }
  })
  .catch((err) => {
    console.error('[ADMIN] Keycloak init error:', err)
    kcInitPromise = Promise.resolve(false)
  })
  .finally(() => {
    createRoot(document.getElementById('admin-root')!).render(
      <StrictMode><Root /></StrictMode>
    )
  })
