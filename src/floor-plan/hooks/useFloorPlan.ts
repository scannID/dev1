import { useCallback, useState } from 'react'
import { floorPlanApi } from '../../api/floorPlan'
import type { FloorPlan, FloorPlanSummary, FloorPlanTemplate } from '../../api/floorPlan'

export function useFloorPlan(businessId: string) {
  const [plans, setPlans] = useState<FloorPlanSummary[]>([])
  const [activePlan, setActivePlan] = useState<FloorPlan | null>(null)
  const [templates, setTemplates] = useState<FloorPlanTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPlans = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await floorPlanApi.listPlans(businessId)
      setPlans(list)
      return list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load floor plans')
      return []
    } finally {
      setLoading(false)
    }
  }, [businessId])

  const loadPlan = useCallback(
    async (planId: string) => {
      setLoading(true)
      setError(null)
      try {
        const plan = await floorPlanApi.getPlan(businessId, planId)
        setActivePlan(plan)
        return plan
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load floor plan')
        return null
      } finally {
        setLoading(false)
      }
    },
    [businessId]
  )

  const createPlan = useCallback(
    async (name: string) => {
      setSaving(true)
      setError(null)
      try {
        const plan = await floorPlanApi.createPlan(businessId, {
          name,
          canvasWidth: 1200,
          canvasHeight: 800,
          gridSize: 20,
        })
        setActivePlan(plan)
        setPlans((prev) => [
          ...prev,
          {
            id: plan.id,
            businessId: plan.businessId,
            name: plan.name,
            canvasWidth: plan.canvasWidth,
            canvasHeight: plan.canvasHeight,
            gridSize: plan.gridSize,
            backgroundImage: plan.backgroundImage,
            createdAt: plan.createdAt,
            updatedAt: plan.updatedAt,
          },
        ])
        return plan
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create floor plan')
        return null
      } finally {
        setSaving(false)
      }
    },
    [businessId]
  )

  const saveCanvas = useCallback(
    async (
      planId: string,
      payload: Parameters<typeof floorPlanApi.saveCanvas>[2]
    ) => {
      setSaving(true)
      setError(null)
      try {
        const plan = await floorPlanApi.saveCanvas(businessId, planId, payload)
        setActivePlan(plan)
        setPlans((prev) =>
          prev.map((p) =>
            p.id === planId ? { ...p, name: plan.name, updatedAt: plan.updatedAt } : p
          )
        )
        return plan
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save floor plan')
        return null
      } finally {
        setSaving(false)
      }
    },
    [businessId]
  )

  const deletePlan = useCallback(
    async (planId: string) => {
      setSaving(true)
      setError(null)
      try {
        await floorPlanApi.deletePlan(businessId, planId)
        setPlans((prev) => prev.filter((p) => p.id !== planId))
        if (activePlan?.id === planId) setActivePlan(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete floor plan')
      } finally {
        setSaving(false)
      }
    },
    [businessId, activePlan]
  )

  const loadTemplates = useCallback(async () => {
    try {
      const list = await floorPlanApi.listTemplates(businessId)
      setTemplates(list)
    } catch {
      // templates are non-critical — swallow errors silently
    }
  }, [businessId])

  return {
    plans,
    activePlan,
    setActivePlan,
    templates,
    loading,
    saving,
    error,
    loadPlans,
    loadPlan,
    createPlan,
    saveCanvas,
    deletePlan,
    loadTemplates,
  }
}
