import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { InlineSpinner } from '../components/LoadingSpinner'
import { PaginationBar } from '../components/PaginationBar'
import { useAuditLog } from '../hooks/usePlatform'
import { useServerPagination } from '../hooks/useServerPagination'

export default function AuditLogPage() {
  const [totalItems, setTotalItems] = useState(0)
  const pagination = useServerPagination({
    totalItems,
    initialPageSize: 20,
  })
  const { data, loading, error } = useAuditLog(pagination.page, pagination.pageSize)
  const events = data?.events ?? []
  const summary = data?.summary

  useEffect(() => {
    setTotalItems(data?.pagination?.total ?? 0)
  }, [data?.pagination?.total])

  return (
    <>
      {error && <div style={{ padding: '12px 16px', marginBottom: 16, color: 'crimson', fontSize: 13 }}>Could not load audit log: {error}</div>}
      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Loading audit log…" />
        </div>
      )}

      <div className="admin-metric-grid cols-3">
        {[
          { label: 'Events Today', value: String(summary?.eventsToday ?? 0) },
          { label: 'Admin Actions', value: String(summary?.adminActions ?? 0) },
          { label: 'System Events', value: String(summary?.systemEvents ?? 0) },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3>Audit Log</h3>
            <p>Derived platform actions</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Actor', 'Action', 'Target', 'IP', 'Time'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, color: 'var(--muted-foreground)' }}>{loading ? <InlineSpinner label="Loading…" /> : 'No audit events yet.'}</td></tr>
              ) : events.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>{log.actor}</td>
                  <td style={{ padding: '10px 16px' }}><Badge variant="secondary">{log.action}</Badge></td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.target}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted-foreground)' }}>{log.ip}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted-foreground)' }}>
                    {new Date(log.timestamp).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={pagination} hideWhenEmpty={false} />
      </div>
    </>
  )
}
