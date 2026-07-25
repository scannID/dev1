/**
 * Shared realtime client with auth, subscribe, reconnect, and polling fallback hooks.
 */

export type RealtimeEnvelope = {
  type: string
  channel: string
  businessId?: string
  version?: number
  occurredAt?: string
  eventId?: string
  payload?: unknown
}

type RealtimeOptions = {
  channels: string[]
  getToken?: () => Promise<string | undefined> | string | undefined
  onEvent: (event: RealtimeEnvelope) => void
  onStatus?: (status: 'connecting' | 'connected' | 'disconnected' | 'fallback') => void
  poll?: () => void | Promise<void>
  pollIntervalMs?: number
  enabled?: boolean
}

function resolveWsBase(): string {
  const explicit = import.meta.env.VITE_WS_BASE_URL as string | undefined
  if (explicit) return explicit.replace(/\/$/, '')
  const api = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000/api'
  try {
    const url = new URL(api)
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProtocol}//${url.host}`
  } catch {
    return 'ws://localhost:4000'
  }
}

export function createRealtimeClient(options: RealtimeOptions) {
  let socket: WebSocket | null = null
  let closed = false
  let attempt = 0
  let pollTimer: number | null = null
  let reconnectTimer: number | null = null
  let lastEventAt = Date.now()
  let polling = false
  const seen = new Set<string>()

  const setStatus = (status: 'connecting' | 'connected' | 'disconnected' | 'fallback') => {
    options.onStatus?.(status)
  }

  const startPolling = () => {
    if (!options.poll || closed) return
    if (polling) return
    polling = true
    setStatus('fallback')
    void options.poll()
    pollTimer = window.setInterval(() => {
      void options.poll?.()
    }, options.pollIntervalMs ?? 15000)
  }

  const stopPolling = () => {
    polling = false
    if (pollTimer != null) {
      window.clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const connect = async () => {
    if (closed || options.enabled === false) return
    if (typeof document !== 'undefined' && document.hidden) {
      startPolling()
      return
    }
    setStatus('connecting')
    const wsUrl = `${resolveWsBase()}/ws/realtime`
    try {
      socket = new WebSocket(wsUrl)
    } catch {
      startPolling()
      scheduleReconnect()
      return
    }

    socket.onopen = async () => {
      attempt = 0
      lastEventAt = Date.now()
      const token = await options.getToken?.()
      if (token) {
        socket?.send(JSON.stringify({ type: 'AUTH', token }))
      } else {
        // Tickets/admin may still auth; without token close and poll.
        socket?.close()
        startPolling()
      }
    }

    socket.onmessage = (evt) => {
      try {
        const data = JSON.parse(String(evt.data)) as RealtimeEnvelope & { message?: string }
        if (data.type === 'AUTH_OK') {
          setStatus('connected')
          lastEventAt = Date.now()
          stopPolling()
          for (const channel of options.channels) {
            socket?.send(JSON.stringify({ type: 'SUBSCRIBE', channel }))
          }
          return
        }
        if (data.type === 'SUBSCRIBED' || data.type === 'ERROR') return
        if (data.eventId) {
          if (seen.has(data.eventId)) return
          seen.add(data.eventId)
          if (seen.size > 500) {
            const first = seen.values().next().value
            if (first) seen.delete(first)
          }
        }
        lastEventAt = Date.now()
        options.onEvent(data)
      } catch {
        // ignore malformed
      }
    }

    socket.onerror = () => {
      setStatus('disconnected')
    }

    socket.onclose = () => {
      setStatus('disconnected')
      startPolling()
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    if (closed) return
    if (reconnectTimer != null) window.clearTimeout(reconnectTimer)
    const delay = Math.min(30000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500)
    attempt += 1
    reconnectTimer = window.setTimeout(() => {
      void connect()
    }, delay)
  }

  const onVisibility = () => {
    if (document.hidden) {
      startPolling()
    } else {
      lastEventAt = Date.now()
      void options.poll?.()
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        void connect()
      } else {
        stopPolling()
      }
    }
  }

  const staleTimer =
    typeof window !== 'undefined'
      ? window.setInterval(() => {
          if (closed) return
          if (Date.now() - lastEventAt > (options.pollIntervalMs ?? 15000) * 2) {
            startPolling()
          }
        }, 5000)
      : null

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }
  void connect()

  return {
    close() {
      closed = true
      stopPolling()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
      if (reconnectTimer != null && typeof window !== 'undefined') window.clearTimeout(reconnectTimer)
      if (staleTimer != null && typeof window !== 'undefined') window.clearInterval(staleTimer)
      socket?.close()
    },
  }
}

export function getWsBaseUrl() {
  return resolveWsBase()
}
