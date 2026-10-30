// ── Rent collection — TypeScript types ───────────────────────────────────────
// Mirror of backend RentDtos.java

export interface RentAccount {
  id: string
  name: string
  email: string
  phone: string
  accessKey: string
  createdAt: string
}

export interface RentProperty {
  id: string
  name: string
  address: string
  city: string
  ownerName: string
  ownerMomo: string
  currency: string
  /** IANA time-zone ID, e.g. "Africa/Kampala". */
  timezone: string
  /** Whether tenants may pay less than the full outstanding balance. */
  partialPaymentAllowed: boolean
  /** Minimum partial payment amount (minor units). 0 = no floor. */
  minPaymentAmount: number
  qrToken: string
  qrCodeUrl: string   // /rent/pay/:qrToken
  unitCount: number
  activeTenantsCount: number
  createdAt: string
}

export interface PropertyAccessEntry {
  accountId: string
  accountName: string
  accountEmail: string
  role: 'OWNER' | 'MANAGER' | 'OWNER_MANAGER'
  grantedAt: string
}

export interface RentUnit {
  id: string
  propertyId: string
  unitNumber: string
  floor: string
  monthlyAmount: number
  depositAmount: number
  currency: string
  /** Day of month (1–28) rent is due each period. */
  dueDayOfMonth: number
  /** Days after due date before charge becomes OVERDUE. */
  gracePeriodDays: number
  qrToken: string | null
  qrCodeUrl: string | null
  activeTenant: TenantSummary | null
  createdAt: string
}

export interface TenantSummary {
  id: string
  name: string
  phone: string
  email: string
  payToken: string
  payUrl: string | null
  moveInDate: string | null
  /** ISO date string or null if no fixed lease end date. */
  leaseEnd: string | null
  active: boolean
}

export interface RentCharge {
  id: number
  tenantId: string
  tenantName: string
  unitId: string
  unitNumber: string
  amount: number
  paidAmount: number
  outstandingAmount: number
  currency: string
  periodLabel: string
  dueDate: string
  status: 'UNPAID' | 'PAID' | 'PARTIAL' | 'WAIVED' | 'OVERDUE'
  notes: string | null
  payments: PaymentSummary[]
  createdAt: string
}

export interface PaymentSummary {
  id: number
  transactionRef: string
  amount: number
  currency: string
  paymentMethod: string
  status: 'Pending' | 'Completed' | 'Failed'
  paidAt: string | null
  failedAt: string | null
  failureReason: string | null
  createdAt: string
}

// ── Pay-page context (tenant-facing) ─────────────────────────────────────────

export interface TenantPayContext {
  tokenType: 'property' | 'unit' | 'tenant'
  propertyId: string
  propertyName: string
  ownerName: string
  currency: string
  unitId: string | null
  unitNumber: string | null
  tenantId: string | null
  /** First name only — backend strips the surname. */
  tenantFirstName: string | null
  // ── Charge / balance ───────────────────────────────────────────────────────
  totalRent: number | null
  paidAmount: number | null
  balance: number | null
  periodLabel: string | null
  /** Start date of the current rent cycle (ISO). */
  periodStart: string | null
  /** ISO date string of the charge due date. */
  dueDate: string | null
  daysRemaining: number | null
  chargeStatus: string | null
  // ── Lease ──────────────────────────────────────────────────────────────────
  /** Lease activation date (ISO). */
  tenancyStart: string | null
  /** Lease expiry date (ISO). */
  leaseEnd: string | null
  /** Total lease term in months. */
  leaseTermMonths: number | null
  /** Which month of the lease (1-based, 0 if not yet started). */
  monthNumber: number | null
  /** Days remaining on the whole lease (negative if expired). */
  leaseDaysRemaining: number | null
  // ── Payment config ─────────────────────────────────────────────────────────
  partialPaymentAllowed: boolean
  minPaymentAmount: number
  recentPayments: PaymentSummary[]
  units: UnitPickOption[]
}

export interface UnitPickOption {
  unitId: string
  unitNumber: string
  floor: string
  monthlyAmount: number
  hasActiveTenant: boolean
}

