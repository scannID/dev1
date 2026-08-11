import { useEffect, useState, useCallback } from 'react'
import {
  ShoppingCart, CreditCard, QrCode, Activity,
  TrendingUp, Users, AlertTriangle, ArrowRight,
  RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { adminApi } from '../api/services'
import type {
  MerchantActivitySummary,
  ActivityEntry,
  MerchantOrderRow,
  MerchantPaymentRow,
  MerchantScanRow,
} from '../api/types'
import type { Merchant } from '../api/types'

// ── Helpers ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'activity' | 'orders' | 'payments' | 'scans'

function fmt(isoStr: string) {
  const d = new Date(isoStr)
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(isoStr: string) {
  return new Date(isoStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function currency(n: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency', currency: 'UGX', maximumFractionDigits: 0,
  }).format(n)
}

const STATUS_PILL: Record<string, string> = {
  Paid: 'bg-emerald-50 text-emerald-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  Pending: 'bg-amber-50 text-amber-700',
  PENDING: 'bg-amber-50 text-amber-700',
  Failed: 'bg-red-50 text-red-600',
  FAILED: 'bg-red-50 text-red-600',
  Cancelled: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-muted text-muted-foreground',
  Unpaid: 'bg-amber-50 text-amber-700',
  UNPAID: 'bg-amber-50 text-amber-700',
  Preparing: 'bg-blue-50 text-blue-700',
  Ready: 'bg-indigo-50 text-indigo-700',
  SCANNED: 'bg-sky-50 text-sky-700',
}

const KIND_ICON: Record<string, React.ReactNode> = {
  ORDER:   <ShoppingCart size={14} />,
  PAYMENT: <CreditCard size={14} />,
  SCAN:    <QrCode size={14} />,
  LOGIN:   <Users size={14} />,
  AUDIT:   <Activity size={14} />,
}

const KIND_COLOR: Record<string, string> = {
  ORDER:   'bg-violet-50 text-violet-600',
  PAYMENT: 'bg-emerald-50 text-emerald-600',
  SCAN:    'bg-sky-50 text-sky-600',
  LOGIN:   'bg-amber-50 text-amber-600',
  AUDIT:   'bg-muted text-muted-foreground',
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: accent ? 'var(--primary)' : 'var(--card)',
      color: accent ? 'white' : 'var(--foreground)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 11, opacity: 0.6 }}>{sub}</span>}
    </div>
  )
}

// ── Sub-panels ─────────────────────────────────────────────────────────────

function OverviewTab({ summary, merchantId }: {
  summary: MerchantActivitySummary | null
  merchantId: string
}) {
  if (!summary) return <Skeleton />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Primary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard label="Total Revenue" value={currency(summary.totalRevenue)} sub="Paid orders" accent />
        <StatCard label="Commission Earned" value={currency(summary.totalCommission)} sub="Merchant fee share" />
        <StatCard label="Total Orders" value={summary.totalOrders.toLocaleString()} sub={`${summary.paidOrders} paid`} />
        <StatCard label="Payments" value={summary.totalPayments.toLocaleString()} sub={`${summary.failedPayments} failed`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard label="QR Scans" value={summary.totalScans.toLocaleString()} sub="All time" />
        <StatCard
          label="Success Rate"
          value={summary.totalPayments > 0
            ? `${Math.round(((summary.totalPayments - summary.failedPayments) / summary.totalPayments) * 100)}%`
            : '—'}
          sub="Payment completion"
        />
      </div>
      {/* Failed payment warning */}
      {summary.failedPayments > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 8,
          background: 'oklch(0.97 0.01 30 / 0.5)',
          border: '1px solid oklch(0.577 0.245 27.325 / 0.25)',
          color: 'oklch(0.577 0.245 27.325)', fontSize: 13,
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>{summary.failedPayments} failed payment{summary.failedPayments > 1 ? 's' : ''} recorded for this merchant.</span>
        </div>
      )}
    </div>
  )
}

