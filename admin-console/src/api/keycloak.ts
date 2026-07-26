import Keycloak from 'keycloak-js'

const ADMIN_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'scanny-admin'

const adminKeycloak = new Keycloak({
  url: (import.meta.env.VITE_KEYCLOAK_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'scanny',
  clientId: ADMIN_CLIENT_ID,
})

function hasAdminRole(): boolean {
  const roles = (adminKeycloak.tokenParsed?.realm_access as { roles?: string[] } | undefined)?.roles ?? []
  return roles.includes('ADMIN')
}

/** True only for a scanny-admin session that includes the ADMIN realm role. */
export function hasAdminSession() {
  return (
    adminKeycloak.authenticated &&
    adminKeycloak.tokenParsed?.azp === ADMIN_CLIENT_ID &&
    Boolean(adminKeycloak.token) &&
    hasAdminRole()
  )
}

/** End Keycloak SSO (shared across merchant/admin on the same realm). */
export function logoutAdmin(redirectUri: string) {
  if (adminKeycloak.authenticated) {
    return adminKeycloak.logout({ redirectUri })
  }
  window.location.href = adminKeycloak.createLogoutUrl({ redirectUri })
  return Promise.resolve()
}

export { ADMIN_CLIENT_ID }
export default adminKeycloak
