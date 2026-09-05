import Keycloak from 'keycloak-js'

const ADMIN_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'scanny-admin'

const adminKeycloak = new Keycloak({
  url: (import.meta.env.VITE_KEYCLOAK_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'scanny',
  clientId: ADMIN_CLIENT_ID,
})

// ─── Silent token refresh ────────────────────────────────────────────────────

let _refreshing = false

function tryRefresh() {
  if (!adminKeycloak.authenticated) return
  if (_refreshing) return
  _refreshing = true

  adminKeycloak.updateToken(70)
    .then(() => { _refreshing = false })
    .catch(() => {
      _refreshing = false
      adminKeycloak.login({ redirectUri: window.location.href })
    })
}

adminKeycloak.onTokenExpired = () => tryRefresh()

adminKeycloak.onAuthRefreshError = () => {
  _refreshing = false
  adminKeycloak.login({ redirectUri: window.location.href })
}

const _interval = window.setInterval(() => tryRefresh(), 60_000)
window.addEventListener('pagehide', () => window.clearInterval(_interval), { once: true })

// ─── Role / session helpers ───────────────────────────────────────────────────

function hasAdminRole(): boolean {
  const roles = (adminKeycloak.tokenParsed?.realm_access as { roles?: string[] } | undefined)?.roles ?? []
  return roles.includes('ADMIN')
}

export function hasAdminSession() {
  return (
    adminKeycloak.authenticated &&
    adminKeycloak.tokenParsed?.azp === ADMIN_CLIENT_ID &&
    Boolean(adminKeycloak.token) &&
    hasAdminRole()
  )
}

export function logoutAdmin(redirectUri: string) {
  adminKeycloak.clearToken()
  window.location.replace(redirectUri)
  return Promise.resolve()
}

export { ADMIN_CLIENT_ID }
export default adminKeycloak
