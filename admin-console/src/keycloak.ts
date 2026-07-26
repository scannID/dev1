// Re-export the shared Keycloak instance used by login + API client.
export { default, hasAdminSession, logoutAdmin, ADMIN_CLIENT_ID } from './api/keycloak'
