// API Client for Scanny Backend
// Attaches Keycloak JWT when available

import keycloak from '../keycloak'

/** Use same host as the page (works on phone via LAN IP, not only localhost). */
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

  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(30)
    } catch {
      // Keep using the current token when refresh is not needed yet.
    }
    if (keycloak.token) {
      headers.Authorization = `Bearer ${keycloak.token}`
    }
  }

  return headers
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
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
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0
    )
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

  delete: <T>(endpoint: string) =>
    fetchApi<T>(endpoint, {
      method: 'DELETE',
    }),
}

export { API_BASE_URL }
