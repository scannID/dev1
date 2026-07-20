import Keycloak from 'keycloak-js'

const adminKeycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'scanny',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'scanny-admin',
})

export default adminKeycloak
