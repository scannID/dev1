import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Clock, RefreshCw, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ElementStatusSnapshot } from '../api/floorPlan'
import type { EditorElement } from './hooks/useFloorPlanEditor'
import { useFloorPlanLive } from './hooks/useFloorPlanLive'
import { apiToEditor } from './lib/layoutSerializer'
import { FloorPlanCanvas } from './FloorPlanCanvas'
import { getStatusStyle, STATUS_STYLES } from './lib/statusColors'

interface FloorPlanViewerProps {
  businessId: string
  planId: string
  /** Whether the current user can override element status manually */
  canOverrideStatus: boolean
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ElementStatusSnapshot['status'] }) {
  const style = getStatusStyle(status)
  const colors: Record<string, string> = {
    FREE: 'bg-green-100 text-green-800 border-green-200',
    OCCUPIED: 'bg-red-100 text-red-800 border-red-200',
    RESERVED: 'bg-amber-100 text-amber-800 border-amber-200',
    OUT_OF_SERVICE: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      border: `1px solid ${style.stroke}`, background: style.fill + '22', color: style.fill,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: style.fill, flexShrink: 0 }} />
      {STATUS_STYLES[status].label}
    </span>
  )
}

// ─── Detail drawer ─────────────────────────────────────────────────────────────

interface DetailDrawerProps {
  element: EditorElement
  snapshot: ElementStatusSnapshot | undefined
  canOverride: boolean
  onClose: () => void
  onSetStatus: (elementId: string, status: ElementStatusSnapshot['status']) => Promise<void>
}

function ElementDetailDrawer({ element, snapshot, canOverride, onClose, onSetStatus }: DetailDrawerProps) {
  const [acting, setActing] = useState(false)

  async function handleSetStatus(status: ElementStatusSnapshot['status']) {
    setActing(true)
    try {
      await onSetStatus(element.id, status)
      toast.success(`Table marked as ${STATUS_STYLES[status].label}`)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setActing(false)
    }
  }

  const currentStatus = snapshot?.status ?? 'FREE'

  function fmt(iso: string | null | undefined): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function formatCurrency(cents: number | null | undefined): string {
    if (!cents) return '—'
    return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  }

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'var(--card, #fff)',
      borderTop: '1px solid var(--border, #e5e7eb)',
      borderRadius: '12px 12px 0 0',
      padding: '16px 20px 24px',
      boxShadow: '0 -4px 24px #00000018',
      zIndex: 100,
      maxHeight: '60%', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {element.label || element.elementKind === 'HOTEL_ROOM' ? element.label || 'Room' : element.label || 'Table'}
          </h3>
          {element.seatCount > 0 && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground, #6b7280)' }}>
              {element.seatCount} seat{element.seatCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusBadge status={currentStatus} />
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted-foreground, #6b7280)' }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Session info */}
      {snapshot?.sessionId && (
        <div style={{
          background: 'var(--muted, #f9fafb)', borderRadius: 8,
          padding: '10px 12px', marginBottom: 12,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted-foreground, #9ca3af)' }}>Seated at</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} /> {fmt(snapshot.sessionOpenedAt)}
            </p>
          </div>
          {snapshot.unpaidTotal != null && snapshot.unpaidTotal > 0 && (
            <div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted-foreground, #9ca3af)' }}>Unpaid</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
                {formatCurrency(snapshot.unpaidTotal)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Reservation info */}
      {snapshot?.reservationId && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
          padding: '10px 12px', marginBottom: 12,
        }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#92400e' }}>Reservation</p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{snapshot.guestName ?? '—'}</p>
          {snapshot.partySize && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={12} /> Party of {snapshot.partySize}
            </p>
          )}
        </div>
      )}

      {/* Manual override actions */}
      {canOverride && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(['FREE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'] as const)
            .filter((s) => s !== currentStatus)
            .map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                disabled={acting}
                onClick={() => void handleSetStatus(s)}
                style={{ fontSize: 12 }}
              >
                Mark {STATUS_STYLES[s].label}
              </Button>
            ))}
        </div>
      )}
    </div>
  )
}

// ─── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      {(Object.entries(STATUS_STYLES) as [ElementStatusSnapshot['status'], (typeof STATUS_STYLES)[keyof typeof STATUS_STYLES]][]).map(([key, s]) => (
        <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--foreground, #111)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.fill, border: `2px solid ${s.stroke}` }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

// ─── Main viewer ───────────────────────────────────────────────────────────────

export function FloorPlanViewer({ businessId, planId, canOverrideStatus }: FloorPlanViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)

  const { plan, statuses, loading, error, loadSnapshot, setElementStatus } = useFloorPlanLive(businessId, planId)

  // Measure container
  const measureContainer = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(Math.floor(containerRef.current.getBoundingClientRect().width))
    }
  }, [])

  const elements: EditorElement[] = plan?.elements.map(apiToEditor) ?? []
  const selectedEl = elements.find((e) => e.id === selectedElementId) ?? null
  const selectedSnap = selectedElementId ? statuses[selectedElementId] : undefined

  if (loading && !plan) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48, color: 'var(--muted-foreground, #6b7280)' }}>
        Loading live view…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: '#dc2626', marginBottom: 12 }}>{error}</p>
        <Button variant="outline" size="sm" onClick={() => void loadSnapshot()}>
          <RefreshCw size={13} style={{ marginRight: 6 }} /> Retry
        </Button>
      </div>
    )
  }

  if (!plan) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
        borderBottom: '1px solid var(--border, #e5e7eb)',
        background: 'var(--card, #fff)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{plan.name}</span>
        <Legend />
        <div style={{ flex: 1 }} />
        <Button variant="outline" size="sm" onClick={() => void loadSnapshot()} style={{ fontSize: 12 }}>
          <RefreshCw size={12} style={{ marginRight: 5 }} /> Refresh
        </Button>
      </div>

      {/* Canvas area */}
      <div
        ref={(el) => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
          if (el) measureContainer()
        }}
        style={{ flex: 1, overflow: 'auto', padding: 16, background: 'var(--muted, #f9fafb)', position: 'relative' }}
      >
        <FloorPlanCanvas
          width={plan.canvasWidth}
          height={plan.canvasHeight}
          gridSize={plan.gridSize}
          showGrid={false}
          elements={elements}
          selectedId={selectedElementId}
          editorMode={false}
          statuses={statuses}
          onSelectElement={(id) => setSelectedElementId(id)}
          onDragEnd={() => {}}
          onTransformEnd={() => {}}
          onElementClick={(id) => setSelectedElementId(id)}
          containerWidth={Math.max(200, containerWidth - 32)}
        />

        {/* Detail drawer (slides up from bottom) */}
        {selectedEl && (
          <ElementDetailDrawer
            element={selectedEl}
            snapshot={selectedSnap}
            canOverride={canOverrideStatus}
            onClose={() => setSelectedElementId(null)}
            onSetStatus={setElementStatus}
          />
        )}
      </div>
    </div>
  )
}
