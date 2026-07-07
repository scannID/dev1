import Keycloak from 'keycloak-js'

const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'scanny',
  clientId: 'scanny-client',
})

export default keycloak
