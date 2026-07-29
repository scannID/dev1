import { api } from './client'
import type { OrderStatus } from './types'

export type StaffRole = 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'WAITER'

export interface OperationsSettings {
  acceptingOrders: boolean
  busyMode: boolean
  busyEtaMinutes: number
  pauseMessage: string
  whatsappNotificationsEnabled: boolean
  whatsappBusinessPhone: string
  dailyDigestEnabled: boolean
  dailyDigestChannel: string
  dailyDigestEmail: string
}

export interface Branch {
  id: string
  merchantId: string
  name: string
  branchLabel: string
  primary: boolean
  address: string
  qrToken: string
  phone: string
  type: string
}

export interface BuildCatalogResult {
  built: boolean
  itemsAdded: number
  existingItems: number
}

export interface StaffMember {
  id: string
  email: string
  displayName: string
  role: StaffRole
  active: boolean
  invitePending: boolean
  createdAt: string
}

export interface BusinessTable {
  id: string
  label: string
  qrToken: string
  scanUrl: string
  active: boolean
}

export interface KitchenOrder {
  id: string
  customerName: string
  customerLocation: string
  customerNote: string
  kitchenNotes: string
  status: OrderStatus
  total: number
  createdAt: string
  tableLabel: string
  items: Array<{ name: string; quantity: number; note: string }>
}

export interface LowStockItem {
  id: string
  name: string
  unitsAvailable: number
  lowStockThreshold: number
  available: boolean
}

export interface PrintReceipt {
  receiptNumber: string
  businessName: string
  orderId: string
  createdAt: string
  total: number
  customerName: string
  customerLocation: string
  items: Array<{ name: string; quantity: number; lineTotal: number }>
  escPosBase64?: string
}

export interface SplitPayment {
  id: string
  splitGroupId: string
  orderId: string
  payerName: string
  payerPhone: string
  amount: number
  paymentStatus: string
}

export interface SplitBillSummary {
  orderId: string
  publicId: string
  businessName: string
  orderTotal: number
  allocatedTotal: number
  remainingTotal: number
  orderPaymentStatus: string
  splits: SplitPayment[]
}

export interface TableSession {
  id: string
  tableId: string
  tableLabel: string
  status: string
  openedAt: string
  orderIds: string[]
  orderTotal: number
  unpaidTotal: number
  paymentStatus: string
}

export interface StaffMeResponse {
  staff: StaffMember
  business: import('./types').Business
  businesses: Array<{ businessId: string; businessName: string }>
}