function ActivityTab({ merchantId }: { merchantId: string }) {
  const [events, setEvents] = useState<ActivityEntry[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await adminApi.merchants.activity(merchantId, p, 30)
      setEvents(res.events)
      setTotalPages(res.pagination.pages)
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  useEffect(() => { void load(page) }, [load, page])

  if (loading && events.length === 0) return <Skeleton />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {events.length === 0 && !loading && (
        <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13, paddingTop: 32 }}>
          No activity recorded yet.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {events.map((e) => (
          <div key={`${e.kind}-${e.id}`} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '10px 0',
            borderBottom: '1px solid var(--border)',
          }}>
            {/* Kind dot */}
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              fontSize: 13,
            }} className={KIND_COLOR[e.kind] ?? 'bg-muted text-muted-foreground'}>
              {KIND_ICON[e.kind]}
            </span>
            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</span>
                {e.amountUgx > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {currency(e.amountUgx)}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '2px 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.detail}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{fmt(e.occurredAt)}</span>
                <Badge variant="secondary" className={STATUS_PILL[e.status] ?? 'bg-muted text-muted-foreground'} style={{ fontSize: 10, padding: '1px 6px' }}>
                  {e.status}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <Paginator page={page} totalPages={totalPages} onChange={(p) => { setPage(p); void load(p) }} />
      )}
    </div>
  )
}

function OrdersTab({ merchantId }: { merchantId: string }) {
  const [rows, setRows] = useState<MerchantOrderRow[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await adminApi.merchants.orders(merchantId, p, 20)
      setRows(res.orders)
      setTotalPages(res.pagination.pages)
      setTotal(res.pagination.total)
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  useEffect(() => { void load(1) }, [load])

  if (loading && rows.length === 0) return <Skeleton />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{total} orders total</p>
      <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Order ID', 'Customer', 'Status', 'Payment', 'Total', 'Payout', 'Date'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 16, color: 'var(--muted-foreground)', textAlign: 'center' }}>No orders yet.</td></tr>
            ) : rows.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11 }}>{o.id}</td>
                <td style={{ padding: '8px 10px' }}>{o.customerName}</td>
                <td style={{ padding: '8px 10px' }}>
                  <Badge variant="secondary" className={STATUS_PILL[o.status] ?? ''} style={{ fontSize: 10 }}>{o.status}</Badge>
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <Badge variant="secondary" className={STATUS_PILL[o.paymentStatus] ?? ''} style={{ fontSize: 10 }}>{o.paymentStatus}</Badge>
                </td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{currency(o.total)}</td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--muted-foreground)' }}>{currency(o.merchantPayout)}</td>
                <td style={{ padding: '8px 10px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{fmtDate(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <Paginator page={page} totalPages={totalPages} onChange={(p) => { setPage(p); void load(p) }} />
      )}
    </div>
  )
}

function PaymentsTab({ merchantId }: { merchantId: string }) {
  const [rows, setRows] = useState<MerchantPaymentRow[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await adminApi.merchants.payments(merchantId, p, 20)
      setRows(res.payments)
      setTotalPages(res.pagination.pages)
      setTotal(res.pagination.total)
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  useEffect(() => { void load(1) }, [load])

  if (loading && rows.length === 0) return <Skeleton />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{total} payment intents total</p>
      <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 580 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['ID', 'Order', 'Provider', 'Status', 'Amount', 'Payout', 'Platform Fee', 'Phone', 'Date'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 16, color: 'var(--muted-foreground)', textAlign: 'center' }}>No payments yet.</td></tr>
            ) : rows.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 10, color: 'var(--muted-foreground)' }}>{p.id.slice(0, 12)}…</td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11 }}>{p.orderId?.slice(0, 12) ?? '—'}</td>
                <td style={{ padding: '8px 10px' }}>{p.provider}</td>
                <td style={{ padding: '8px 10px' }}>
                  <Badge variant="secondary" className={STATUS_PILL[p.status] ?? ''} style={{ fontSize: 10 }}>{p.status}</Badge>
                </td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{currency(p.amount)}</td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{currency(p.merchantPayout)}</td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--muted-foreground)' }}>{currency(p.platformFee)}</td>
                <td style={{ padding: '8px 10px', color: 'var(--muted-foreground)' }}>{p.customerPhone}</td>
                <td style={{ padding: '8px 10px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{fmtDate(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <Paginator page={page} totalPages={totalPages} onChange={(p) => { setPage(p); void load(p) }} />
      )}
    </div>
  )
}

function ScansTab({ merchantId }: { merchantId: string }) {
  const [rows, setRows] = useState<MerchantScanRow[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalScans, setTotalScans] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await adminApi.merchants.scans(merchantId, p, 30)
      setRows(res.scans)
      setTotalPages(res.pagination.pages)
      setTotalScans(res.totalScans)
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  useEffect(() => { void load(1) }, [load])

  if (loading && rows.length === 0) return <Skeleton />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{totalScans.toLocaleString()} total QR scans</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {rows.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13, paddingTop: 32 }}>No scans recorded yet.</p>
        ) : rows.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 0', borderBottom: '1px solid var(--border)', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} className="bg-sky-50 text-sky-600">
                <QrCode size={13} />
              </span>
              <span style={{ fontSize: 13 }}>QR Scanned</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{fmt(s.occurredAt)}</span>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <Paginator page={page} totalPages={totalPages} onChange={(p) => { setPage(p); void load(p) }} />
      )}
    </div>
  )
}