export interface InitiateRentPaymentResponse {
  success: boolean
  message: string
  transactionRef: string
  paymentId: string
  paymentDestination: string
  amount: number
  currency: string
  periodLabel: string
}

/** Returned by GET /api/public/rent/payments/{ref} for frontend polling. */
export interface PaymentStatusResponse {
  transactionRef: string
  /** Pending | Completed | Failed */
  status: 'Pending' | 'Completed' | 'Failed'
  amount: number
  currency: string
  paidAt: string | null
  failedAt: string | null
  failureReason: string | null
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface PortfolioEntry {
  propertyId: string
  propertyName: string
  city: string
  role: 'OWNER' | 'MANAGER' | 'OWNER_MANAGER'
  totalUnits: number
  occupiedUnits: number
  overdueCount: number
  totalCollectedThisMonth: number
  currency: string
}

export interface UnitDashboardRow {
  unit: RentUnit
  currentCharge: RentCharge | null
}

export interface PropertyDashboard {
  property: RentProperty
  currentPeriod: string
  totalUnits: number
  occupiedUnits: number
  paidThisPeriod: number
  unpaidThisPeriod: number
  overdueCount: number
  totalCollectedThisPeriod: number
  units: UnitDashboardRow[]
  recentPayments: PaymentSummary[]
  accessList: PropertyAccessEntry[]
}

// ── Request types ─────────────────────────────────────────────────────────────

export interface CreateAccountRequest {
  name: string
  email: string
  phone?: string
}

export interface CreatePropertyRequest {
  name: string
  address?: string
  city?: string
  ownerName: string
  ownerMomo: string
  ownerEmail?: string
  currency?: string
  /** IANA time-zone ID. Defaults to "Africa/Kampala" if omitted. */
  timezone?: string
  /** Whether tenants may pay a partial amount. Defaults to true. */
  partialPaymentAllowed?: boolean
  /** Minimum partial payment (minor units). 0 = no floor. */
  minPaymentAmount?: number
}

export interface CreateUnitRequest {
  unitNumber: string
  floor?: string
  monthlyAmount: number
  depositAmount?: number
  /** Day of month rent is due (1–28). Defaults to 5 if omitted. */
  dueDayOfMonth?: number
  /** Grace period in days before charge becomes OVERDUE. Defaults to 0. */
  gracePeriodDays?: number
}

export interface CreateTenantRequest {
  name: string
  phone: string
  email?: string
  /** ISO date string — lease activation date. Defaults to today. */
  activationDate?: string
  /** Lease term in months (min 1, default 12). */
  termMonths?: number
  moveInDate?: string
  /** ISO date string — optional fixed lease end date (computed automatically from activationDate + termMonths). */
  leaseEnd?: string
}

export interface GenerateChargesRequest {
  periodLabel: string
  dueDate?: string
}

export interface RegisterRentManagerRequest {
  name: string
  email: string
  phone?: string
  ownerMomo?: string
}

export interface InitiateRentPaymentRequest {
  customerPhone: string
  customerName?: string
  paymentMethod?: string
  /** Amount in minor units. Null / omitted = pay full outstanding balance. */
  amount?: number
}

export interface UpdatePropertyRequest {
  name?: string
  address?: string
  city?: string
  ownerName?: string
  ownerMomo?: string
  currency?: string
  timezone?: string
  partialPaymentAllowed?: boolean
  minPaymentAmount?: number
}

export interface UpdateTenantRequest {
  phone?: string
  email?: string
  /** ISO date string "YYYY-MM-DD" or empty string to clear. */
  leaseEnd?: string
}

// ── Maintenance requests ──────────────────────────────────────────────────────

export interface MaintenanceRequest {
  id: string
  propertyId: string
  propertyName: string
  unitId: string | null
  unitNumber: string | null
  tenantName: string | null
  tenantPhone: string | null
  title: string
  description: string | null
  /** OPEN | IN_PROGRESS | RESOLVED | CLOSED */
  status: string
  submittedAt: string
  resolvedAt: string | null
}

export interface SubmitMaintenanceRequest {
  title: string
  description?: string
  tenantName?: string
  tenantPhone?: string
}