export const operationsApi = {
  getSettings: (businessId: string) =>
    api.get<{ settings: OperationsSettings }>(`/businesses/${businessId}/operations/settings`).then((r) => r.settings),

  updateSettings: (businessId: string, data: Partial<OperationsSettings>) =>
    api.patch<{ settings: OperationsSettings }>(`/businesses/${businessId}/operations/settings`, data).then((r) => r.settings),

  listBranches: (businessId: string) =>
    api.get<{ branches: Branch[] }>(`/businesses/${businessId}/operations/branches`).then((r) => r.branches),

  createBranch: (businessId: string, data: { name: string; branchLabel: string; address?: string; phone?: string }) =>
    api.post<{ branch: Branch }>(`/businesses/${businessId}/operations/branches`, data).then((r) => r.branch),

  staffMe: (businessId?: string) =>
    api.get<StaffMeResponse>(
      `/auth/staff/me${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ''}`,
    ),

  resendInvite: (businessId: string, staffId: string) =>
    api.post<{ status: string }>(`/businesses/${businessId}/operations/staff/${staffId}/resend-invite`),

  listStaff: (businessId: string) =>
    api.get<{ staff: StaffMember[] }>(`/businesses/${businessId}/operations/staff`).then((r) => r.staff),

  createStaff: (
    businessId: string,
    data: { email: string; displayName: string; role: StaffRole },
  ) => api.post<{ staff: StaffMember }>(`/businesses/${businessId}/operations/staff`, data).then((r) => r.staff),

  listTables: (businessId: string) =>
    api.get<{ tables: BusinessTable[] }>(`/businesses/${businessId}/operations/tables`).then((r) => r.tables),

  createTable: (businessId: string, data: { label: string }) =>
    api.post<{ table: BusinessTable }>(`/businesses/${businessId}/operations/tables`, data).then((r) => r.table),

  listTableSessions: (businessId: string) =>
    api.get<{ sessions: TableSession[] }>(`/businesses/${businessId}/operations/table-sessions`).then((r) => r.sessions),

  closeTableSession: (businessId: string, sessionId: string) =>
    api.post<{ status: string }>(`/businesses/${businessId}/operations/table-sessions/${sessionId}/close`),

  kitchenOrders: (businessId: string) =>
    api.get<{ orders: KitchenOrder[] }>(`/businesses/${businessId}/operations/kitchen/orders`).then((r) => r.orders),

  lowStock: (businessId: string) =>
    api.get<{ items: LowStockItem[] }>(`/businesses/${businessId}/operations/low-stock`).then((r) => r.items),

  printOrder: (businessId: string, orderId: string) =>
    api.get<{ receipt: PrintReceipt }>(`/businesses/${businessId}/operations/orders/${orderId}/print`).then((r) => r.receipt),

  getSplitBill: (businessId: string, orderId: string) =>
    api.get<{ bill: SplitBillSummary }>(`/businesses/${businessId}/operations/orders/${orderId}/splits`).then((r) => r.bill),

  createSplit: (
    businessId: string,
    orderId: string,
    data: { payerName: string; payerPhone?: string; amount: number },
  ) => api.post<{ split: SplitPayment }>(`/businesses/${businessId}/operations/orders/${orderId}/splits`, data).then((r) => r.split),

  createEqualSplits: (businessId: string, orderId: string, data: { parts: number; basePayerName?: string }) =>
    api.post<{ splits: SplitPayment[] }>(`/businesses/${businessId}/operations/orders/${orderId}/splits/equal`, data).then((r) => r.splits),

  markSplitPaid: (businessId: string, orderId: string, splitId: string) =>
    api.post<{ split: SplitPayment }>(
      `/businesses/${businessId}/operations/orders/${orderId}/splits/${splitId}/mark-paid`,
    ).then((r) => r.split),

  clearUnpaidSplits: (businessId: string, orderId: string) =>
    api.delete<{ cleared: number }>(`/businesses/${businessId}/operations/orders/${orderId}/splits`).then((r) => r.cleared),

  deleteSplit: (businessId: string, orderId: string, splitId: string) =>
    api.delete<{ status: string }>(`/businesses/${businessId}/operations/orders/${orderId}/splits/${splitId}`),

  updateKitchenStatus: (businessId: string, orderId: string, status: OrderStatus) =>
    api.patch<{ order: { id: string; status: OrderStatus } }>(
      `/businesses/${businessId}/operations/kitchen/orders/${orderId}/status`,
      { status },
    ).then((r) => r.order),

  updateReservation: (
    businessId: string,
    reservationId: string,
    data: { status?: string; note?: string; partySize?: number; reservedAt?: string },
  ) =>
    api.patch<{ reservation: unknown }>(`/businesses/${businessId}/operations/reservations/${reservationId}`, data),

  exportCatalogCsv: (businessId: string) =>
    api.getText(`/businesses/${businessId}/operations/catalog/export.csv`),

  importCatalogCsv: (businessId: string, csv: string) =>
    api.post<{ imported: number }>(`/businesses/${businessId}/operations/catalog/import.csv`, csv, {
      headers: { 'Content-Type': 'text/plain' },
    }),

  buildCatalog: (businessId: string) =>
    api.post<{ result: BuildCatalogResult }>(`/businesses/${businessId}/operations/catalog/build`, {}).then((r) => r.result),

  publicStatus: (businessId: string) =>
    api.getPublic<{
      acceptingOrders: boolean
      busyMode: boolean
      busyEtaMinutes: number
      pauseMessage: string
    }>(`/public/businesses/${businessId}/operations-status`),

  getPublicSplitBill: (publicId: string) =>
    api.getPublic<{ bill: SplitBillSummary }>(`/public/orders/${publicId}/splits`).then((r) => r.bill),

  createPublicEqualSplits: (publicId: string, data: { parts: number; basePayerName?: string }) =>
    api
      .postPublic<{ splits: SplitPayment[] }>(`/public/orders/${publicId}/splits/equal`, data)
      .then((r) => r.splits),

  createPublicCustomSplits: (
    publicId: string,
    data: { shares: { payerName: string; payerPhone?: string; amount: number }[] },
  ) =>
    api
      .postPublic<{ splits: SplitPayment[] }>(`/public/orders/${publicId}/splits/custom`, data)
      .then((r) => r.splits),

  submitFeedback: (publicId: string, data: { rating: number; comment?: string; phone: string }) =>
    api.postPublic(`/public/orders/${publicId}/feedback`, data),

  requestHistoryCode: (phone: string) =>
    api.postPublic('/public/customer/history/request-code', { phone }),

  verifyHistory: (phone: string, code: string) =>
    api.postPublic<{
      sessionToken: string
      expiresAt: string
      orders: Array<{
        publicId: string
        businessName: string
        total: number
        status: OrderStatus
        createdAt: string
      }>
    }>('/public/customer/history/verify', { phone, code }),

  listHistory: (sessionToken: string) =>
    api.getPublic<{
      sessionToken: string
      expiresAt: string
      orders: Array<{
        publicId: string
        businessName: string
        total: number
        status: OrderStatus
        createdAt: string
      }>
    }>('/public/customer/history', {
      headers: { 'X-Customer-Session': sessionToken },
    }),
}

