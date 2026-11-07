import { useEffect, useState, Fragment } from 'react'
import { TrendingUp, TrendingDown, Building2, Ticket, Store, AlertCircle, BookOpen, ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { InlineSpinner } from '../components/LoadingSpinner'
import MonthlyRevenueDonut from '../components/MonthlyRevenueDonut'
import { PaginationBar } from '../components/PaginationBar'
import { usePagination } from '../hooks/usePagination'
import { useRevenue } from '../hooks/usePlatform'
import { adminApi, rentAdminApi, ticketsApi, accountingApi } from '../api/services'
import type {
  RentAccountingSummary,
  CreatedEventSummary,
  RevenueTransaction,
  AccountingPeriod,
  JournalEntry,
  JournalLine,
  TrialBalance,
  AccountingDashboard,
  PostingFailure,
} from '../api/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ugx(n: number) {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n)
}

function short(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

function pctChange(current: number, prev: number): { label: string; up: boolean } | null {
  if (prev === 0) return null
  const change = ((current - prev) / prev) * 100
  return { label: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`, up: change >= 0 }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon, color, change }: {
  label: string; value: string; sub: string
  icon: React.ReactNode; color: string
  change?: { label: string; up: boolean } | null
}) {
  return (
    <div className="admin-metric-card" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="metric-label">{label}</span>
        <span style={{ color, opacity: 0.7 }}>{icon}</span>
      </div>
      <span className="metric-value" style={{ fontSize: 28, color }}>{value}</span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="metric-sub">{sub}</span>
        {change && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: change.up ? '#16a34a' : '#dc2626' }}>
            {change.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {change.label}
          </span>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ title, desc, color, icon }: { title: string; desc: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </div>
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>{desc}</p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Ledger Accounting (Double-entry journal, periods, trial balance, failures)
// ══════════════════════════════════════════════════════════════════════════════

function LedgerAccounting() {
  const [dashboard, setDashboard] = useState<AccountingDashboard | null>(null)
  const [periods, setPeriods] = useState<AccountingPeriod[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [entriesTotal, setEntriesTotal] = useState(0)
  const [failures, setFailures] = useState<PostingFailure[]>([])
  const [failuresTotal, setFailuresTotal] = useState(0)
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null)
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null)
  const [entryLines, setEntryLines] = useState<Record<number, JournalLine[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [closingPeriod, setClosingPeriod] = useState<string | null>(null)
  const [resolvingFailure, setResolvingFailure] = useState<number | null>(null)

  const [entriesPage, setEntriesPage] = useState(0)
  const [failuresPage, setFailuresPage] = useState(0)
  const pageSize = 20

  const currentPeriod = periods.find(p => p.status === 'OPEN')?.periodLabel ?? dashboard?.currentPeriod

  useEffect(() => {
    loadData()
  }, [entriesPage, failuresPage])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [dash, pers, ents, fails] = await Promise.all([
        accountingApi.getDashboard(),
        accountingApi.getPeriods(),
        accountingApi.getEntries({ page: entriesPage, size: pageSize }),
        accountingApi.getFailures({ status: 'PENDING', page: failuresPage, size: pageSize }),
      ])
      setDashboard(dash)
      setPeriods(pers)
      setEntries(ents.entries)
      setEntriesTotal(ents.total)
      setFailures(fails.failures)
      setFailuresTotal(fails.total)

      // Load trial balance for current period
      if (dash.currentPeriod) {
        const tb = await accountingApi.getTrialBalance(dash.currentPeriod)
        setTrialBalance(tb)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ledger data')
    } finally {
      setLoading(false)
    }
  }

  async function toggleEntry(entryId: number) {
    if (expandedEntry === entryId) {
      setExpandedEntry(null)
      return
    }
    setExpandedEntry(entryId)
    if (!entryLines[entryId]) {
      try {
        const lines = await accountingApi.getLines(entryId)
        setEntryLines(prev => ({ ...prev, [entryId]: lines }))
      } catch (e) {
        console.error('Failed to load entry lines:', e)
      }
    }
  }

  async function handleClosePeriod(label: string) {
    if (!confirm(`Close period ${label}? This is irreversible. All future postings will route to the next open period.`)) return
    setClosingPeriod(label)
    try {
      await accountingApi.closePeriod(label)
      await loadData()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to close period')
    } finally {
      setClosingPeriod(null)
    }
  }

  async function handleResolveFailure(id: number) {
    if (!confirm('Mark this failure as resolved? It will be removed from the pending queue.')) return
    setResolvingFailure(id)
    try {
      await accountingApi.resolveFailure(id)
      await loadData()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to resolve')
    } finally {
      setResolvingFailure(null)
    }
  }

  if (loading) return <InlineSpinner label="Loading accounting ledger…" />
  if (error) return <div style={{ padding: '10px 14px', background: 'oklch(0.96 0.02 30 / 0.15)', borderRadius: 8, color: 'var(--destructive)', fontSize: 13 }}>{error}</div>

  const revenueTotal = (dashboard?.revenueByModule ?? []).reduce((sum, m) => sum + m.revenue, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader
        title="Double-entry Ledger"
        desc="Immutable journal entries, accounting periods, and trial balance"
        color="#8b5cf6"
        icon={<BookOpen size={18} />}
      />

      {/* ── KPIs ── */}
      <div className="admin-metric-grid cols-3">
        <MetricCard
          label="Current period"
          value={dashboard?.currentPeriod ?? '—'}
          sub={dashboard?.periodStatus === 'OPEN' ? 'Open' : dashboard?.periodStatus === 'CLOSED' ? 'Closed' : 'No open period'}
          icon={<BookOpen size={16} />}
          color="#8b5cf6"
        />
        <MetricCard
          label="Pending failures"
          value={String(dashboard?.pendingFailures ?? 0)}
          sub="Dead-letter queue"
          icon={dashboard?.pendingFailures ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          color={dashboard?.pendingFailures ? '#ef4444' : '#10b981'}
        />
        <MetricCard
          label="Revenue (MTD)"
          value={ugx(revenueTotal)}
          sub="All modules"
          icon={<TrendingUp size={16} />}
          color="#8b5cf6"
        />
      </div>

      {/* ── Revenue by module + Trial balance ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        
        {/* Revenue by module */}
        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Revenue by module</h3><p>Month-to-date commission</p></div></div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(dashboard?.revenueByModule ?? []).length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No revenue yet.</p>
            ) : (dashboard?.revenueByModule ?? []).map((m) => (
              <div key={m.module} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--muted)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{m.module}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#8b5cf6' }}>{ugx(m.revenue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trial balance summary */}
        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Trial balance</h3><p>{trialBalance?.periodLabel ?? 'N/A'}</p></div></div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!trialBalance ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No period data yet.</p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--muted)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Total debits</span>
                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{ugx(trialBalance.totalDebits)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--muted)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Total credits</span>
                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{ugx(trialBalance.totalCredits)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', background: trialBalance.balanceStatus === 'BALANCED' ? 'oklch(0.96 0.05 150 / 0.15)' : 'oklch(0.96 0.02 30 / 0.15)', borderRadius: 8, border: `1px solid ${trialBalance.balanceStatus === 'BALANCED' ? 'oklch(0.7 0.2 150 / 0.3)' : 'oklch(0.577 0.245 27 / 0.3)'}` }}>
                  {trialBalance.balanceStatus === 'BALANCED' ? <CheckCircle2 size={14} style={{ color: '#10b981' }} /> : <XCircle size={14} style={{ color: 'var(--destructive)' }} />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: trialBalance.balanceStatus === 'BALANCED' ? '#10b981' : 'var(--destructive)' }}>
                    {trialBalance.balanceStatus}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Accounting periods ── */}
      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Accounting periods</h3><p>Fiscal periods for journal posting</p></div></div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Period', 'Opens', 'Closes', 'Status', 'Closed by', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 16, color: 'var(--muted-foreground)' }}>No periods yet.</td></tr>
              ) : periods.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{p.periodLabel}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)', fontSize: 12 }}>{new Date(p.opensAt).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)', fontSize: 12 }}>{new Date(p.closesAt).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge variant="secondary" className={p.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}>{p.status}</Badge>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)' }}>{p.closedBy ?? '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    {p.status === 'OPEN' && (
                      <button
                        type="button"
                        onClick={() => handleClosePeriod(p.periodLabel)}
                        disabled={closingPeriod === p.periodLabel}
                        style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', cursor: closingPeriod === p.periodLabel ? 'wait' : 'pointer' }}
                      >
                        {closingPeriod === p.periodLabel ? 'Closing…' : 'Close'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Journal entries (expandable) ── */}
      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Journal entries</h3><p>{entriesTotal} posted entries</p></div></div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['', 'ID', 'Date', 'Module', 'Event', 'Description', 'Posted'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 16, color: 'var(--muted-foreground)' }}>No entries yet.</td></tr>
              ) : entries.map((e) => {
                const expanded = expandedEntry === e.id
                const lines = entryLines[e.id] ?? []
                return (
                  <Fragment key={e.id}>
                    <tr style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => toggleEntry(e.id)}>
                      <td style={{ padding: '10px 16px', width: 30 }}>
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>{e.id}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12 }}>{new Date(e.entryDate).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 16px' }}><Badge variant="secondary">{e.sourceModule}</Badge></td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)' }}>{e.sourceEventType}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                      <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--muted-foreground)' }}>{new Date(e.postedAt).toLocaleString()}</td>
                    </tr>
                    {expanded && (
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td colSpan={7} style={{ padding: '10px 16px 16px 60px', background: 'var(--muted)', fontSize: 12 }}>
                          {lines.length === 0 ? (
                            <p style={{ color: 'var(--muted-foreground)' }}>Loading lines…</p>
                          ) : (
                            <table style={{ width: '100%', fontSize: 12 }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                  <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--muted-foreground)' }}>Account</th>
                                  <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--muted-foreground)' }}>Side</th>
                                  <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 10, fontWeight: 500, color: 'var(--muted-foreground)' }}>Amount</th>
                                  <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--muted-foreground)' }}>Memo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lines.map((l) => (
                                  <tr key={l.id}>
                                    <td style={{ padding: '6px 8px' }}>
                                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{l.accountCode}</span>
                                      <span style={{ color: 'var(--muted-foreground)', marginLeft: 6 }}>{l.accountName}</span>
                                    </td>
                                    <td style={{ padding: '6px 8px' }}>
                                      <Badge variant="secondary" className={l.side === 'DEBIT' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}>{l.side}</Badge>
                                    </td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{ugx(l.amount)}</td>
                                    <td style={{ padding: '6px 8px', color: 'var(--muted-foreground)', fontSize: 11 }}>{l.memo ?? '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
          <span style={{ color: 'var(--muted-foreground)' }}>
            Showing {entriesPage * pageSize + 1}–{Math.min((entriesPage + 1) * pageSize, entriesTotal)} of {entriesTotal}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setEntriesPage(p => Math.max(0, p - 1))} disabled={entriesPage === 0} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', cursor: entriesPage === 0 ? 'not-allowed' : 'pointer' }}>Prev</button>
            <button type="button" onClick={() => setEntriesPage(p => p + 1)} disabled={(entriesPage + 1) * pageSize >= entriesTotal} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', cursor: (entriesPage + 1) * pageSize >= entriesTotal ? 'not-allowed' : 'pointer' }}>Next</button>
          </div>
        </div>
      </div>

      {/* ── Dead-letter queue ── */}
      {failures.length > 0 && (
        <div className="admin-card">
          <div className="admin-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} style={{ color: 'var(--destructive)' }} />
              <div>
                <h3>Dead-letter queue</h3>
                <p>{failuresTotal} pending failures</p>
              </div>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['ID', 'Module', 'Event', 'Error', 'Retries', 'Created', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {failures.map((f) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>{f.id}</td>
                    <td style={{ padding: '10px 16px' }}><Badge variant="secondary">{f.sourceModule}</Badge></td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)' }}>{f.sourceEventType}</td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--destructive)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.lastError ?? 'Unknown'}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{f.retryCount}</td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--muted-foreground)' }}>{new Date(f.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <button
                        type="button"
                        onClick={() => handleResolveFailure(f.id)}
                        disabled={resolvingFailure === f.id}
                        style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', cursor: resolvingFailure === f.id ? 'wait' : 'pointer' }}
                      >
                        {resolvingFailure === f.id ? 'Resolving…' : 'Resolve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
            <span style={{ color: 'var(--muted-foreground)' }}>
              Showing {failuresPage * pageSize + 1}–{Math.min((failuresPage + 1) * pageSize, failuresTotal)} of {failuresTotal}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setFailuresPage(p => Math.max(0, p - 1))} disabled={failuresPage === 0} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', cursor: failuresPage === 0 ? 'not-allowed' : 'pointer' }}>Prev</button>
              <button type="button" onClick={() => setFailuresPage(p => p + 1)} disabled={(failuresPage + 1) * pageSize >= failuresTotal} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', cursor: (failuresPage + 1) * pageSize >= failuresTotal ? 'not-allowed' : 'pointer' }}>Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SubTab = 'restaurants' | 'ticketing' | 'properties' | 'ledger'

export default function AccountingPage({ initialTab = 'restaurants' }: { initialTab?: SubTab }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {initialTab === 'restaurants' && <RestaurantsAccounting />}
      {initialTab === 'ticketing'   && <TicketingAccounting />}
      {initialTab === 'properties'  && <PropertiesAccounting />}
      {initialTab === 'ledger'      && <LedgerAccounting />}
    </div>
  )
}

// ── Restaurants Accounting ────────────────────────────────────────────────────

function RestaurantsAccounting() {
  const { overview, transactions, loading, error } = useRevenue()
  const txPagination = usePagination(transactions ?? [], { initialPageSize: 10 })
  const current = overview?.currentMonth
  const monthly = overview?.monthly ?? []

  const STATUS_STYLE: Record<string, string> = {
    Settled: 'bg-emerald-50 text-emerald-700',
    Failed:  'bg-red-50 text-red-600',
    Pending: 'bg-amber-50 text-amber-700',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Restaurants" desc="Revenue, GMV and payment flows from all merchants" color="#3b82f6" icon={<Store size={18} />} />

      {error && <div style={{ padding: '10px 14px', background: 'oklch(0.96 0.02 30 / 0.15)', borderRadius: 8, color: 'var(--destructive)', fontSize: 13 }}>{error}</div>}
      {loading && <InlineSpinner label="Loading restaurant accounting…" />}

      {/* KPI row */}
      <div className="admin-metric-grid">
        <MetricCard label="Revenue (MTD)"    value={ugx(current?.revenue ?? 0)}      sub="Gross merchant revenue" icon={<Store size={16} />}   color="#3b82f6" change={pctChange(current?.revenue ?? 0, (current?.revenue ?? 0) / (1 + (current?.growth.revenue ?? 0) / 100))} />
        <MetricCard label="Merchant GMV"     value={ugx(current?.merchantGmv ?? 0)}  sub="MoMo payments to merchants" icon={<Store size={16} />} color="#3b82f6" />
        <MetricCard label="Platform fees"    value={ugx(current?.platformFees ?? 0)} sub="Koddly service fees" icon={<Store size={16} />}        color="#3b82f6" />
        <MetricCard label="PSO fees"         value={ugx(current?.psoFees ?? 0)}      sub="Payment provider cut" icon={<Store size={16} />}       color="#3b82f6" />
        <MetricCard label="Transactions"     value={String(current?.transactions ?? 0)} sub="Paid orders this month" icon={<Store size={16} />}  color="#3b82f6" change={{ label: `${current?.growth.transactions ?? 0 >= 0 ? '+' : ''}${(current?.growth.transactions ?? 0).toFixed(1)}%`, up: (current?.growth.transactions ?? 0) >= 0 }} />
        <MetricCard label="Failed payments"  value={String(current?.failedPayments ?? 0)} sub="This month" icon={<AlertCircle size={16} />}     color="#ef4444" change={{ label: `${current?.growth.failedPayments ?? 0 >= 0 ? '+' : ''}${(current?.growth.failedPayments ?? 0).toFixed(1)}%`, up: (current?.growth.failedPayments ?? 0) <= 0 }} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Monthly revenue donut */}
        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Monthly Revenue</h3><p>{current?.currency || 'UGX'}</p></div></div>
          <div style={{ padding: '16px 20px' }}>
            <MonthlyRevenueDonut monthly={monthly} currency={current?.currency || 'UGX'} />
          </div>
        </div>

        {/* Payment methods */}
        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Payment methods</h3><p>This month's breakdown</p></div></div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(overview?.paymentMethods ?? []).length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No data yet.</p>
            ) : (
              (overview?.paymentMethods ?? []).map((pm) => (
                <div key={pm.method}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{pm.method}</span>
                    <span style={{ color: 'var(--muted-foreground)' }}>{pm.percentage.toFixed(1)}% · {ugx(pm.amount)}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--muted)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pm.percentage}%`, background: '#3b82f6', borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Transactions table */}
      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Recent transactions</h3><p>All merchant payment transactions</p></div></div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['TXN ID', 'Merchant', 'Amount', 'Method', 'Status', 'Date'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txPagination.pageItems.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '16px', color: 'var(--muted-foreground)' }}>No transactions yet.</td></tr>
              ) : txPagination.pageItems.map((t: RevenueTransaction) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>{t.id}</td>
                  <td style={{ padding: '10px 16px' }}>{t.merchant}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{ugx(t.amount)}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{t.method}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge variant="secondary" className={STATUS_STYLE[t.status] ?? ''}>{t.status}</Badge>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)', fontSize: 12 }}>
                    {new Date(t.date).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={txPagination} hideWhenEmpty={false} />
      </div>
    </div>
  )
}

