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

  useEffect(() => {
    if (!enabled) return

    let client: { close: () => void } | null = null

    client = createRealtimeClient({
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
          event.channel === 'admin:metrics'
        ) {
          void onUpdateRef.current()
        }
      },
    })

    return () => {
      client?.close()
    }
  }, [enabled])
}
