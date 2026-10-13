import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import scannyApi from '../api/services'
import type {
  AccountingSummary,
  AccountingLedgerResponse,
  AccountingDailyRevenueSeries,
} from '../api/types'
import { currency } from '../customer/utils'

/* ─── Constants ──────────────────────────────────────────────────────────── */

const FONT = "'Outfit Variable', ui-sans-serif, system-ui, sans-serif"
const PAGE_SIZE = 50

type DateRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom'
type PayFilter = 'all' | 'PAYMENT' | 'REFUND'

const RANGES: { key: DateRange; label: string }[] = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'Last 7 days' },
  { key: 'month',   label: 'This month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'year',    label: 'This year' },
  { key: 'all',     label: 'All time' },
  { key: 'custom',  label: 'Custom…' },
]

/* ─── Date helpers ───────────────────────────────────────────────────────── */

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function rangeToFromTo(range: DateRange, customFrom: string, customTo: string): [string | undefined, string | undefined] {
  const now = new Date()
  const today = toIsoDate(now)

  if (range === 'all')    return [undefined, undefined]
  if (range === 'custom') return [customFrom || undefined, customTo || undefined]
  if (range === 'today')  return [today, today]

  if (range === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 6)
    return [toIsoDate(d), today]
  }
  if (range === 'month') {
    return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, today]
  }
  if (range === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    const qStart = new Date(now.getFullYear(), q * 3, 1)
    return [toIsoDate(qStart), today]
  }
  if (range === 'year') {
    return [`${now.getFullYear()}-01-01`, today]
  }
  return [undefined, undefined]
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleString('en-UG', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function pct(value: number) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

/* ─── Sparkline ──────────────────────────────────────────────────────────── */

function MiniSpark({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data)
  const range = max - min || 1
  const W = 80, H = 28, PAD = 3
  const pts: [number, number][] = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - ((v - min) / range) * (H - PAD * 2) - PAD,
  ])
  let line = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1][0] + pts[i][0]) / 2
    line += ` C${mx},${pts[i - 1][1]} ${mx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`
  }
  const last = pts[pts.length - 1], first = pts[0]
  const area = `${line} L${last[0]},${H} L${first[0]},${H} Z`
  const id = `acc-sp-${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─── KPI card ───────────────────────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  sub,
  color,
  spark,
  up,
}: {
  label: string
  value: string
  sub?: string
  color: string
  spark?: number[]
  up?: boolean
}) {
  return (
    <div className="sales-metric-card">
      <div className="sales-metric-top">
        <span className="sales-metric-label">{label}</span>
        {up !== undefined && (
          <span className="sales-metric-trend" style={{ color: up ? '#059669' : '#dc2626' }}>
            {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          </span>
        )}
      </div>
      <strong className="sales-metric-value" style={{ color }}>{value}</strong>
      {sub ? <p className="sales-metric-sub">{sub}</p> : null}
      {spark ? <MiniSpark data={spark} color={color} /> : null}
    </div>
  )
}

/* ─── Progress bar ───────────────────────────────────────────────────────── */

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pctVal = total > 0 ? (value / total) * 100 : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
        <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{label}</span>
        <span style={{ color: 'var(--muted-foreground)' }}>
          {currency(value)} · {pctVal.toFixed(0)}%
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--muted)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pctVal}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

/* ─── CSV export (now server-streamed via /export endpoint) ──────────────── */
// exportCSV removed — use scannyApi.accounting.triggerCsvExport() instead

/* ─── Payment badge ──────────────────────────────────────────────────────── */

function PayBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    PAYMENT:  { bg: 'oklch(0.97 0.04 145)', color: '#059669' },
    Paid:     { bg: 'oklch(0.97 0.04 145)', color: '#059669' },
    REFUND:   { bg: 'oklch(0.97 0.04 30)',  color: '#dc2626' },
    Refunded: { bg: 'var(--muted)',          color: 'var(--muted-foreground)' },
    Unpaid:   { bg: 'oklch(0.97 0.06 75)',  color: '#b45309' },
  }
  const s = styles[status] ?? styles['Unpaid']
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
      background: s.bg, color: s.color,
    }}>
      {status}
    </span>
  )
}

/* ─── Status badge ───────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    Completed:  { bg: 'oklch(0.97 0.04 145)', color: '#059669' },
    Cancelled:  { bg: 'oklch(0.97 0.04 30)',  color: '#dc2626' },
    Pending:    { bg: 'oklch(0.97 0.06 75)',  color: '#b45309' },
    Preparing:  { bg: 'oklch(0.96 0.03 250)', color: '#3b82f6' },
    Ready:      { bg: 'oklch(0.96 0.03 290)', color: '#8b5cf6' },
  }
  const s = styles[status] ?? styles['Pending']
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
      background: s.bg, color: s.color,
    }}>
      {status}
    </span>
  )
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export function AccountingPage({ businessId }: { businessId: string }) {
  // ── Range state ──
  const [range, setRange]           = useState<DateRange>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')

  // ── Server data ──
  const [summary, setSummary]       = useState<AccountingSummary | null>(null)
  const [ledger, setLedger]         = useState<AccountingLedgerResponse | null>(null)
  const [series, setSeries]         = useState<AccountingDailyRevenueSeries | null>(null)

  // ── UI state ──
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [ledgerLoading, setLedgerLoading]   = useState(false)
  const [summaryError, setSummaryError]     = useState<string | null>(null)
  const [ledgerError, setLedgerError]       = useState<string | null>(null)
  const [payFilter, setPayFilter]           = useState<PayFilter>('all')
  const [ledgerPage, setLedgerPage]         = useState(0)   // 0-indexed

  /* Compute from/to strings for the current range */
  const [fromStr, toStr] = rangeToFromTo(range, customFrom, customTo)
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? range

  /* ── Fetch summary + series ── */
  const fetchSummary = useCallback(async () => {
    if (!businessId) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const sum = await scannyApi.accounting.getSummary(businessId, fromStr, toStr, tz)
      setSummary(sum)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to load summary')
    } finally {
      setSummaryLoading(false)
    }
    // Fetch daily-revenue series (non-critical sparkline) — fail silently
    try {
      const srv = await scannyApi.accounting.getDailyRevenue(businessId, 30, tz)
      setSeries(srv)
    } catch {
      // chart just won't render — not worth surfacing an error for
    }
  }, [businessId, fromStr, toStr])

  /* ── Fetch ledger page ── */
  const fetchLedger = useCallback(async () => {
    if (!businessId) return
    setLedgerLoading(true)
    setLedgerError(null)
    try {
      const result = await scannyApi.accounting.getLedger(businessId, {
        from: fromStr,
        to: toStr,
        entryType: payFilter === 'all' ? undefined : payFilter,
        page: ledgerPage,
        size: PAGE_SIZE,
      })
      setLedger(result)
    } catch (err) {
      setLedgerError(err instanceof Error ? err.message : 'Failed to load ledger')
    } finally {
      setLedgerLoading(false)
    }
  }, [businessId, fromStr, toStr, payFilter, ledgerPage])

  /* Reset page when filters change */
  useEffect(() => { setLedgerPage(0) }, [businessId, fromStr, toStr, payFilter])

  useEffect(() => { void fetchSummary() }, [fetchSummary])
  useEffect(() => { void fetchLedger()  }, [fetchLedger])

  /* ── Export: stream directly via browser download ── */
  function handleExport() {
    scannyApi.accounting.triggerCsvExport(businessId, fromStr, toStr)
  }

  /* ── Derived ── */
  const totalLedgerPages = ledger ? Math.max(1, ledger.totalPages) : 1
  const canPrev = ledgerPage > 0
  const canNext = ledgerPage < totalLedgerPages - 1

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: FONT }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wallet size={20} style={{ color: 'var(--muted-foreground)' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>Accounting</h2>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>
              Revenue, fees, and financial ledger
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outline" size="sm" className="h-8 gap-1.5"
            onClick={() => { void fetchSummary(); void fetchLedger() }}
            disabled={summaryLoading || ledgerLoading}
          >
            <RefreshCw size={13} className={summaryLoading || ledgerLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button
            variant="outline" size="sm" className="h-8 gap-1.5"
            onClick={() => void handleExport()}
          >
            <ArrowDownToLine size={13} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Range tabs ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="range-tabs" aria-label="Accounting range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={range === r.key ? 'active' : ''}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              From
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{
                  marginLeft: 6, padding: '4px 8px', fontSize: 12, borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--background)',
                  color: 'var(--foreground)',
                }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              To
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{
                  marginLeft: 6, padding: '4px 8px', fontSize: 12, borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--background)',
                  color: 'var(--foreground)',
                }}
              />
            </label>
          </div>
        )}
      </div>

      {/* ── Summary error ── */}
      {summaryError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          background: 'oklch(0.97 0.04 30)', border: '1px solid oklch(0.88 0.08 30)',
          borderRadius: 8, fontSize: 13, color: '#b91c1c',
        }}>
          <AlertCircle size={15} />
          {summaryError}
        </div>
      )}

      {/* ── KPI cards ── */}
      {summaryLoading && !summary ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
        </div>
      ) : summary ? (
        <>
          <div className="sales-metric-grid">
            <KpiCard
              label="NET REVENUE"
              value={currency(summary.netRevenue)}
              sub="Merchant payout"
              color="#10b981"
              spark={series?.netRevenue}
            />
            <KpiCard
              label="GROSS BILLED"
              value={currency(summary.grossRevenue)}
              sub="Incl. service fees"
              color="#3b82f6"
            />
            <KpiCard
              label="COGS"
              value={currency(summary.totalCogs)}
              sub="Recipe cost"
              color="#b45309"
            />
            <KpiCard
              label="GROSS PROFIT"
              value={currency(summary.grossProfit)}
              sub={`Margin ${summary.marginPercent.toFixed(1)}%`}
              color={summary.grossProfit >= 0 ? '#059669' : '#dc2626'}
              up={summary.grossProfit >= 0}
            />
            <KpiCard
              label="OUTSTANDING"
              value={currency(summary.outstandingRevenue)}
              sub={`${summary.unpaidOrderCount} unpaid orders`}
              color="#f59e0b"
            />
            <KpiCard
              label="SERVICE FEES"
              value={currency(summary.totalServiceFees)}
              sub={`PSO ${currency(summary.totalPsoFees)} · Platform ${currency(summary.totalPlatformFees)}`}
              color="#8b5cf6"
            />
            <KpiCard
              label="MOMO REVENUE"
              value={currency(summary.momoNetRevenue)}
              sub={`${summary.momoOrderCount} orders`}
              color="#6366f1"
            />
            <KpiCard
              label="CASH REVENUE"
              value={currency(summary.cashNetRevenue)}
              sub={`${summary.cashOrderCount} orders`}
              color="#64748b"
            />
            <KpiCard
              label="PAID ORDERS"
              value={String(summary.paidOrderCount)}
              sub={`of ${summary.totalOrderCount} total`}
              color="#10b981"
              spark={series?.orderCount}
            />
          </div>

          {/* ── Two-col breakdown ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Revenue breakdown */}
            <div className="sales-card">
              <div className="sales-card-head">
                <h3>Revenue Breakdown</h3>
                <span>{currency(summary.grossRevenue)} gross</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px' }}>
                <ProgressBar
                  label="Net to Merchant"
                  value={summary.netRevenue}
                  total={summary.grossRevenue}
                  color="#10b981"
                />
                <ProgressBar
                  label="Service Fees"
                  value={summary.totalServiceFees}
                  total={summary.grossRevenue}
                  color="#8b5cf6"
                />
                <ProgressBar
                  label="COGS"
                  value={summary.totalCogs}
                  total={summary.netRevenue || 1}
                  color="#b45309"
                />
                <ProgressBar
                  label="Gross Profit"
                  value={Math.max(0, summary.grossProfit)}
                  total={summary.netRevenue || 1}
                  color="#059669"
                />
              </div>
            </div>

            {/* Fee split */}
            <div className="sales-card">
              <div className="sales-card-head">
                <h3>Fee Distribution</h3>
                <span>{currency(summary.totalServiceFees)} total fees</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px' }}>
                <ProgressBar
                  label="PSO (MoMo provider)"
                  value={summary.totalPsoFees}
                  total={summary.totalServiceFees || 1}
                  color="#f59e0b"
                />
                <ProgressBar
                  label="Platform (Scanny)"
                  value={summary.totalPlatformFees}
                  total={summary.totalServiceFees || 1}
                  color="#6366f1"
                />
                <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { label: 'Paid orders',    val: summary.paidOrderCount,     color: '#10b981' },
                      { label: 'Unpaid orders',  val: summary.unpaidOrderCount,   color: '#f59e0b' },
                      { label: 'Refunded orders',val: summary.refundedOrderCount, color: '#64748b' },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                          {label}
                        </span>
                        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{val}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Daily revenue sparkline card ── */}
          {series && series.netRevenue.some((v) => v > 0) && (
            <div className="sales-card">
              <div className="sales-card-head">
                <h3>Daily Net Revenue (last 30 days)</h3>
                <span>{series.labels[0]} – {series.labels[series.labels.length - 1]}</span>
              </div>
              <div style={{ padding: '12px 16px', overflowX: 'auto' }}>
                <svg
                  viewBox={`0 0 ${series.labels.length * 24} 60`}
                  style={{ width: '100%', minWidth: series.labels.length * 24, height: 60 }}
                  aria-label="Daily net revenue chart"
                >
                  {(() => {
                    const data = series.netRevenue
                    const max = Math.max(...data, 1)
                    const W = series.labels.length * 24
                    const H = 60
                    const PAD = 4
                    const pts: [number, number][] = data.map((v, i) => [
                      (i / (data.length - 1)) * (W - PAD * 2) + PAD,
                      H - (v / max) * (H - PAD * 2) - PAD,
                    ])
                    let line = `M${pts[0][0]},${pts[0][1]}`
                    for (let i = 1; i < pts.length; i++) {
                      const mx = (pts[i - 1][0] + pts[i][0]) / 2
                      line += ` C${mx},${pts[i - 1][1]} ${mx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`
                    }
                    const area = `${line} L${pts[pts.length-1][0]},${H} L${pts[0][0]},${H} Z`
                    return (
                      <>
                        <defs>
                          <linearGradient id="acc-daily-fill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={area} fill="url(#acc-daily-fill)" />
                        <path d={line} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    )
                  })()}
                </svg>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* ── Ledger ── */}
      <div className="sales-card" style={{ overflow: 'hidden' }}>
        <div className="sales-card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3>Transaction Ledger</h3>
            {ledger && <span>{ledger.totalEntries} entries</span>}
          </div>

          {/* Payment status filter */}
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            {(['all', 'PAYMENT', 'REFUND'] as PayFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setPayFilter(f)}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20,
                  border: '1px solid var(--border)',
                  background: payFilter === f ? 'var(--foreground)' : 'var(--card)',
                  color: payFilter === f ? 'var(--background)' : 'var(--foreground)',
                  cursor: 'pointer', fontWeight: payFilter === f ? 600 : 400,
                }}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>

        {/* Ledger error */}
        {ledgerError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
            fontSize: 13, color: '#b91c1c',
          }}>
            <AlertCircle size={14} />
            {ledgerError}
          </div>
        )}

        {ledgerLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Loader2 size={22} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sales-table sales-table--ledger">
              <thead>
                <tr>
                  {['Date', 'Customer', 'Items', 'Method', 'Gross', 'Net', 'COGS', 'Profit', 'Payment', 'Status'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(!ledger || ledger.entries.length === 0) ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--muted-foreground)', fontSize: 13 }}>
                      No transactions found for this period.
                    </td>
                  </tr>
                ) : ledger.entries.map((e) => (
                  <tr key={e.orderId}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--muted-foreground)' }}>{shortDate(e.createdAt)}</td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{e.customerName || '—'}</span>
                      {e.customerPhone ? (
                        <span style={{ display: 'block', fontSize: 10, color: 'var(--muted-foreground)' }}>{e.customerPhone}</span>
                      ) : null}
                    </td>
                    <td style={{ color: 'var(--muted-foreground)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={e.itemsSummary}>
                      {e.itemsSummary || '—'}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                        background: e.paymentMethod === 'CASH' ? 'var(--muted)' : 'oklch(0.96 0.03 265)',
                        color: e.paymentMethod === 'CASH' ? 'var(--muted-foreground)' : '#4f46e5',
                      }}>
                        {e.paymentMethod}
                      </span>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{currency(e.grossAmount)}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', color: '#10b981', fontWeight: 600 }}>{currency(e.netAmount)}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted-foreground)' }}>{currency(e.cogs)}</td>
                    <td style={{
                      fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                      color: e.profit >= 0 ? '#059669' : '#dc2626',
                    }}>
                      {currency(e.profit)}
                    </td>
                    <td><PayBadge status={e.paymentStatus} /></td>
                    <td><StatusBadge status={e.orderStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {ledger && ledger.totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 12,
            color: 'var(--muted-foreground)',
          }}>
            <span>
              Page {ledgerPage + 1} of {totalLedgerPages} · {ledger.totalEntries} entries
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button
                variant="outline" size="sm" className="h-7 px-2"
                disabled={!canPrev || ledgerLoading}
                onClick={() => setLedgerPage((p) => p - 1)}
              >
                <ChevronLeft size={14} />
              </Button>
              <Button
                variant="outline" size="sm" className="h-7 px-2"
                disabled={!canNext || ledgerLoading}
                onClick={() => setLedgerPage((p) => p + 1)}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Fee summary note ── */}
      {summary && (summary.totalPsoFees > 0 || summary.totalPlatformFees > 0) && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start',
          padding: '10px 14px', background: 'var(--muted)', borderRadius: 8, fontSize: 12,
          color: 'var(--muted-foreground)',
        }}>
          <BadgeDollarSign size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            Of the <strong>{currency(summary.totalServiceFees)}</strong> in service fees collected,{' '}
            <strong>{currency(summary.totalPsoFees)}</strong> went to the MoMo payment provider (PSO)
            and <strong>{currency(summary.totalPlatformFees)}</strong> to the Scanny platform.
            Your net revenue of <strong>{currency(summary.netRevenue)}</strong> is what was credited to your MoMo account.
          </span>
        </div>
      )}

    </section>
  )
}