// ── Ticketing Accounting ──────────────────────────────────────────────────────

function TicketingAccounting() {
  const [events, setEvents] = useState<CreatedEventSummary[]>([])
  const [analytics, setAnalytics] = useState<{ summary: { totalTickets: number; activeTickets: number; redeemedTickets: number; expiredTickets: number }; byType: Array<{ type: string; count: number; revenue: number }> } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      ticketsApi.listCreatedEvents(),
      adminApi.tickets.getAnalytics(),
    ])
      .then(([evs, anal]) => { setEvents(evs); setAnalytics(anal) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const eventsPagination = usePagination(events, { initialPageSize: 10 })

  // Derive financial figures from event data
  const totalSoldRevenue = events.reduce((sum, e) => sum + e.paidTickets * (e.attendeeTickets > 0 ? 0 : 0), 0) // price not available in summary
  const totalSold        = events.reduce((sum, e) => sum + e.paidTickets, 0)
  const totalRedeemed    = events.reduce((sum, e) => sum + e.redeemedTickets, 0)
  const activeEvents     = events.filter(e => e.status === 'ACTIVE').length
  const redemptionRate   = totalSold > 0 ? Math.round((totalRedeemed / totalSold) * 100) : 0

  if (loading) return <InlineSpinner label="Loading ticketing accounting…" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Ticketing" desc="Event sales, ticket redemptions and revenue across all organisers" color="#10b981" icon={<Ticket size={18} />} />

      {/* KPI row */}
      <div className="admin-metric-grid cols-3">
        <MetricCard label="Tickets sold (all time)" value={totalSold.toLocaleString()} sub="Paid tickets across all events" icon={<Ticket size={16} />} color="#10b981" />
        <MetricCard label="Redeemed" value={totalRedeemed.toLocaleString()} sub={`${redemptionRate}% redemption rate`} icon={<Ticket size={16} />} color="#10b981" />
        <MetricCard label="Active events" value={activeEvents.toLocaleString()} sub={`${events.length} total events`} icon={<Ticket size={16} />} color="#10b981" />
      </div>

      {/* By-type breakdown + events table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Ticket type breakdown */}
        <div className="admin-card">
          <div className="admin-card-header"><div><h3>By ticket type</h3><p>Sales and revenue per type</p></div></div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(analytics?.byType ?? []).length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No type breakdown yet.</p>
            ) : (
              (analytics?.byType ?? []).map((t) => (
                <div key={t.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--muted)', borderRadius: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{t.type || 'Standard'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>{t.count.toLocaleString()} tickets</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{ugx(t.revenue)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ticket summary stats */}
        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Platform ticket summary</h3><p>All-time totals</p></div></div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Total tickets issued',    value: analytics?.summary.totalTickets ?? 0 },
              { label: 'Active (not yet scanned)',value: analytics?.summary.activeTickets ?? 0 },
              { label: 'Redeemed (scanned)',       value: analytics?.summary.redeemedTickets ?? 0, color: '#10b981' },
              { label: 'Expired',                  value: analytics?.summary.expiredTickets ?? 0, color: 'var(--muted-foreground)' },
            ].map((s) => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--muted)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{s.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: s.color ?? 'var(--foreground)' }}>{s.value.toLocaleString()}</span>
              </div>
            ))}

            {/* Redemption rate bar */}
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
                <span style={{ color: 'var(--muted-foreground)' }}>Overall redemption rate</span>
                <span style={{ color: '#10b981' }}>{redemptionRate}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${redemptionRate}%`, background: '#10b981', borderRadius: 3, transition: 'width 0.6s' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Events revenue table */}
      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Events breakdown</h3><p>Tickets sold and redeemed per event</p></div></div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Event', 'Date', 'Sold', 'Redeemed', 'Attendees', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eventsPagination.pageItems.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 16, color: 'var(--muted-foreground)' }}>No events yet.</td></tr>
              ) : eventsPagination.pageItems.map((e) => {
                const rate = e.paidTickets > 0 ? Math.round(e.redeemedTickets / e.paidTickets * 100) : 0
                return (
                  <tr key={e.eventId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{e.eventName}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)', fontSize: 12 }}>
                      {e.eventDate ? new Date(e.eventDate).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: '#10b981', fontWeight: 700 }}>{e.paidTickets}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>
                      {e.redeemedTickets}
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 4 }}>({rate}%)</span>
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{e.attendeeTickets}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge variant="secondary" className={e.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                        {e.status}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={eventsPagination} hideWhenEmpty={false} />
      </div>
    </div>
  )
}

// ── Properties Accounting ─────────────────────────────────────────────────────

function PropertiesAccounting() {
  const [data, setData] = useState<RentAccountingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    rentAdminApi.getAccounting()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const propPagination = usePagination(data?.perPropertyRevenue ?? [], { initialPageSize: 10 })
  const mom = pctChange(data?.collectedThisMonth ?? 0, data?.collectedLastMonth ?? 1)

  if (loading) return <InlineSpinner label="Loading properties accounting…" />
  if (error)   return <div style={{ padding: '10px 14px', background: 'oklch(0.96 0.02 30 / 0.15)', borderRadius: 8, color: 'var(--destructive)', fontSize: 13 }}>{error}</div>
  if (!data)   return null

  // Build sparkline-style bar data from perPropertyRevenue
  const topRevProps = [...(data.perPropertyRevenue ?? [])].sort((a, b) => b.totalCollected - a.totalCollected).slice(0, 8)
  const maxRev = Math.max(...topRevProps.map(p => p.totalCollected), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Properties" desc="Rent collections, overdue charges and tenant payments across all properties" color="#f59e0b" icon={<Building2 size={18} />} />

      {/* KPI row */}
      <div className="admin-metric-grid cols-3">
        <MetricCard label="Collected (all time)" value={short(data.totalCollectedAllTime) + ' UGX'} sub="Total rent payments received" icon={<Building2 size={16} />} color="#f59e0b" />
        <MetricCard label="This month" value={short(data.collectedThisMonth) + ' UGX'} sub={data.currentPeriod} icon={<Building2 size={16} />} color="#f59e0b" change={mom} />
        <MetricCard label="Total payments" value={data.totalPayments.toLocaleString()} sub="Completed rent transactions" icon={<Building2 size={16} />} color="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Charge health */}
        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Charge health</h3><p>Current period payment status</p></div></div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Active tenants',   value: data.activeTenants,    color: '#f59e0b' },
              { label: 'Unpaid charges',   value: data.unpaidCharges,    color: 'var(--muted-foreground)' },
              { label: 'Overdue charges',  value: data.overdueCharges,   color: data.overdueCharges > 0 ? 'var(--destructive)' : 'var(--foreground)' },
              { label: 'Properties',       value: data.totalProperties,  color: 'var(--foreground)' },
            ].map((s) => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--muted)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{s.label}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value.toLocaleString()}</span>
              </div>
            ))}

            {/* Overdue alert */}
            {data.overdueCharges > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', background: 'oklch(0.96 0.02 30 / 0.15)', borderRadius: 8, border: '1px solid oklch(0.577 0.245 27 / 0.3)' }}>
                <AlertCircle size={14} style={{ color: 'var(--destructive)', marginTop: 1, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12, color: 'var(--destructive)', lineHeight: 1.5 }}>
                  {data.overdueCharges} overdue charge{data.overdueCharges > 1 ? 's' : ''} across all properties. Review in the Properties section.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Revenue per property bar chart */}
        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Revenue by property</h3><p>All-time collected rent</p></div></div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topRevProps.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No payments yet.</p>
            ) : topRevProps.map((p) => (
              <div key={p.propertyId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', width: 100, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.propertyName}
                </span>
                <div style={{ flex: 1, height: 8, background: 'var(--muted)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(p.totalCollected / maxRev) * 100}%`, background: '#f59e0b', borderRadius: 4, transition: 'width 0.5s ease', minWidth: p.totalCollected > 0 ? 4 : 0 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)', width: 70, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {short(p.totalCollected)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-property detail table */}
      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Per-property revenue</h3><p>All-time rent collected</p></div></div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Property', 'Total collected', 'Share'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {propPagination.pageItems.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 16, color: 'var(--muted-foreground)' }}>No payment data yet.</td></tr>
              ) : propPagination.pageItems.map((p) => {
                const share = data.totalCollectedAllTime > 0 ? Math.round(p.totalCollected / data.totalCollectedAllTime * 100) : 0
                return (
                  <tr key={p.propertyId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{p.propertyName}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#f59e0b' }}>{ugx(p.totalCollected)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60, height: 5, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${share}%`, background: '#f59e0b', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{share}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={propPagination} hideWhenEmpty={false} />
      </div>
    </div>
  )
}
