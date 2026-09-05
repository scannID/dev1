import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Moon, Sun, X } from 'lucide-react'
import { toast } from 'sonner'
import { operationsApi, type KitchenOrder } from '../api/operations'
import type { OrderStatus } from '../api/types'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { applyDarkMode, readDarkMode, persistDarkMode } from '../lib/theme'
import { createRealtimeClient } from '../lib/realtime'

const STATUS_FLOW: OrderStatus[] = ['Pending', 'Preparing', 'Ready', 'Completed']

const STATUS_META: Record<
  string,
  { label: string; short: string; nextLabel?: string; color: string }
> = {
  Pending:   { label: 'Pending',   short: 'NEW',  nextLabel: 'Start',  color: '#ef4444' },
  Preparing: { label: 'Preparing', short: 'PREP', nextLabel: 'Ready',  color: '#f59e0b' },
  Ready:     { label: 'Ready',     short: 'READY', nextLabel: 'Done',  color: '#22c55e' },
  Completed: { label: 'Completed', short: 'DONE',                      color: '#64748b' },
}

function nextStatus(current: OrderStatus): OrderStatus | null {
  const idx = STATUS_FLOW.indexOf(current)
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[idx + 1]
}

function shortId(id: string) {
  if (id.length <= 8) return id.toUpperCase()
  return id.slice(-6).toUpperCase()
}

