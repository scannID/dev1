import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Eye, LayoutDashboard, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { BusinessType } from '../api/types'
import type { BusinessTable } from '../api/operations'
import { operationsApi } from '../api/operations'
import { useFloorPlan } from './hooks/useFloorPlan'
import { FloorPlanEditor } from './FloorPlanEditor'
import { FloorPlanViewer } from './FloorPlanViewer'
import { DanceLoader } from '../components/DanceLoader'

type EditorMode = 'editor' | 'viewer'

interface FloorPlanPageProps {
  businessId: string
  businessType: BusinessType
  staffMode?: boolean
  staffRole?: string | null
  initialMode?: 'viewer' | 'editor'
}

export function FloorPlanPage({ businessId, businessType: _businessType, staffMode = false, staffRole, initialMode = 'viewer' }: FloorPlanPageProps) {
  const {
    plans, activePlan, templates,
    loading, saving, error,
    loadPlans, loadPlan, createPlan, saveCanvas, deletePlan, loadTemplates,
  } = useFloorPlan(businessId)

  const [mode, setMode] = useState<EditorMode>(initialMode)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [tables, setTables] = useState<BusinessTable[]>([])
  const [showNewPlanInput, setShowNewPlanInput] = useState(false)
  const [newPlanName, setNewPlanName] = useState('')
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)

  // Determine if the user can manually override element status
  const canOverride = !staffMode || staffRole === 'MANAGER' || staffRole === 'STAFF_MANAGER'
  const canEdit = !staffMode

  // Initial load
  useEffect(() => {
    async function init() {
      const list = await loadPlans()
      await loadTemplates()
      if (list.length > 0) {
        setSelectedPlanId(list[0].id)
        await loadPlan(list[0].id)
      }
      // Load tables for the element controls panel (link table → element)
      try {
        const tableList = await operationsApi.listTables(businessId)
        setTables(tableList)
      } catch {
        // non-critical
      }
    }
    void init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  const handleSelectPlan = useCallback(
    async (planId: string) => {
      setSelectedPlanId(planId)
      await loadPlan(planId)
    },
    [loadPlan]
  )

  const handleCreatePlan = useCallback(async () => {
    const name = newPlanName.trim() || 'New Floor'
    const plan = await createPlan(name)
    if (plan) {
      setSelectedPlanId(plan.id)
      setShowNewPlanInput(false)
      setNewPlanName('')
      setMode('editor')
      toast.success(`"${plan.name}" created`)
    } else {
      toast.error('Failed to create floor plan')
    }
  }, [createPlan, newPlanName])

  const handleDeletePlan = useCallback(async () => {
    if (!deletingPlanId) return
    await deletePlan(deletingPlanId)
    setDeletingPlanId(null)
    const remaining = plans.filter((p) => p.id !== deletingPlanId)
    if (remaining.length > 0) {
      setSelectedPlanId(remaining[0].id)
      await loadPlan(remaining[0].id)
    } else {
      setSelectedPlanId(null)
    }
    toast.success('Floor plan deleted')
  }, [deletingPlanId, deletePlan, plans, loadPlan])

  // Empty state
  if (!loading && plans.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60, gap: 16, textAlign: 'center' }}>
        <LayoutDashboard size={48} strokeWidth={1} style={{ color: 'var(--muted-foreground, #9ca3af)' }} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>No floor plans yet</h2>
        <p style={{ margin: 0, color: 'var(--muted-foreground, #6b7280)', maxWidth: 380 }}>
          Create your first floor plan to visualize your venue layout and track table occupancy in real time.
        </p>
        {canEdit && (
          <>
            {showNewPlanInput ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  autoFocus
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="e.g. Main Floor, Patio…"
                  style={{ width: 220 }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleCreatePlan() }}
                />
                <Button onClick={() => void handleCreatePlan()} disabled={saving}>
                  {saving ? 'Creating…' : 'Create'}
                </Button>
                <Button variant="outline" onClick={() => setShowNewPlanInput(false)}>Cancel</Button>
              </div>
            ) : (
              <Button onClick={() => setShowNewPlanInput(true)}>
                <Plus size={14} style={{ marginRight: 6 }} />
                Create Floor Plan
              </Button>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar — floor plan tabs + mode switcher */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: '1px solid var(--border, #e5e7eb)',
        background: 'var(--card, #fff)', flexShrink: 0, overflowX: 'auto',
        minHeight: 44,
      }}>
        {/* Plan tabs */}
        <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, overflowX: 'auto' }}>
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void handleSelectPlan(p.id)}
              style={{
                padding: '0 16px',
                minHeight: 44,
                border: 'none',
                borderBottom: selectedPlanId === p.id ? '2px solid #6366f1' : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: selectedPlanId === p.id ? 600 : 400,
                color: selectedPlanId === p.id ? '#6366f1' : 'var(--foreground, #111)',
                whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {p.name}
              {canEdit && (
                <span
                  onClick={(e) => { e.stopPropagation(); setDeletingPlanId(p.id) }}
                  style={{ opacity: 0.4, display: 'flex', alignItems: 'center', padding: 2 }}
                  title="Delete floor plan"
                >
                  <Trash2 size={11} />
                </span>
              )}
            </button>
          ))}

          {/* Add new plan */}
          {canEdit && !showNewPlanInput && (
            <button
              type="button"
              onClick={() => setShowNewPlanInput(true)}
              style={{
                padding: '0 12px', minHeight: 44, border: 'none',
                background: 'none', cursor: 'pointer',
                color: 'var(--muted-foreground, #6b7280)', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
              title="Add new floor"
            >
              <Plus size={14} /> Add Floor
            </button>
          )}

          {canEdit && showNewPlanInput && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
              <Input
                autoFocus
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="Floor name"
                style={{ width: 140, height: 30, fontSize: 12 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreatePlan()
                  if (e.key === 'Escape') { setShowNewPlanInput(false); setNewPlanName('') }
                }}
              />
              <Button size="sm" onClick={() => void handleCreatePlan()} disabled={saving} style={{ height: 30, fontSize: 12 }}>
                {saving ? '…' : 'Create'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowNewPlanInput(false); setNewPlanName('') }} style={{ height: 30 }}>
                ✕
              </Button>
            </div>
          )}
        </div>

        {/* Mode switcher */}
        {selectedPlanId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 16px', flexShrink: 0 }}>
            <Button
              variant={mode === 'viewer' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('viewer')}
              style={{ fontSize: 12, height: 30 }}
            >
              <Eye size={13} style={{ marginRight: 5 }} />
              Live View
            </Button>
            {canEdit && (
              <Button
                variant={mode === 'editor' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('editor')}
                style={{ fontSize: 12, height: 30 }}
              >
                <Pencil size={13} style={{ marginRight: 5 }} />
                Edit Layout
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {loading && !activePlan ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <DanceLoader label="Loading floor plan…" />
          </div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#dc2626' }}>{error}</div>
        ) : activePlan && selectedPlanId ? (
          mode === 'editor' && canEdit ? (
            <FloorPlanEditor
              plan={activePlan}
              templates={templates}
              tables={tables}
              onSave={(payload) => saveCanvas(activePlan.id, payload)}
              saving={saving}
            />
          ) : (
            <FloorPlanViewer
              businessId={businessId}
              planId={selectedPlanId}
              canOverrideStatus={canOverride}
            />
          )
        ) : null}
      </div>

      {/* Confirm delete dialog */}
      <AlertDialog open={!!deletingPlanId} onOpenChange={(open) => { if (!open) setDeletingPlanId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete floor plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the floor plan and all its elements. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeletePlan()} style={{ background: '#dc2626' }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
