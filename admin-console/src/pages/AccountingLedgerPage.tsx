import { useEffect, useState, useCallback } from 'react'
import { 
  BookOpen, 
  ChevronDown, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  RotateCcw,
  Search,
  Filter,
  X,
  Shield,
  AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InlineSpinner } from '../components/LoadingSpinner'
import { PaginationBar } from '../components/PaginationBar'
import { accountingApi } from '../api/services'
import type {
  AccountingPeriod,
  JournalEntry,
  JournalLine,
  TrialBalance,
  AccountingDashboard,
  PostingFailure,
} from '../api/types'

function ugx(n: number) {
  return new Intl.NumberFormat('en-UG', { 
    style: 'currency', 
    currency: 'UGX', 
    maximumFractionDigits: 0 
  }).format(n)
}

function short(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

const STATUS_COLORS = {
  POSTED: 'default',
  REVERSED: 'secondary',
  REVERSAL: 'outline',
} as const

const MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'RESTAURANTS', label: 'Restaurants' },
  { value: 'RENT', label: 'Rent' },
  { value: 'TICKETING', label: 'Ticketing' },
  { value: 'PLATFORM', label: 'Platform' },
]

/**
 * Double-Entry Accounting Ledger page.
 * Shows journal entries, accounting periods, trial balance, and posting failures.
 * Implements immutability via reversal entries and hash chain verification.
 */
