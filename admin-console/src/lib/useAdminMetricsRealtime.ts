import { useEffect, useRef } from 'react'
import adminKeycloak from '../api/keycloak'
import { createRealtimeClient } from './realtime'

/**
 * Subscribe to platform metric events and refresh immediately.
 * Keeps a short REST poll even while connected so scan cards never go stale.
 */
export function useAdminMetricsRealtime(onUpdate: () => void | Promise<void>, enabled = true) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const debounceTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return

    const scheduleUpdate = () => {
      if (debounceTimer.current != null) window.clearTimeout(debounceTimer.current)
      debounceTimer.current = window.setTimeout(() => {
        debounceTimer.current = null
        void onUpdateRef.current()
      }, 250)
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
      // Fast safety net: scans must show up even if a WS event is missed.
      pollIntervalMs: 5000,
      keepPollingWhileConnected: true,
      onEvent: (event) => {
        if (
          event.type === 'QR_SCAN_RECORDED' ||
          event.type === 'ORDER_CREATED' ||
          event.type === 'ORDER_UPDATED' ||
          event.type === 'ORDER_PAYMENT_UPDATED' ||
          event.type === 'ORDER_STATUS_UPDATED' ||
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
