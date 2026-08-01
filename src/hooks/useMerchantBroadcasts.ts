import { useCallback, useEffect, useMemo, useState } from 'react'
import { merchantAuthApi } from '../api/services'
import type { MerchantBroadcast } from '../api/types'

const POLL_MS = 60_000

export function useMerchantBroadcasts(enabled: boolean) {
  const [broadcasts, setBroadcasts] = useState<MerchantBroadcast[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (silent = false) => {
    if (!enabled) return
    try {
      if (!silent) setLoading(true)
      setError(null)
      const data = await merchantAuthApi.listBroadcasts()
      setBroadcasts(data.broadcasts)
      setUnread(data.unread)
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load messages')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setBroadcasts([])
      setUnread(0)
      return
    }
    void refresh(false)
    const id = window.setInterval(() => void refresh(true), POLL_MS)
    return () => window.clearInterval(id)
  }, [enabled, refresh])

  const bannerBroadcast = useMemo(
    () => broadcasts.find((b) => !b.dismissed) ?? null,
    [broadcasts],
  )

  const markRead = useCallback(async (id: string) => {
    try {
      await merchantAuthApi.markBroadcastRead(id)
      setBroadcasts((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, unread: false } : b))
        setUnread(next.filter((b) => b.unread && !b.dismissed).length)
        return next
      })
    } catch {
      // keep local state; next poll corrects
    }
  }, [])

  const dismiss = useCallback(async (id: string) => {
    try {
      await merchantAuthApi.dismissBroadcast(id)
      setBroadcasts((prev) => {
        const next = prev.map((b) =>
          b.id === id ? { ...b, dismissed: true, unread: false } : b,
        )
        setUnread(next.filter((b) => b.unread && !b.dismissed).length)
        return next
      })
    } catch {
      // keep local state; next poll corrects
    }
  }, [])

  return {
    broadcasts,
    unread,
    loading,
    error,
    bannerBroadcast,
    refresh: () => refresh(false),
    markRead,
    dismiss,
  }
}