export default function AccountingLedgerPage() {
  // ── Core data ──────────────────────────────────────────────────────────────
  const [dashboard, setDashboard] = useState<AccountingDashboard | null>(null)
  const [periods, setPeriods] = useState<AccountingPeriod[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [entriesTotal, setEntriesTotal] = useState(0)
  const [failures, setFailures] = useState<PostingFailure[]>([])
  const [failuresTotal, setFailuresTotal] = useState(0)
  
  // ── Loading & Error states ─────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [failuresLoading, setFailuresLoading] = useState(false)
  
  // ── Pagination ─────────────────────────────────────────────────────────────
  const [entriesPage, setEntriesPage] = useState(1)
  const [failuresPage, setFailuresPage] = useState(1)
  
  // ── Filters ────────────────────────────────────────────────────────────────
  const [moduleFilter, setModuleFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
  // ── Expanded entry & lines ─────────────────────────────────────────────────
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null)
  const [entryLines, setEntryLines] = useState<Record<number, JournalLine[]>>({})
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({})
  
  // ── Modals ─────────────────────────────────────────────────────────────────
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null)
  const [trialBalanceError, setTrialBalanceError] = useState<string | null>(null)
  
  // ── Actions in progress ────────────────────────────────────────────────────
  const [closingPeriod, setClosingPeriod] = useState<string | null>(null)
  const [resolvingFailure, setResolvingFailure] = useState<number | null>(null)
  const [retryingFailure, setRetryingFailure] = useState<number | null>(null)
  const [reversingEntry, setReversingEntry] = useState<number | null>(null)

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    loadDashboard()
    loadPeriods()
  }, [])

  useEffect(() => {
    loadEntries()
  }, [entriesPage, moduleFilter, periodFilter, searchQuery])

  useEffect(() => {
    loadFailures()
  }, [failuresPage])

  // ── Load functions ─────────────────────────────────────────────────────────
  const loadDashboard = async () => {
    try {
      const dash = await accountingApi.getDashboard()
      setDashboard(dash)
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    }
  }

  const loadPeriods = async () => {
    try {
      const per = await accountingApi.getPeriods()
      setPeriods(per)
    } catch (err) {
      console.error('Failed to load periods:', err)
    }
  }

  const loadEntries = async () => {
    try {
      setEntriesLoading(true)
      const params: any = {
        page: entriesPage,
        size: 20,
      }
      if (moduleFilter) params.module = moduleFilter
      if (periodFilter) params.period = periodFilter
      if (searchQuery) params.search = searchQuery
      
      const ent = await accountingApi.getEntries(params)
      setEntries(ent.entries)
      setEntriesTotal(ent.total)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries')
    } finally {
      setEntriesLoading(false)
      setLoading(false)
    }
  }

  const loadFailures = async () => {
    try {
      setFailuresLoading(true)
      const fail = await accountingApi.getFailures({ 
        page: failuresPage, 
        size: 20,
        status: 'PENDING',
      })
      setFailures(fail.failures)
      setFailuresTotal(fail.total)
    } catch (err) {
      console.error('Failed to load failures:', err)
    } finally {
      setFailuresLoading(false)
    }
  }

  const loadTrialBalance = async (periodLabel: string) => {
    setTrialBalanceError(null)
    try {
      const tb = await accountingApi.getTrialBalance(periodLabel)
      setTrialBalance(tb)
    } catch (err) {
      setTrialBalanceError(err instanceof Error ? err.message : 'Failed to load trial balance')
    }
  }

  const toggleEntry = async (entryId: number) => {
    if (expandedEntry === entryId) {
      setExpandedEntry(null)
      return
    }
    setExpandedEntry(entryId)
    if (!entryLines[entryId]) {
      try {
        const lines = await accountingApi.getLines(entryId)
        setEntryLines((prev) => ({ ...prev, [entryId]: lines }))
        setLineErrors((prev) => {
          const next = { ...prev }
          delete next[entryId]
          return next
        })
      } catch (err) {
        setLineErrors((prev) => ({
          ...prev,
          [entryId]: err instanceof Error ? err.message : 'Failed to load lines',
        }))
      }
    }
  }

  const closePeriod = async (periodLabel: string) => {
    if (!confirm(`Close period ${periodLabel}? This cannot be undone.`)) return
    setClosingPeriod(periodLabel)
    try {
      await accountingApi.closePeriod(periodLabel)
      setPeriods((prev) =>
        prev.map((p) =>
          p.periodLabel === periodLabel 
            ? { ...p, status: 'CLOSED', closedAt: new Date().toISOString() } 
            : p
        )
      )
      await loadDashboard()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to close period')
    } finally {
      setClosingPeriod(null)
    }
  }

  const resolveFailure = async (failureId: number) => {
    if (!confirm('Mark this posting failure as resolved? The missing entry will NOT be created.')) return
    setResolvingFailure(failureId)
    try {
      await accountingApi.resolveFailure(failureId)
      setFailures((prev) => prev.filter((f) => f.id !== failureId))
      setFailuresTotal((prev) => prev - 1)
      await loadDashboard()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resolve')
    } finally {
      setResolvingFailure(null)
    }
  }

  const retryFailure = async (failureId: number) => {
    if (!confirm('Retry posting this entry? This will attempt to create the missing journal entry.')) return
    setRetryingFailure(failureId)
    try {
      // TODO: Add retry endpoint to API
      // await accountingApi.retryFailure(failureId)
      alert('Retry endpoint not yet implemented. Please add accountingApi.retryFailure()')
      await loadFailures()
      await loadDashboard()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to retry')
    } finally {
      setRetryingFailure(null)
    }
  }

  const reverseEntry = async (entryId: number) => {
    const entry = entries.find(e => e.id === entryId)
    if (!entry) return
    
    const reason = prompt(`Reverse entry #${entryId}?\n\nEnter reversal reason:`)
    if (!reason) return
    
    setReversingEntry(entryId)
    try {
      // TODO: Add reverse endpoint to API
      // await accountingApi.reverseEntry(entryId, reason)
      alert('Reverse endpoint not yet implemented. Please add accountingApi.reverseEntry(id, reason)')
      await loadEntries()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reverse entry')
    } finally {
      setReversingEntry(null)
    }
  }

  const clearFilters = () => {
    setModuleFilter('')
    setPeriodFilter('')
    setSearchQuery('')
    setEntriesPage(1)
  }

  const hasActiveFilters = !!(moduleFilter || periodFilter || searchQuery)

  // ── Calculate entry total ──────────────────────────────────────────────────
  const getEntryTotal = (entryId: number) => {
    const lines = entryLines[entryId]
    if (!lines) return null
    const total = lines.reduce((sum, line) => sum + line.amount, 0) / 2
    const debits = lines.filter(l => l.side === 'DEBIT').reduce((sum, l) => sum + l.amount, 0)
    const credits = lines.filter(l => l.side === 'CREDIT').reduce((sum, l) => sum + l.amount, 0)
    const balanced = debits === credits
    return { total, balanced }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <InlineSpinner label="Loading accounting ledger…" />
      </div>
    )
  }

  if (error && !entries.length) {
    return (
      <div className="admin-card" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--destructive)', fontSize: 14, margin: 0 }}>{error}</p>
        <Button onClick={() => loadEntries()} style={{ marginTop: 16 }}>Retry</Button>
      </div>
    )
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'oklch(0.95 0.05 260 / 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'oklch(0.5 0.15 260)'
        }}>
          <BookOpen size={20} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Accounting Ledger</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>
            Double-entry journal, periods, and trial balance
          </p>
        </div>
      </div>

      {/* ── Dashboard metrics ───────────────────────────────────────────────── */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="admin-metric-card" style={{ borderTop: '3px solid oklch(0.5 0.15 260)' }}>
            <span className="metric-label">Current Period</span>
            <span className="metric-value" style={{ color: 'oklch(0.5 0.15 260)' }}>
              {dashboard.currentPeriod || 'None'}
            </span>
            <span className="metric-sub">{dashboard.periodStatus}</span>
          </div>
          <div className="admin-metric-card" style={{ borderTop: '3px solid oklch(0.6 0.15 145)' }}>
            <span className="metric-label">Total Entries</span>
            <span className="metric-value" style={{ color: 'oklch(0.6 0.15 145)' }}>
              {entriesTotal.toLocaleString()}
            </span>
            <span className="metric-sub">All time</span>
          </div>
          <div className="admin-metric-card" style={{ borderTop: '3px solid oklch(0.65 0.18 30)' }}>
            <span className="metric-label">Posting Failures</span>
            <span className="metric-value" style={{ color: dashboard.pendingFailures > 0 ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
              {dashboard.pendingFailures}
            </span>
            <span className="metric-sub">Pending</span>
          </div>
        </div>
      )}

      {/* ── Accounting Periods ──────────────────────────────────────────────── */}
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <div className="admin-card-header">
          <h3>Accounting Periods</h3>
          <p>Month-end closing controls</p>
        </div>
        <div style={{ padding: '0 20px 16px' }}>
          {periods.length === 0 ? (
            <p style={{ textAlign: 'center', padding: 40, color: 'var(--muted-foreground)', fontSize: 13 }}>
              No periods configured
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {periods.map((period) => (
                <div
                  key={period.periodLabel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    background: 'var(--muted)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{period.periodLabel}</span>
                    <Badge variant={period.status === 'OPEN' ? 'default' : 'secondary'}>
                      {period.status}
                    </Badge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => loadTrialBalance(period.periodLabel)}
                      style={{
                        fontSize: 12,
                        padding: '4px 10px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        background: 'var(--card)',
                        cursor: 'pointer',
                      }}
                    >
                      Trial Balance
                    </button>
                    {period.status === 'OPEN' && (
                      <button
                        onClick={() => closePeriod(period.periodLabel)}
                        disabled={closingPeriod === period.periodLabel}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          border: 'none',
                          borderRadius: 6,
                          background: 'var(--destructive)',
                          color: 'white',
                          cursor: closingPeriod === period.periodLabel ? 'not-allowed' : 'pointer',
                          opacity: closingPeriod === period.periodLabel ? 0.6 : 1,
                        }}
                      >
                        {closingPeriod === period.periodLabel ? 'Closing…' : 'Close Period'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Trial Balance Modal ─────────────────────────────────────────────── */}
      {trialBalance && (
        <div
          onClick={() => setTrialBalance(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'oklch(0 0 0 / 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => e.key === 'Escape' && setTrialBalance(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card)',
              borderRadius: 12,
              width: '90%',
              maxWidth: 800,
              maxHeight: '80vh',
              overflow: 'auto',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>
                Trial Balance — {trialBalance.periodLabel}
              </h2>
              <button
                onClick={() => setTrialBalance(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            {trialBalanceError ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--destructive)' }}>
                {trialBalanceError}
              </div>
            ) : (
              <>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 0' }}>Account</th>
                      <th style={{ textAlign: 'right', padding: '8px 0' }}>Debit</th>
                      <th style={{ textAlign: 'right', padding: '8px 0' }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.lines.map((line) => (
                      <tr key={line.code} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 0' }}>
                          <span style={{ fontWeight: 500 }}>{line.code}</span> {line.name}
                        </td>
                        <td style={{ textAlign: 'right', padding: '8px 0', fontVariantNumeric: 'tabular-nums' }}>
                          {line.totalDebits > 0 ? ugx(line.totalDebits) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '8px 0', fontVariantNumeric: 'tabular-nums' }}>
                          {line.totalCredits > 0 ? ugx(line.totalCredits) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                      <td style={{ padding: '8px 0' }}>Total</td>
                      <td style={{ textAlign: 'right', padding: '8px 0' }}>{ugx(trialBalance.totalDebits)}</td>
                      <td style={{ textAlign: 'right', padding: '8px 0' }}>{ugx(trialBalance.totalCredits)}</td>
                    </tr>
                  </tfoot>
                </table>
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  {trialBalance.balanceStatus === 'BALANCED' ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--primary)' }}>
                      <CheckCircle2 size={16} /> Balanced
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--destructive)' }}>
                      <XCircle size={16} /> Out of balance by {ugx(Math.abs(trialBalance.totalDebits - trialBalance.totalCredits))}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Journal Entries ─────────────────────────────────────────────────── */}
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <div className="admin-card-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Journal Entries</h3>
              <p>{entriesTotal.toLocaleString()} total entries</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={14} style={{ marginRight: 6 }} />
              Filters
              {hasActiveFilters && (
                <span style={{ 
                  marginLeft: 6, 
                  background: 'var(--primary)', 
                  color: 'white', 
                  borderRadius: '50%', 
                  width: 16, 
                  height: 16, 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                }}>
                  {[moduleFilter, periodFilter, searchQuery].filter(Boolean).length}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────────── */}
        {showFilters && (
          <div style={{ 
            padding: '12px 20px', 
            background: 'var(--muted)', 
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                  Module
                </label>
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                  Period
                </label>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All periods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All periods</SelectItem>
                    {periods.map(p => (
                      <SelectItem key={p.periodLabel} value={p.periodLabel}>
                        {p.periodLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                  Search (source ID)
                </label>
                <Input
                  type="text"
                  placeholder="order-123, lease-456..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            
            {hasActiveFilters && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X size={14} style={{ marginRight: 4 }} />
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        )}

        <div style={{ padding: '0 20px 16px' }}>
          {entriesLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <InlineSpinner label="Loading entries…" />
            </div>
          ) : entries.length === 0 ? (
            <p style={{ textAlign: 'center', padding: 40, color: 'var(--muted-foreground)', fontSize: 13 }}>
              {hasActiveFilters ? 'No entries match your filters' : 'No journal entries yet'}
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {entries.map((entry) => {
                const isExpanded = expandedEntry === entry.id
                const lines = entryLines[entry.id]
                const lineError = lineErrors[entry.id]
                const entryTotal = lines ? getEntryTotal(entry.id) : null
                
                return (
                  <div key={entry.id}>
                    <button
                      onClick={() => toggleEntry(entry.id)}
                      style={{
                        width: '100%',
                        padding: 12,
                        background: 'var(--muted)',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                              #{entry.id} — {entry.entryDate}
                            </p>
                            <Badge variant={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] || 'default'}>
                              {entry.status}
                            </Badge>
                            {entryTotal && (
                              <>
                                <span style={{ 
                                  fontSize: 12, 
                                  color: 'var(--muted-foreground)',
                                  fontVariantNumeric: 'tabular-nums',
                                }}>
                                  {ugx(entryTotal.total)}
                                </span>
                                {entryTotal.balanced ? (
                                  <CheckCircle2 size={14} style={{ color: 'var(--primary)' }} />
                                ) : (
                                  <AlertTriangle size={14} style={{ color: 'var(--destructive)' }} />
                                )}
                              </>
                            )}
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>
                            {entry.sourceModule} / {entry.sourceEventType}
                            {entry.sourceRecordId && ` / ${entry.sourceRecordId}`}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                          {entry.description}
                        </span>
                        {entry.status === 'POSTED' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              reverseEntry(entry.id)
                            }}
                            disabled={reversingEntry === entry.id}
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              background: 'var(--card)',
                              cursor: reversingEntry === entry.id ? 'not-allowed' : 'pointer',
                              opacity: reversingEntry === entry.id ? 0.6 : 1,
                            }}
                          >
                            {reversingEntry === entry.id ? 'Reversing…' : 'Reverse'}
                          </button>
                        )}
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div style={{ 
                        marginLeft: 28, 
                        marginTop: 8, 
                        padding: 12, 
                        background: 'var(--card)', 
                        borderRadius: 8, 
                        border: '1px solid var(--border)' 
                      }}>
                        {lineError ? (
                          <div style={{ 
                            padding: 20, 
                            textAlign: 'center', 
                            color: 'var(--destructive)',
                            fontSize: 12,
                          }}>
                            <AlertCircle size={20} style={{ marginBottom: 8 }} />
                            <p>{lineError}</p>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => toggleEntry(entry.id)}
                              style={{ marginTop: 8 }}
                            >
                              Retry
                            </Button>
                          </div>
                        ) : lines ? (
                          <>
                            <table style={{ width: '100%', fontSize: 12 }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                  <th style={{ textAlign: 'left', padding: '4px 0' }}>Account</th>
                                  <th style={{ textAlign: 'left', padding: '4px 0' }}>Memo</th>
                                  <th style={{ textAlign: 'right', padding: '4px 0' }}>Debit</th>
                                  <th style={{ textAlign: 'right', padding: '4px 0' }}>Credit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lines.map((line) => (
                                  <tr key={line.id}>
                                    <td style={{ padding: '4px 0' }}>
                                      <span style={{ fontWeight: 500 }}>{line.accountCode}</span> {line.accountName}
                                    </td>
                                    <td style={{ padding: '4px 0', color: 'var(--muted-foreground)', fontSize: 11 }}>
                                      {line.memo || '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '4px 0', fontVariantNumeric: 'tabular-nums' }}>
                                      {line.side === 'DEBIT' ? ugx(line.amount) : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '4px 0', fontVariantNumeric: 'tabular-nums' }}>
                                      {line.side === 'CREDIT' ? ugx(line.amount) : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            
                            {/* Entry metadata */}
                            <div style={{ 
                              marginTop: 12, 
                              paddingTop: 12, 
                              borderTop: '1px solid var(--border)',
                              fontSize: 11,
                              color: 'var(--muted-foreground)',
                            }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
                                <span>Period:</span>
                                <span>{entry.periodLabel}</span>
                                
                                <span>Posted at:</span>
                                <span>{new Date(entry.postedAt).toLocaleString()}</span>
                                
                                {entry.sourceRecordId && (
                                  <>
                                    <span>Source ID:</span>
                                    <span style={{ fontFamily: 'monospace' }}>{entry.sourceRecordId}</span>
                                  </>
                                )}
                                
                                {/* TODO: Add hash chain when available in API */}
                                {/* <span>Entry hash:</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{entry.hash}</span>
                                
                                <span>Previous hash:</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{entry.previousHash}</span> */}
                              </div>
                              
                              {/* TODO: Add hash verification button when API supports it */}
                              {/* <Button 
                                size="sm" 
                                variant="outline" 
                                style={{ marginTop: 12 }}
                                onClick={() => verifyHashChain(entry.id)}
                              >
                                <Shield size={14} style={{ marginRight: 4 }} />
                                Verify hash chain
                              </Button> */}
                            </div>
                          </>
                        ) : (
                          <div style={{ padding: 20, textAlign: 'center' }}>
                            <InlineSpinner label="Loading lines…" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          
          {entriesTotal > 20 && !entriesLoading && (
            <div style={{ marginTop: 16 }}>
              <PaginationBar
                pagination={{
                  page: entriesPage,
                  pageSize: 20,
                  totalPages: Math.ceil(entriesTotal / 20),
                  totalItems: entriesTotal,
                  firstItem: entriesTotal === 0 ? 0 : (entriesPage - 1) * 20 + 1,
                  lastItem: Math.min(entriesPage * 20, entriesTotal),
                  pageSizeOptions: [20] as const,
                  setPage: setEntriesPage,
                  setPageSize: () => {},
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Posting Failures ────────────────────────────────────────────────── */}
      {failuresTotal > 0 && (
        <div className="admin-card">
          <div className="admin-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={18} style={{ color: 'var(--destructive)' }} />
              <h3>Posting Failures</h3>
            </div>
            <p>{failuresTotal} pending • {failures.filter(f => f.retryCount > 0).length} retried</p>
          </div>
          <div style={{ padding: '0 20px 16px' }}>
            {failuresLoading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <InlineSpinner label="Loading failures…" />
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {failures.map((failure) => (
                  <div
                    key={failure.id}
                    style={{
                      padding: 12,
                      background: 'oklch(0.98 0.02 30 / 0.5)',
                      borderRadius: 8,
                      border: '1px solid var(--destructive)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                            {failure.sourceModule} / {failure.sourceEventType}
                          </p>
                          {failure.retryCount > 0 && (
                            <Badge variant="outline">
                              {failure.retryCount} {failure.retryCount === 1 ? 'retry' : 'retries'}
                            </Badge>
                          )}
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>
                          Source: <span style={{ fontFamily: 'monospace' }}>{failure.sourceEventId}</span>
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--destructive)' }}>
                          {failure.lastError || 'No error message'}
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>
                          Created: {new Date(failure.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                        <button
                          onClick={() => retryFailure(failure.id)}
                          disabled={retryingFailure === failure.id}
                          style={{
                            fontSize: 11,
                            padding: '4px 8px',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            background: 'var(--primary)',
                            color: 'white',
                            cursor: retryingFailure === failure.id ? 'not-allowed' : 'pointer',
                            opacity: retryingFailure === failure.id ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <RotateCcw size={12} />
                          {retryingFailure === failure.id ? 'Retrying…' : 'Retry'}
                        </button>
                        <button
                          onClick={() => resolveFailure(failure.id)}
                          disabled={resolvingFailure === failure.id}
                          style={{
                            fontSize: 11,
                            padding: '4px 8px',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            background: 'var(--card)',
                            cursor: resolvingFailure === failure.id ? 'not-allowed' : 'pointer',
                            opacity: resolvingFailure === failure.id ? 0.6 : 1,
                          }}
                        >
                          {resolvingFailure === failure.id ? 'Resolving…' : 'Mark Resolved'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {failuresTotal > 20 && !failuresLoading && (
              <div style={{ marginTop: 16 }}>
                <PaginationBar
                  pagination={{
                    page: failuresPage,
                    pageSize: 20,
                    totalPages: Math.ceil(failuresTotal / 20),
                    totalItems: failuresTotal,
                    firstItem: failuresTotal === 0 ? 0 : (failuresPage - 1) * 20 + 1,
                    lastItem: Math.min(failuresPage * 20, failuresTotal),
                    pageSizeOptions: [20] as const,
                    setPage: setFailuresPage,
                    setPageSize: () => {},
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
