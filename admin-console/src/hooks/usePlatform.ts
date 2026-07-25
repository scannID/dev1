import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/services'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { useAdminMetricsRealtime } from '../lib/useAdminMetricsRealtime'
import type {
  CatalogListResponse,
  ConfigAction,
  ConfigMap,
  ConfigSection,
  PlatformConfigs,
} from '../api/types'

export function useCatalog() {
  const [data, setData] = useState<CatalogListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setData(await adminApi.catalog.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await adminApi.catalog.list()
        if (!cancelled) {
          setData(response)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load catalog')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error, refresh }
}

export function useUsers() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.users.list>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await adminApi.users.list()
        if (!cancelled) {
          setData(response)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load users')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}

export function useQrActivity() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.qrActivity.get>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setError(null)
      setData(await adminApi.qrActivity.get())
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load QR activity')
        setData(null)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh(false)
  }, [refresh])

  useAdminMetricsRealtime(() => refresh(true))
  useAutoRefresh(() => void refresh(true), 60000)

  return { data, loading, error, refresh: () => refresh(false) }
}

export function useAuditLog(page = 1, limit = 20) {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.audit.list>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const response = await adminApi.audit.list({ page, limit })
        if (!cancelled) {
          setData(response)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load audit log')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [page, limit])

  return { data, loading, error }
}

export function useSystemHealth() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.system.getHealth>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await adminApi.system.getHealth()
        if (!cancelled) {
          setData(response)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load system health')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}

export function useRevenue() {
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof adminApi.revenue.getOverview>> | null>(null)
  const [transactions, setTransactions] = useState<Awaited<ReturnType<typeof adminApi.revenue.listTransactions>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [ov, tx] = await Promise.all([
          adminApi.revenue.getOverview(),
          adminApi.revenue.listTransactions(),
        ])
        if (!cancelled) {
          setOverview(ov)
          setTransactions(tx)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load revenue')
          setOverview(null)
          setTransactions([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { overview, transactions, loading, error }
}

export function useConfigs() {
  const [configs, setConfigs] = useState<PlatformConfigs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminApi.configs.getAll()
      setConfigs(response.configs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configs')
      setConfigs(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await adminApi.configs.getAll()
        if (!cancelled) {
          setConfigs(response.configs)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load configs')
          setConfigs(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const updateSection = useCallback(async (section: ConfigSection, config: ConfigMap) => {
    setSaving(section)
    try {
      const response = await adminApi.configs.updateSection(section, config)
      setConfigs((prev) =>
        prev
          ? { ...prev, [section]: response.config }
          : ({ [section]: response.config } as unknown as PlatformConfigs)
      )
      return response
    } finally {
      setSaving(null)
    }
  }, [])

  const runAction = useCallback(async (action: ConfigAction) => {
    setSaving(action)
    try {
      return await adminApi.configs.runAction(action)
    } finally {
      setSaving(null)
    }
  }, [])

  return { configs, loading, error, saving, refresh, updateSection, runAction }
}

export function useNotifications() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.notifications.list>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('scanny-admin-notif-read')
      return new Set(raw ? (JSON.parse(raw) as string[]) : [])
    } catch {
      return new Set()
    }
  })

  const refresh = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setError(null)
      setData(await adminApi.notifications.list())
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications')
        setData(null)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh(false)
  }, [refresh])

  useAutoRefresh(() => void refresh(true), 15000)

  const markAllRead = useCallback(() => {
    const ids = data?.notifications.map((n) => n.id) ?? []
    const next = new Set([...readIds, ...ids])
    setReadIds(next)
    localStorage.setItem('scanny-admin-notif-read', JSON.stringify([...next]))
  }, [data, readIds])

  const notifications = (data?.notifications ?? []).map((n) => ({
    ...n,
    unread: n.unread && !readIds.has(n.id),
  }))
  const unread = notifications.filter((n) => n.unread).length

  return { notifications, unread, loading, error, refresh: () => refresh(false), markAllRead }
}

