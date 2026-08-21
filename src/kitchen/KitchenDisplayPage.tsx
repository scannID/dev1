import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { operationsApi, type KitchenOrder } from '../api/operations'
import type { OrderStatus } from '../api/types'
import { Button } from '@/components/ui/button'
import { applyDarkMode, readDarkMode, persistDarkMode } from '../lib/theme'

const STATUS_FLOW: OrderStatus[] = ['Pending', 'Preparing', 'Ready', 'Completed']

const STATUS_META: Record<
  string,
  { label: string; short: string; nextLabel?: string }
> = {
  Pending: { label: 'Pending', short: 'NEW', nextLabel: 'Start' },
  Preparing: { label: 'Preparing', short: 'PREP', nextLabel: 'Ready' },
  Ready: { label: 'Ready', short: 'READY', nextLabel: 'Done' },
  Completed: { label: 'Completed', short: 'DONE' },
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

export function KitchenDisplayPage({ businessId }: { businessId: string }) {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [darkMode, setDarkMode] = useState(() => readDarkMode())
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load kitchen orders')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 4000)
    return () => window.clearInterval(timer)
  }, [load])

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
    try {
      await operationsApi.updateKitchenStatus(businessId, order.id, next)
      toast.success(`${shortId(order.id)} → ${next}`)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update order')
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
          const meta = STATUS_META[order.status] ?? { label: order.status, short: order.status.slice(0, 4).toUpperCase() }
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
                  onClick={() => void advance(order)}
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
    </main>
  )
}