function elapsedLabel(iso: string, nowMs: number) {
  const ms = nowMs - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

function statusClass(status: OrderStatus) {
  return `kds-card--${status.toLowerCase()}`
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

/* ── Order detail sheet ─────────────────────────────────────────────────── */

function OrderDetailSheet({
  order,
  now,
  onClose,
  onAdvance,
  advancing,
}: {
  order: KitchenOrder | null
  now: number
  onClose: () => void
  onAdvance: (order: KitchenOrder) => Promise<void>
  advancing: boolean
}) {
  const next = order ? nextStatus(order.status) : null
  const meta = order ? (STATUS_META[order.status] ?? { label: order.status, short: order.status, color: '#64748b' }) : null

  return (
    <Sheet open={Boolean(order)} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        side="right"
        className="w-full max-w-md flex flex-col gap-0 p-0"
        style={{ background: 'var(--kds-surface, var(--background))', color: 'var(--kds-text, var(--foreground))' }}
      >
        {order && meta ? (
          <>
            {/* ── Header ── */}
            <SheetHeader
              className="flex-row items-center gap-3 border-b px-5 py-4"
              style={{ borderColor: 'var(--kds-border, var(--border))' }}
            >
              {/* status rail accent */}
              <div
                style={{
                  width: 5,
                  alignSelf: 'stretch',
                  borderRadius: 3,
                  background: meta.color,
                  flexShrink: 0,
                }}
              />
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base font-bold leading-tight">
                  #{shortId(order.id)}
                  <span
                    className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      background: `color-mix(in srgb, ${meta.color} 18%, transparent)`,
                      color: meta.color,
                    }}
                  >
                    {meta.short}
                  </span>
                </SheetTitle>
                <SheetDescription className="text-xs mt-0.5" style={{ color: 'var(--kds-text-muted, var(--muted-foreground))' }}>
                  {order.customerName || 'Guest'} · {elapsedLabel(order.createdAt, now)} ago
                </SheetDescription>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ml-auto shrink-0 rounded p-1 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
            </SheetHeader>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 grid gap-5">

              {/* Location / table */}
              {(order.tableLabel || order.customerLocation) && (
                <div className="grid gap-1">
                  <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--kds-text-muted, var(--muted-foreground))' }}>
                    {order.tableLabel ? 'Table' : 'Location'}
                  </p>
                  <p className="text-sm font-semibold">{order.tableLabel || order.customerLocation}</p>
                </div>
              )}

              {/* Items */}
              <div className="grid gap-1.5">
                <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--kds-text-muted, var(--muted-foreground))' }}>
                  Items ({order.items.length})
                </p>
                <ul className="grid gap-2">
                  {order.items.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex gap-3 items-start rounded-lg px-3 py-2.5 text-sm"
                      style={{ background: 'var(--kds-surface-low, var(--muted))', opacity: 1 }}
                    >
                      <span
                        className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-xs font-bold"
                        style={{ background: meta.color + '28', color: meta.color }}
                      >
                        {item.quantity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold leading-snug">{item.name}</p>
                        {item.note && (
                          <p className="text-xs mt-0.5 italic" style={{ color: 'var(--kds-text-muted, var(--muted-foreground))' }}>
                            {item.note}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Customer note */}
              {order.customerNote && (
                <div className="grid gap-1">
                  <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--kds-text-muted, var(--muted-foreground))' }}>
                    Customer note
                  </p>
                  <p
                    className="text-sm rounded-lg px-3 py-2.5 italic"
                    style={{ background: 'color-mix(in srgb, #f59e0b 12%, transparent)', borderLeft: '3px solid #f59e0b' }}
                  >
                    {order.customerNote}
                  </p>
                </div>
              )}

              {/* Kitchen notes */}
              {order.kitchenNotes && (
                <div className="grid gap-1">
                  <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--kds-text-muted, var(--muted-foreground))' }}>
                    Kitchen notes
                  </p>
                  <p
                    className="text-sm rounded-lg px-3 py-2.5"
                    style={{ background: 'color-mix(in srgb, #3b82f6 10%, transparent)', borderLeft: '3px solid #3b82f6' }}
                  >
                    {order.kitchenNotes}
                  </p>
                </div>
              )}

              {/* Total */}
              {order.total > 0 && (
                <div className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold"
                  style={{ background: 'var(--kds-surface-low, var(--muted))' }}
                >
                  <span style={{ color: 'var(--kds-text-muted, var(--muted-foreground))' }}>Order total</span>
                  <span>{formatMoney(order.total)}</span>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid gap-1">
                <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--kds-text-muted, var(--muted-foreground))' }}>
                  Placed
                </p>
                <p className="text-xs" style={{ color: 'var(--kds-text-muted, var(--muted-foreground))' }}>
                  {new Date(order.createdAt).toLocaleString('en-UG', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            </div>

            {/* ── Footer: advance button ── */}
            {next ? (
              <div
                className="border-t px-5 py-4"
                style={{ borderColor: 'var(--kds-border, var(--border))' }}
              >
                <button
                  type="button"
                  className="kds-advance w-full"
                  style={{ borderRadius: 8, padding: '14px', fontSize: 15, fontWeight: 700 }}
                  disabled={advancing}
                  onClick={() => void onAdvance(order)}
                >
                  {advancing ? 'Updating…' : (meta.nextLabel ?? `→ ${next}`)}
                </button>
              </div>
            ) : (
              <div
                className="border-t px-5 py-4 flex items-center justify-center gap-2 text-sm font-semibold"
                style={{ borderColor: 'var(--kds-border, var(--border))', color: '#64748b' }}
              >
                ✓ Completed
              </div>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

/* ── Main page ──────────────────────────────────────────────────────────── */

export function KitchenDisplayPage({ businessId }: { businessId: string }) {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [darkMode, setDarkMode] = useState(() => readDarkMode())
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const seenPending = useRef<Set<string>>(new Set())

  // Keep in sync with theme toggled in other tabs (merchant app)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'scanny-dark-mode') {
        const next = readDarkMode()
        applyDarkMode(next)
        setDarkMode(next)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function toggleTheme() {
    const next = !darkMode
    persistDarkMode(next)
    setDarkMode(next)
  }

  const load = useCallback(async () => {
    try {
      const data = await operationsApi.kitchenOrders(businessId)
      setOrders(data)
      // Keep the selected order's data fresh when it's still open
      setSelectedOrder((prev) => {
        if (!prev) return null
        return data.find((o) => o.id === prev.id) ?? null
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load kitchen orders')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    void load()

    let realtimeClient: { close: () => void } | null = null
    let fallbackTimer: number | null = null
    let unmounted = false

    async function startRealtime() {
      try {
        const keycloak = (await import('../keycloak')).default
        if (unmounted) return
        realtimeClient = createRealtimeClient({
          channels: [`orders:${businessId}`],
          getToken: async () => {
            try {
              await keycloak.updateToken(30)
              return keycloak.token
            } catch {
              return keycloak.token
            }
          },
          poll: load,
          pollIntervalMs: 30000,
          onEvent: (event) => {
            if (event.type?.startsWith('ORDER') || event.type === 'ORDERS_CLEARED') {
              void load()
            }
          },
        })
      } catch {
        if (!unmounted) {
          fallbackTimer = window.setInterval(() => void load(), 4000)
        }
      }
    }

    void startRealtime()

    return () => {
      unmounted = true
      realtimeClient?.close()
      if (fallbackTimer != null) window.clearInterval(fallbackTimer)
    }
  }, [load, businessId])

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(tick)
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [load])

  useEffect(() => {
    const pendingIds = orders.filter((o) => o.status === 'Pending').map((o) => o.id)
    const isNew = pendingIds.some((id) => !seenPending.current.has(id))
    pendingIds.forEach((id) => seenPending.current.add(id))
    if (isNew) audioRef.current?.play().catch(() => {})
  }, [orders])

  const counts = useMemo(() => {
    const base = { Pending: 0, Preparing: 0, Ready: 0, Completed: 0 }
    for (const order of orders) {
      if (order.status in base) base[order.status as keyof typeof base] += 1
    }
    return base
  }, [orders])

  async function advance(order: KitchenOrder) {
    const next = nextStatus(order.status)
    if (!next) return
    setAdvancing(true)
    try {
      await operationsApi.updateKitchenStatus(businessId, order.id, next)
      toast.success(`${shortId(order.id)} → ${next}`)
      await load()
      // Close sheet after final status
      if (next === 'Completed') setSelectedOrder(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update order')
    } finally {
      setAdvancing(false)
    }
  }

  return (
    <main className="kds-shell">
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleR0AOpXa3K9pHgU7mtrdr2keBTua2tyvaR4FO5ra3K9pHgU7mtrcr2keBTua2tyvaR4FO5ra3K9pHgU7mtrcr2keBTua2tyvaR4FO5ra3K9pHgU7mtrcr2keBTua2tyvaR4FO5ra3K9pHgU7mtrcr2keBTua2tyvaR4FO5ra3K9pHgU=" />
      </audio>

      <header className="kds-header">
        <div className="kds-header-left">
          <p className="kds-eyebrow">Kitchen Display</p>
          <h1>Live board</h1>
        </div>
        <div className="kds-legend" aria-label="Status counts">
          {STATUS_FLOW.map((status) => (
            <span key={status} className={`kds-pill kds-pill--${status.toLowerCase()}`}>
              <i />
              {STATUS_META[status].short}
              <b>{counts[status as keyof typeof counts]}</b>
            </span>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        >
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </Button>
      </header>

      {loading ? <p className="kds-loading">Loading orders…</p> : null}

      <div className="kds-board">
        {orders.map((order) => {
          const next = nextStatus(order.status)
          const meta = STATUS_META[order.status] ?? { label: order.status, short: order.status.slice(0, 4).toUpperCase(), color: '#64748b' }
          const place = order.tableLabel || order.customerLocation || ''
          const itemsPreview = order.items
            .slice(0, 3)
            .map((item) => `${item.quantity}× ${item.name}`)
            .join(' · ')
          const extra = order.items.length > 3 ? ` +${order.items.length - 3}` : ''

          return (
            <article
              key={order.id}
              className={`kds-card ${statusClass(order.status)}`}
              title={`${order.customerName}${place ? ` · ${place}` : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedOrder(order)}
            >
              <div className="kds-card-rail" aria-hidden />
              <div className="kds-card-body">
                <div className="kds-card-top">
                  <span className="kds-order-id">#{shortId(order.id)}</span>
                  <span className={`kds-status kds-status--${order.status.toLowerCase()}`}>
                    {meta.short}
                  </span>
                  <span className="kds-age">{elapsedLabel(order.createdAt, now)}</span>
                </div>
                <div className="kds-card-meta">
                  <span className="kds-customer">{order.customerName || 'Guest'}</span>
                  {place ? (
                    <span className="kds-place">
                      <span className="kds-place-label">
                        {order.tableLabel ? 'Table' : 'Loc'}
                      </span>
                      {place}
                    </span>
                  ) : null}
                </div>
                <p className="kds-items">{itemsPreview}{extra}</p>
                {order.customerNote ? (
                  <p className="kds-note">{order.customerNote}</p>
                ) : null}
              </div>
              {next ? (
                <button
                  type="button"
                  className="kds-advance"
                  onClick={(e) => {
                    // Advance without opening the sheet when tapping the button directly
                    e.stopPropagation()
                    void advance(order)
                  }}
                >
                  {meta.nextLabel ?? `→ ${next}`}
                </button>
              ) : (
                <span className="kds-done-mark" aria-label="Completed">✓</span>
              )}
            </article>
          )
        })}
      </div>

      {!loading && orders.length === 0 ? (
        <p className="kds-empty">No active kitchen orders right now.</p>
      ) : null}

      <OrderDetailSheet
        order={selectedOrder}
        now={now}
        onClose={() => setSelectedOrder(null)}
        onAdvance={advance}
        advancing={advancing}
      />
    </main>
  )
}
