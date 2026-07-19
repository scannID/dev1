// Admin API Client — attaches Keycloak JWT when available

import adminKeycloak from './keycloak'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

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

  try {
    if (adminKeycloak.authenticated) {
      await adminKeycloak.updateToken(30)
      if (adminKeycloak.token) {
        headers.Authorization = `Bearer ${adminKeycloak.token}`
      }
    }
  } catch {
    // Proceed without token for public endpoints
  }

  return headers
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
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
      const errorData = (await response.json().catch(() => null)) as { message?: string } | null
      throw new ApiError(
        errorData?.message || `HTTP ${response.status}: ${response.statusText}`,
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
    throw new ApiError(error instanceof Error ? error.message : 'Network error', 0)
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
