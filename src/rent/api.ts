/**
 * Rent collection API client.
 *
 * Auth strategy:
 *  - rentPublicApi       — no auth (tenant pay page, account creation)
 *  - rentAuthApi         — Bearer token from Keycloak (registration + /me)
 *  - rentDashboardApi    — X-Rent-Access-Key header (property/unit/tenant management)
 *                          will migrate to Bearer when all clients have Keycloak accounts.
 */

import keycloak from '../keycloak'
import type {
  RentAccount,
  RentProperty,
  RentUnit,
  TenantSummary,
  RentCharge,
  PropertyDashboard,
  PortfolioEntry,
  PropertyAccessEntry,
  TenantPayContext,
  InitiateRentPaymentResponse,
  PaymentStatusResponse,
  CreateAccountRequest,
  CreatePropertyRequest,
  CreateUnitRequest,
  CreateTenantRequest,
  GenerateChargesRequest,
  InitiateRentPaymentRequest,
  UpdatePropertyRequest,
  UpdateTenantRequest,
  RegisterRentManagerRequest,
  MaintenanceRequest,
  SubmitMaintenanceRequest,
} from './types'

// ── Base URL ──────────────────────────────────────────────────────────────────

function resolveBase(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (protocol === 'https:') return '/api'
    return `${protocol}//${hostname}:4000/api`
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
}

const BASE = resolveBase()

// ── Access key storage ────────────────────────────────────────────────────────

const ACCESS_KEY_STORAGE = 'scanny-rent-access-key'

export function getRentAccessKey(): string | null {
  try { return localStorage.getItem(ACCESS_KEY_STORAGE) } catch { return null }
}

export function setRentAccessKey(key: string): void {
  try { localStorage.setItem(ACCESS_KEY_STORAGE, key) } catch {}
}

export function clearRentAccessKey(): void {
  try { localStorage.removeItem(ACCESS_KEY_STORAGE) } catch {}
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

class RentApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'RentApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessKey?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  // Prefer Keycloak Bearer token; fall back to legacy access key
  if (keycloak.authenticated && keycloak.token) {
    await keycloak.updateToken(30).catch(() => {})
    if (keycloak.token) headers['Authorization'] = `Bearer ${keycloak.token}`
  } else {
    const key = accessKey ?? getRentAccessKey()
    if (key) headers['X-Rent-Access-Key'] = key
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string; error?: string } | null
    throw new RentApiError(res.status, body?.message ?? body?.error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return {} as T
  return res.json() as Promise<T>
}

function get<T>(path: string, accessKey?: string | null) {
  return request<T>(path, { method: 'GET' }, accessKey)
}

function post<T>(path: string, body?: unknown, accessKey?: string | null) {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }, accessKey)
}

// ── Bearer-token helper (Keycloak) ────────────────────────────────────────────