// ── Shared primitives ──────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
      {[80, 60, 90, 50, 70].map((w, i) => (
        <div key={i} style={{
          height: 14, width: `${w}%`, borderRadius: 6,
          background: 'var(--muted)', animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  )
}

function Paginator({ page, totalPages, onChange }: {
  page: number; totalPages: number; onChange: (p: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 4 }}>
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={14} />
      </Button>
      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
        {page} / {totalPages}
      </span>
      <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        <ChevronRight size={14} />
      </Button>
    </div>
  )
}

// ── Main exported component ────────────────────────────────────────────────

export function MerchantActivityPanel({
  merchant,
  open,
  onClose,
}: {
  merchant: Merchant | null
  open: boolean
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [summary, setSummary] = useState<MerchantActivitySummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  // Reset tab and reload summary whenever the merchant changes
  useEffect(() => {
    if (!merchant || !open) return
    setActiveTab('overview')
    setSummary(null)
    setLoadingSummary(true)
    adminApi.merchants.activity(merchant.id, 1, 1)
      .then((res) => setSummary(res.summary))
      .catch(() => {/* keep null — handled in OverviewTab */})
      .finally(() => setLoadingSummary(false))
  }, [merchant?.id, open])

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'overview',  label: 'Overview',  icon: <TrendingUp size={13} /> },
    { id: 'activity',  label: 'Activity',  icon: <Activity size={13} /> },
    { id: 'orders',    label: 'Orders',    icon: <ShoppingCart size={13} /> },
    { id: 'payments',  label: 'Payments',  icon: <CreditCard size={13} /> },
    { id: 'scans',     label: 'Scans',     icon: <QrCode size={13} /> },
  ]

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0"
        style={{ width: '100%', maxWidth: 640 }}
      >
        {/* Header */}
        <SheetHeader style={{ borderBottom: '1px solid var(--border)', padding: '16px 20px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <SheetTitle style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
                {merchant?.name ?? '—'}
              </SheetTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted-foreground)' }}>{merchant?.id}</span>
                {merchant?.type && (
                  <Badge variant="secondary" style={{ fontSize: 10 }}>{merchant.type}</Badge>
                )}
                {merchant?.status && (
                  <Badge variant="secondary" className={
                    merchant.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                    merchant.status === 'suspended' ? 'bg-amber-50 text-amber-700' :
                    merchant.status === 'closed' ? 'bg-red-50 text-red-600' :
                    'bg-muted text-muted-foreground'
                  } style={{ fontSize: 10 }}>
                    {merchant.status.charAt(0).toUpperCase() + merchant.status.slice(1)}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="ghost" size="sm"
              style={{ gap: 4, fontSize: 12 }}
              onClick={() => {
                setSummary(null)
                setActiveTab('overview')
                if (merchant) {
                  setLoadingSummary(true)
                  adminApi.merchants.activity(merchant.id, 1, 1)
                    .then((res) => setSummary(res.summary))
                    .finally(() => setLoadingSummary(false))
                }
              }}
            >
              <RefreshCw size={13} /> Refresh
            </Button>
          </div>
        </SheetHeader>

        {/* Tab bar */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)',
          padding: '0 20px', overflowX: 'auto', flexShrink: 0,
        }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '10px 14px',
                fontSize: 12, fontWeight: activeTab === t.id ? 600 : 400,
                color: activeTab === t.id ? 'var(--primary)' : 'var(--muted-foreground)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -1, whiteSpace: 'nowrap', transition: 'color 0.1s',
              }}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {!merchant ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No merchant selected.</p>
          ) : activeTab === 'overview' ? (
            <OverviewTab summary={summary} merchantId={merchant.id} />
          ) : activeTab === 'activity' ? (
            <ActivityTab merchantId={merchant.id} />
          ) : activeTab === 'orders' ? (
            <OrdersTab merchantId={merchant.id} />
          ) : activeTab === 'payments' ? (
            <PaymentsTab merchantId={merchant.id} />
          ) : (
            <ScansTab merchantId={merchant.id} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
