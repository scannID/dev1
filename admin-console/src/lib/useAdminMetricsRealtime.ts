import { useEffect, useRef } from 'react'
import adminKeycloak from '../api/keycloak'
import { createRealtimeClient } from './realtime'

/**
 * Subscribe to platform metric events and refresh immediately.
 * Falls back to the existing poll interval when the socket is down.
 */
export function useAdminMetricsRealtime(onUpdate: () => void | Promise<void>, enabled = true) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const debounceTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return

    const scheduleUpdate = () => {
      // Burst scan/order events should not redraw Overview every few ms.
      if (debounceTimer.current != null) window.clearTimeout(debounceTimer.current)
      debounceTimer.current = window.setTimeout(() => {
        debounceTimer.current = null
        void onUpdateRef.current()
      }, 750)
    }

    const client = createRealtimeClient({
      channels: ['admin:metrics'],
      getToken: async () => {
        try {
          await adminKeycloak.updateToken(30)
        } catch {
          /* keep current token */
        }
        return adminKeycloak.token
      },
      poll: () => onUpdateRef.current(),
      // Slow safety net only — realtime should drive updates.
      pollIntervalMs: 60000,
      onEvent: (event) => {
        if (
          event.type === 'QR_SCAN_RECORDED' ||
          event.type === 'ORDER_CREATED' ||
          event.type === 'ORDER_UPDATED' ||
          event.channel === 'admin:metrics'
        ) {
          scheduleUpdate()
        }
      },
    })

    return () => {
      if (debounceTimer.current != null) window.clearTimeout(debounceTimer.current)
      client.close()
    }
  }, [enabled])
}
