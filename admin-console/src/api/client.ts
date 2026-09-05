// Admin API Client — attaches Keycloak JWT when available

import adminKeycloak from './keycloak'

/** Match page host so admin works on LAN IP, not only localhost. */
function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
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

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (adminKeycloak.authenticated) {
    try {
      await adminKeycloak.updateToken(30)
    } catch {
      // Silent — the onTokenExpired / interval path will handle proactive
      // refresh; the 401 retry below handles any remaining edge case.
    }
    if (adminKeycloak.token) {
      headers.Authorization = `Bearer ${adminKeycloak.token}`
    }
  }

  return headers
}

async function fetchApi<T>(endpoint: string, options?: RequestInit, _retry = true): Promise<T> {
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
      // On 401, force a token refresh and retry once before giving up.
      if (response.status === 401 && _retry && adminKeycloak.authenticated) {
        try {
          await adminKeycloak.updateToken(-1) // -1 = always refresh
        } catch {
          // Refresh token expired — redirect to login cleanly.
          adminKeycloak.login()
          return new Promise(() => {})
        }
        return fetchApi<T>(endpoint, options, false)
      }

      const errorData = (await response.json().catch(() => null)) as {
        message?: string
        error?: string
      } | null
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

    // Retry once on transient network errors that coincide with token refresh.
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

  post: <T>(endpoint: string, data?: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  patch: <T>(endpoint: string, data: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: <T>(endpoint: string) =>
    fetchApi<T>(endpoint, {
      method: 'DELETE',
    }),
}

export { API_BASE_URL }
