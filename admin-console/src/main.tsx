import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './admin-index.css'
import './admin.css'
import AdminLogin from './AdminLogin'
import AdminApp from './AdminApp'
import adminKeycloak, { hasAdminSession, logoutAdmin } from './api/keycloak'

// Isolated session key — only this app sets/reads this key
const SESSION_KEY = 'scanny-admin-authenticated'
const LOGIN_INTENT_KEY = 'scanny-admin-login-intent'

let kcInitPromise: Promise<boolean> | null = null

function initKc() {
  if (!kcInitPromise) {
    kcInitPromise = adminKeycloak.init({ onLoad: 'check-sso', checkLoginIframe: false })
  }
  return kcInitPromise
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

  // Restore only after intentional login or an existing admin session flag.
  // Ambient merchant SSO on the shared realm must never open the admin app.
  useEffect(() => {
    const hadSession = sessionStorage.getItem(SESSION_KEY) === '1'
    const hadIntent = sessionStorage.getItem(LOGIN_INTENT_KEY) === '1'
    if (!hadSession && !hadIntent) return

    initKc()
      .then((authenticated) => {
        sessionStorage.removeItem(LOGIN_INTENT_KEY)
        if (authenticated && hasAdminSession()) {
          const name = adminKeycloak.tokenParsed?.name
            || adminKeycloak.tokenParsed?.preferred_username
            || adminKeycloak.tokenParsed?.email
            || 'Admin'
          setKcUsername(name)
          sessionStorage.setItem(SESSION_KEY, '1')
          setAuthError(null)
          setView('app')
          return
        }
        sessionStorage.removeItem(SESSION_KEY)
        if (hadIntent && authenticated && !hasAdminSession()) {
          setAuthError('This account is not an admin. Use an ADMIN user, or open the merchant app.')
        }
      })
      .catch(() => {
        sessionStorage.removeItem(LOGIN_INTENT_KEY)
        sessionStorage.removeItem(SESSION_KEY)
      })
  }, [])

  async function handleLogin() {
    setAuthError(null)
    setLoginBusy(true)
    try {
      await initKc()
      sessionStorage.setItem(LOGIN_INTENT_KEY, '1')
      // Force the Keycloak login form — silent SSO can leave a merchant
      // session in place and make Sign in appear to do nothing.
      await adminKeycloak.login({
        redirectUri: redirectUri(),
        prompt: 'login',
      })
    } catch (err) {
      console.error('[ADMIN] Login error:', err)
      sessionStorage.removeItem(LOGIN_INTENT_KEY)
      setAuthError(err instanceof Error ? err.message : 'Failed to start Keycloak login')
      setLoginBusy(false)
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(LOGIN_INTENT_KEY)
    logoutAdmin(redirectUri())
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
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'scanny-admin',
})

// Complete OAuth redirect via check-sso; do not promote ambient SSO into an admin session.
kcInitPromise = adminKeycloak.init({ onLoad: 'check-sso', checkLoginIframe: false })

kcInitPromise
  .then((authenticated) => {
    console.log('[ADMIN] Keycloak init complete - authenticated:', authenticated)
    const hadSession = sessionStorage.getItem(SESSION_KEY) === '1'
    const hadIntent = sessionStorage.getItem(LOGIN_INTENT_KEY) === '1'

    if (authenticated && hasAdminSession() && (hadSession || hadIntent)) {
      sessionStorage.setItem(SESSION_KEY, '1')
      return
    }

    if (!hadIntent) {
      sessionStorage.removeItem(SESSION_KEY)
    }

    if (authenticated && hadIntent && !hasAdminSession()) {
      console.warn('[ADMIN] Signed in without ADMIN realm role / wrong client')
    }
  })
  .catch((err) => {
    console.error('[ADMIN] Keycloak init error:', err)
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(LOGIN_INTENT_KEY)
    kcInitPromise = Promise.resolve(false)
  })
  .finally(() => {
    createRoot(document.getElementById('admin-root')!).render(
      <StrictMode><Root /></StrictMode>
    )
  })
