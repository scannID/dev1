import { useCallback, useEffect, useRef, useState } from 'react'
import { floorPlanApi } from '../../api/floorPlan'
import type { ElementStatusSnapshot, FloorPlan } from '../../api/floorPlan'
import keycloak from '../../keycloak'

export function useFloorPlanLive(businessId: string, planId: string | null) {
  const [plan, setPlan] = useState<FloorPlan | null>(null)
  const [statuses, setStatuses] = useState<Record<string, ElementStatusSnapshot>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clientRef = useRef<{ close: () => void } | null>(null)

  const loadSnapshot = useCallback(async () => {
    if (!planId) return
    setLoading(true)
    setError(null)
    try {
      const snap = await floorPlanApi.getLiveSnapshot(businessId, planId)
      setPlan(snap.plan)
      setStatuses(snap.statuses)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live snapshot')
    } finally {
      setLoading(false)
    }
  }, [businessId, planId])

  const setElementStatus = useCallback(
    async (elementId: string, status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE') => {
      if (!planId) return
      try {
        const snap = await floorPlanApi.setElementStatus(businessId, planId, elementId, { status })
        setStatuses((prev) => ({ ...prev, [elementId]: snap }))
      } catch (err) {
        throw err
      }
    },
    [businessId, planId]
  )

  // Subscribe to realtime updates on the floor:{businessId} channel
  useEffect(() => {
    if (!planId || !businessId) return
    let cancelled = false

    void loadSnapshot()

    async function startRealtime() {
      if (cancelled) return
      const { createRealtimeClient } = await import('../../lib/realtime')
      clientRef.current = createRealtimeClient({
        channels: [`floor:${businessId}`],
        getToken: async () => {
          try {
            await keycloak.updateToken(30)
            return keycloak.token
          } catch {
            return keycloak.token
          }
        },
        poll: loadSnapshot,
        pollIntervalMs: 20000,
        onEvent: (event) => {
          if (event.type === 'FLOOR_ELEMENT_STATUS_CHANGED') {
            const payload = event.payload as {
              elementId: string
              newStatus: string
              sessionId?: string | null
              reservationId?: string | null
            }
            // Optimistically update local state — no full reload needed
            setStatuses((prev) => {
              const existing = prev[payload.elementId]
              return {
                ...prev,
                [payload.elementId]: {
                  ...(existing ?? {}),
                  elementId: payload.elementId,
                  status: payload.newStatus as ElementStatusSnapshot['status'],
                  sessionId: payload.sessionId ?? null,
                  reservationId: payload.reservationId ?? null,
                  updatedAt: new Date().toISOString(),
                  tableLabel: existing?.tableLabel ?? null,
                  sessionOpenedAt: existing?.sessionOpenedAt ?? null,
                  guestName: existing?.guestName ?? null,
                  partySize: existing?.partySize ?? null,
                  unpaidTotal: existing?.unpaidTotal ?? null,
                },
              }
            })
          }
          if (event.type === 'FLOOR_PLAN_UPDATED') {
            const updatedPayload = event.payload as { planId?: string } | undefined
            if (updatedPayload?.planId === planId) {
              void loadSnapshot()
            }
          }
        },
      })
    }

    void startRealtime()

    return () => {
      cancelled = true
      clientRef.current?.close()
      clientRef.current = null
    }
  }, [businessId, planId, loadSnapshot])

  return {
    plan,
    statuses,
    loading,
    error,
    loadSnapshot,
    setElementStatus,
  }
}
