import Keycloak from 'keycloak-js'

const MERCHANT_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'scanny-client'

/**
 * Prod builds set VITE_KEYCLOAK_URL to https://auth.kode.com — always use that.
 * Local/LAN: match the page host on :8080 so phone access via 192.168.x.x still works
 * even when Vite env points at localhost.
 */
function resolveKeycloakUrl(): string {
  const configured = (import.meta.env.VITE_KEYCLOAK_URL as string | undefined)?.replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const isLocalOrLan =
      host === 'localhost' || host === '127.0.0.1' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
    if (isLocalOrLan) {
      if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured
      return `${window.location.protocol}//${host}:8080`
    }
  }
  if (configured) return configured
  return 'http://localhost:8080'
}

const keycloak = new Keycloak({
  url: resolveKeycloakUrl(),
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'scanny',
  clientId: MERCHANT_CLIENT_ID,
})

let initPromise: Promise<boolean> | null = null

export function initKeycloak() {
  if (!initPromise) {
    initPromise = keycloak.init({ onLoad: 'check-sso', checkLoginIframe: false })
  }
  return initPromise
}

export function waitForKeycloak() {
  return initPromise ?? initKeycloak()
}

function hasMerchantRole(): boolean {
  const roles = (keycloak.tokenParsed?.realm_access as { roles?: string[] } | undefined)?.roles ?? []
  return roles.includes('MERCHANT')
}

/** True only for a scanny-client session that includes the MERCHANT realm role. */
export function hasMerchantSession() {
  return (
    keycloak.authenticated &&
    keycloak.tokenParsed?.azp === MERCHANT_CLIENT_ID &&
    Boolean(keycloak.token) &&
    hasMerchantRole()
  )
}

/** End Keycloak SSO (shared across merchant/admin on the same realm). */
export function logoutMerchant(redirectUri: string) {
  if (keycloak.authenticated) {
    return keycloak.logout({ redirectUri })
  }
  window.location.href = keycloak.createLogoutUrl({ redirectUri })
  return Promise.resolve()
}

export { MERCHANT_CLIENT_ID }
export default keycloak
