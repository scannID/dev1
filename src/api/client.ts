// API Client for Scanny Backend
// Attaches Keycloak JWT (merchant or staff) when available

import keycloak from '../keycloak'

const STAFF_BUSINESS_KEY = 'scanny-staff-business-id'

/** Use same host as the page (works on phone via LAN IP, not only localhost). */
function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    // An HTTPS page cannot reach the plain-HTTP backend (mixed content), so stay
    // same-origin and let the dev server proxy / reverse proxy forward it.
    if (protocol === 'https:') return '/api'
    return `${protocol}//${hostname}:4000/api`
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
}

const API_BASE_URL = resolveApiBaseUrl()

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function getStaffBusinessId(): string | null {
  return localStorage.getItem(STAFF_BUSINESS_KEY)
}

export function setStaffBusinessId(businessId: string) {
  localStorage.setItem(STAFF_BUSINESS_KEY, businessId)
}

export function clearStaffSession() {
  localStorage.removeItem(STAFF_BUSINESS_KEY)
  localStorage.removeItem('scanny-staff-session')
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(30)
    } catch {
      // Token refresh failed — the 60 s interval should have kept it alive,
      // so this is likely a genuine session expiry. The 401 retry path in
      // fetchApi will attempt one forced refresh before giving up.
    }
    if (keycloak.token) {
      headers.Authorization = `Bearer ${keycloak.token}`
    }
    const staffBusinessId = getStaffBusinessId()
    if (staffBusinessId) {
      headers['X-Staff-Business'] = staffBusinessId
    }
  }

  return headers
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
  _retry = true,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const authHeaders = await getAuthHeaders()

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders,
        ...options?.headers,
      },
    })

    if (!response.ok) {
      // On a 401 try once to refresh the token and repeat the request.
      // This handles the race where the token expired between the updateToken
      // call above and the server receiving the request.
      if (response.status === 401 && _retry && keycloak.authenticated) {
        try {
          await keycloak.updateToken(-1) // force an immediate refresh
        } catch {
          // Refresh token is expired — redirect to login.
          keycloak.login()
          // Return a pending promise so no further error propagates while
          // the browser navigates away.
          return new Promise(() => {})
        }
        return fetchApi<T>(endpoint, options, false)
      }

      const errorData = await response.json().catch(() => null) as { message?: string; error?: string } | null
      throw new ApiError(
        errorData?.error || errorData?.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      )
    }

    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    // "Failed to fetch" (status 0) can happen when the browser briefly drops
    // the connection during a background token refresh. Retry once after a
    // short pause before surfacing the error to the user.
    const message = error instanceof Error ? error.message : 'Network error'
    if (_retry && (message === 'Failed to fetch' || message === 'NetworkError when attempting to fetch resource.' || message === 'Network request failed')) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      return fetchApi<T>(endpoint, options, false)
    }

    throw new ApiError(message, 0)
  }
}

export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint),

  getText: async (endpoint: string) => {
    const url = `${API_BASE_URL}${endpoint}`
    const authHeaders = await getAuthHeaders()
    const response = await fetch(url, { headers: authHeaders })
    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status}`, response.status)
    }
    return response.text()
  },

  getPublic: <T>(endpoint: string, options?: RequestInit) =>
    fetchApi<T>(endpoint, { ...options, headers: { ...(options?.headers ?? {}) } }),

  postPublic: <T>(endpoint: string, data?: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
      headers: { 'Content-Type': 'application/json' },
    }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    fetchApi<T>(endpoint, {
      method: 'POST',
      body: data !== undefined ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined,
      ...options,
      headers: {
        ...(typeof data === 'string' ? { 'Content-Type': 'text/plain' } : { 'Content-Type': 'application/json' }),
        ...options?.headers,
      },
    }),

  patch: <T>(endpoint: string, data: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  put: <T>(endpoint: string, data: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: <T>(endpoint: string) =>
    fetchApi<T>(endpoint, {
      method: 'DELETE',
    }),
}

export { API_BASE_URL }
