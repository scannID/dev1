import Keycloak from 'keycloak-js'

const MERCHANT_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'scanny-client'

/** Match Keycloak host to the page host (localhost vs LAN IP). */
function resolveKeycloakUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8080`
  }
  return import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080'
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

export { MERCHANT_CLIENT_ID }
export default keycloak