async function authRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Ensure token is fresh — same pattern as the merchant API client
  await keycloak.updateToken(30).catch(() => {})
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (keycloak.token) headers['Authorization'] = `Bearer ${keycloak.token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string; error?: string } | null
    throw new RentApiError(res.status, body?.message ?? body?.error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return {} as T
  return res.json() as Promise<T>
}

// ── Authenticated auth endpoints (Keycloak Bearer) ────────────────────────────

export const rentAuthApi = {
  /**
   * Public registration — creates a Keycloak user (RENT_MANAGER role) + RentAccount.
   * No token required; the endpoint is permitAll on the backend.
   */
  register: (req: RegisterRentManagerRequest): Promise<RentAccount> =>
    authRequest<RentAccount>('/auth/rent-manager/register', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /**
   * Post-login account resolution — called right after Keycloak redirects back.
   * Requires RENT_MANAGER Bearer token.
   */
  me: (): Promise<RentAccount> =>
    authRequest<RentAccount>('/auth/rent-manager/me'),
}

// ── Public endpoints (no access key) ─────────────────────────────────────────

export const rentPublicApi = {
  /** Create / retrieve a rent account (idempotent by email). */
  createAccount: (req: CreateAccountRequest): Promise<RentAccount> =>
    post('/public/rent/accounts', req),

  /** Resolve a pay-page token into context for the payment form. */
  resolvePayContext: (token: string): Promise<TenantPayContext> =>
    get(`/public/rent/pay/${encodeURIComponent(token)}`),

  /** Submit a maintenance request from the tenant app. */
  submitMaintenance: (
    token: string,
    req: { title: string; description: string; tenantName?: string; tenantPhone?: string },
  ): Promise<MaintenanceRequest> =>
    post(`/public/rent/maintenance/${encodeURIComponent(token)}`, req),

  /** Fetch maintenance requests for the current tenant/unit token. */
  listMyMaintenance: (token: string): Promise<MaintenanceRequest[]> =>
    get(`/public/rent/maintenance/${encodeURIComponent(token)}`),

  /** Initiate a MoMo rent payment. */
  initiatePayment: (
    token: string,
    req: InitiateRentPaymentRequest,
    unitId?: string | null,
    chargeId?: number | null,
  ): Promise<InitiateRentPaymentResponse> => {
    const params = new URLSearchParams()
    if (unitId) params.set('unitId', unitId)
    if (chargeId != null) params.set('chargeId', String(chargeId))
    const qs = params.toString()
    return post(
      `/public/rent/pay/${encodeURIComponent(token)}${qs ? `?${qs}` : ''}`,
      req,
    )
  },

  /**
   * Poll the status of a payment by transaction reference.
   * The frontend calls this after initiating a payment — never trusts
   * a redirect alone.
   */
  pollPaymentStatus: (ref: string): Promise<PaymentStatusResponse> =>
    get(`/public/rent/payments/${encodeURIComponent(ref)}`),
}

// ── Dashboard endpoints (require access key) ──────────────────────────────────

export const rentDashboardApi = {
  getMe: (): Promise<RentAccount> =>
    get('/public/rent/dashboard/me'),

  getPortfolio: (): Promise<PortfolioEntry[]> =>
    get('/public/rent/dashboard/portfolio'),

  createProperty: (req: CreatePropertyRequest): Promise<RentProperty> =>
    post('/public/rent/dashboard/properties', req),

  getPropertyDashboard: (propertyId: string, period?: string): Promise<PropertyDashboard> => {
    const qs = period ? `?period=${encodeURIComponent(period)}` : ''
    return get(`/public/rent/dashboard/properties/${propertyId}${qs}`)
  },

  addUnit: (propertyId: string, req: CreateUnitRequest): Promise<RentUnit> =>
    post(`/public/rent/dashboard/properties/${propertyId}/units`, req),

  updateUnit: (propertyId: string, unitId: string, req: Partial<CreateUnitRequest>): Promise<RentUnit> =>
    post(`/public/rent/dashboard/properties/${propertyId}/units/${unitId}/update`, req),

  updateProperty: (propertyId: string, req: UpdatePropertyRequest): Promise<RentProperty> =>
    post(`/public/rent/dashboard/properties/${propertyId}/update`, req),

  generateChargeForUnit: (propertyId: string, unitId: string, req: GenerateChargesRequest): Promise<RentCharge> =>
    post(`/public/rent/dashboard/properties/${propertyId}/units/${unitId}/charges/generate`, req),

  listUnits: (propertyId: string): Promise<RentUnit[]> =>
    get(`/public/rent/dashboard/properties/${propertyId}/units`),

  addTenant: (propertyId: string, unitId: string, req: CreateTenantRequest): Promise<TenantSummary> =>
    post(`/public/rent/dashboard/properties/${propertyId}/units/${unitId}/tenants`, req),

  deactivateTenant: (propertyId: string, unitId: string, tenantId: string): Promise<void> =>
    post(`/public/rent/dashboard/properties/${propertyId}/units/${unitId}/tenants/${tenantId}/deactivate`),

  updateTenant: (propertyId: string, unitId: string, tenantId: string, req: UpdateTenantRequest): Promise<TenantSummary> =>
    post(`/public/rent/dashboard/properties/${propertyId}/units/${unitId}/tenants/${tenantId}/update`, req),

  grantAccess: (propertyId: string, email: string, role: string): Promise<void> =>
    post(`/public/rent/dashboard/properties/${propertyId}/access`, { email, role }),

  listAccess: (propertyId: string): Promise<PropertyAccessEntry[]> =>
    get(`/public/rent/dashboard/properties/${propertyId}/access`),

  generateCharges: (propertyId: string, req: GenerateChargesRequest): Promise<RentCharge[]> =>
    post(`/public/rent/dashboard/properties/${propertyId}/charges/generate`, req),

  listCharges: (propertyId: string, period?: string): Promise<RentCharge[]> => {
    const qs = period ? `?period=${encodeURIComponent(period)}` : ''
    return get(`/public/rent/dashboard/properties/${propertyId}/charges${qs}`)
  },

  updateChargeStatus: (
    propertyId: string,
    chargeId: number,
    status: string,
    notes?: string,
  ): Promise<RentCharge> =>
    post(`/public/rent/dashboard/properties/${propertyId}/charges/${chargeId}/status`, {
      status,
      notes,
    }),

  /**
   * Regenerates a tenant's personal pay token (invalidates old QR / link).
   */
  regenerateTenantPayToken: (
    propertyId: string,
    unitId: string,
    tenantId: string,
  ): Promise<TenantSummary> =>
    post(`/public/rent/dashboard/properties/${propertyId}/units/${unitId}/tenants/${tenantId}/regenerate-token`),

  /**
   * Regenerates the per-unit QR token, invalidating any previously printed door stickers.
   */
  regenerateUnitQrToken: (propertyId: string, unitId: string): Promise<RentUnit> =>
    post(`/public/rent/dashboard/properties/${propertyId}/units/${unitId}/regenerate-qr`),

  /**
   * Regenerates the property-level QR token (invalidates old printed QR).
   */
  regeneratePropertyQrToken: (propertyId: string): Promise<RentProperty> =>
    post(`/public/rent/dashboard/properties/${propertyId}/regenerate-token`),

  /**
   * Returns the URL for downloading a single unit QR as PNG or SVG.
   * Use this as an <a href> or trigger a fetch+blob download.
   */
  unitQrUrl: (
    propertyId: string,
    unitId: string,
    format: 'png' | 'svg' = 'png',
    size = 300,
  ): string => {
    const key = getRentAccessKey()
    // We can't add a custom header via <a href>, so we do fetch+blob in the
    // helper below. This URL is for reference / programmatic use.
    return `${BASE}/public/rent/dashboard/properties/${encodeURIComponent(propertyId)}/units/${encodeURIComponent(unitId)}/qr?format=${format}&size=${size}`
  },

  /**
   * Triggers a browser download of a single unit QR code (PNG or SVG).
   */
  downloadUnitQr: (
    propertyId: string,
    unitId: string,
    unitNumber: string,
    format: 'png' | 'svg' = 'png',
    size = 300,
  ): void => {
    const key = getRentAccessKey()
    if (!key) return
    void fetch(
      `${BASE}/public/rent/dashboard/properties/${encodeURIComponent(propertyId)}/units/${encodeURIComponent(unitId)}/qr?format=${format}&size=${size}`,
      { headers: { 'X-Rent-Access-Key': key } },
    ).then(async (res) => {
      if (!res.ok) throw new Error(`QR download failed: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `unit-${unitNumber}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    }).catch(() => {})
  },

  /**
   * Triggers a browser download of the bulk PDF QR sheet for a property.
   */
  downloadBulkQrPdf: (propertyId: string, propertyName: string): void => {
    const key = getRentAccessKey()
    if (!key) return
    void fetch(
      `${BASE}/public/rent/dashboard/properties/${encodeURIComponent(propertyId)}/qr-bulk`,
      { headers: { 'X-Rent-Access-Key': key } },
    ).then(async (res) => {
      if (!res.ok) throw new Error(`Bulk QR PDF failed: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${propertyName.replace(/[^a-zA-Z0-9_-]/g, '_')}_QR_codes.pdf`
      a.click()
      URL.revokeObjectURL(url)
    }).catch(() => {})
  },

  /**
   * Triggers a browser CSV download for the given property and period.
   * Uses window.location so the streaming response flows directly to the
   * browser's download manager — same pattern as accounting CSV export.
   */
  triggerCsvExport: (propertyId: string, period?: string): void => {
    const key = getRentAccessKey()
    if (!key) return
    const qs = new URLSearchParams({ 'X-Rent-Access-Key': key })
    if (period) qs.set('period', period)
    // We can't send a custom header via window.location, so append the key
    // as a query param and handle it server-side, OR open via fetch + blob.
    // Using fetch + blob to keep the key in the header (more secure).
    void fetch(
      `${BASE}/public/rent/dashboard/properties/${encodeURIComponent(propertyId)}/export${period ? `?period=${encodeURIComponent(period)}` : ''}`,
      { headers: { 'X-Rent-Access-Key': key } },
    ).then(async (res) => {
      if (!res.ok) throw new Error(`Export failed: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      a.download = match?.[1] ?? `rent-export-${period ?? 'current'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }).catch(() => {})
  },

  /** List all maintenance requests for a property (landlord dashboard). */
  listMaintenance: (propertyId: string): Promise<MaintenanceRequest[]> =>
    get(`/public/rent/dashboard/properties/${encodeURIComponent(propertyId)}/maintenance`),

  /** Update the status of a maintenance request (landlord). */
  updateMaintenanceStatus: (
    propertyId: string,
    requestId: string,
    status: string,
  ): Promise<MaintenanceRequest> =>
    post(
      `/public/rent/dashboard/properties/${encodeURIComponent(propertyId)}/maintenance/${encodeURIComponent(requestId)}/status`,
      { status },
    ),
}
