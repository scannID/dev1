import Keycloak from 'keycloak-js'

const config = {
  url: 'http://localhost:8080',
  realm: 'scanny',
  clientId: 'scanny-admin',
}

console.log('[ADMIN KEYCLOAK] Creating Keycloak instance with config:', config)

const adminKeycloak = new Keycloak(config)

console.log('[ADMIN KEYCLOAK] Instance created:', {
  clientId: adminKeycloak.clientId,
  realm: adminKeycloak.realm,
  authServerUrl: adminKeycloak.authServerUrl
})

export default adminKeycloak
