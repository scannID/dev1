import Keycloak from 'keycloak-js'

const adminKeycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'master',
  clientId: 'superadmin',
})

export default adminKeycloak
