import { useMemo, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { InlineSpinner } from '../components/LoadingSpinner'
import { PaginationBar } from '../components/PaginationBar'
import { usePagination } from '../hooks/usePagination'
import { useBroadcasts } from '../hooks/usePlatform'
import type { BroadcastSeverity } from '../api/types'

const SEVERITY_CLASS: Record<BroadcastSeverity, string> = {
  INFO: 'bg-blue-50 text-blue-700',
  WARNING: 'bg-amber-50 text-amber-700',
  CRITICAL: 'bg-red-50 text-red-600',
}

const STATUS_CLASS: Record<string, string> = {
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  REVOKED: 'bg-muted text-muted-foreground',
  DRAFT: 'bg-amber-50 text-amber-700',
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CommunicationsPage() {
  const { broadcasts, loading, error, saving, publish, revoke } = useBroadcasts()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [severity, setSeverity] = useState<BroadcastSeverity>('INFO')
  const [expiresLocal, setExpiresLocal] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [revokeId, setRevokeId] = useState<string | null>(null)

  const historyPagination = usePagination(broadcasts, { initialPageSize: 20 })

  const publishedCount = useMemo(
    () => broadcasts.filter((b) => b.status === 'PUBLISHED').length,
    [broadcasts],
  )

  async function handlePublish() {
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()
    if (!trimmedTitle || !trimmedBody) {
      toast.error('Title and message are required')
      return
    }
    let expiresAt: string | null = null
    if (expiresLocal) {
      const parsed = new Date(expiresLocal)
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        toast.error('Expiry must be a future date and time')
        return
      }
      expiresAt = parsed.toISOString()
    }
    try {
      await publish({ title: trimmedTitle, body: trimmedBody, severity, expiresAt })
      setTitle('')
      setBody('')
      setSeverity('INFO')
      setExpiresLocal('')
      setConfirmOpen(false)
      toast.success('Broadcast sent to all merchants')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish broadcast')
    }
  }

  async function handleRevoke() {
    if (!revokeId) return
    try {
      await revoke(revokeId)
      setRevokeId(null)
      toast.success('Broadcast revoked')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke broadcast')
    }
  }

  return (
    <>
      {error && (
        <div style={{ padding: '12px 16px', marginBottom: 16, color: 'crimson', fontSize: 13 }}>
          Could not load communications: {error}
        </div>
      )}
      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Loading communications…" />
        </div>
      )}

      <div className="admin-metric-grid cols-3">
        {[
          { label: 'Total broadcasts', value: String(broadcasts.length) },
          { label: 'Active published', value: String(publishedCount) },
          { label: 'Audience', value: 'All merchants' },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="admin-two-col">
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h3>Compose broadcast</h3>
              <p>In-app message to every merchant inbox</p>
            </div>
          </div>
          <div style={{ padding: 20, display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label htmlFor="broadcast-title">Title</Label>
              <Input
                id="broadcast-title"
                value={title}
                maxLength={120}
                placeholder="e.g. Scheduled maintenance tonight"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label htmlFor="broadcast-body">Message</Label>
              <Textarea
                id="broadcast-body"
                value={body}
                rows={5}
                placeholder="Write the message merchants will see in their banner and inbox…"
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <Label htmlFor="broadcast-severity">Severity</Label>
                <select
                  id="broadcast-severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as BroadcastSeverity)}
                  style={{
                    height: 36,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    padding: '0 10px',
                    fontSize: 13,
                    color: 'var(--foreground)',
                  }}
                >
                  <option value="INFO">Info</option>
                  <option value="WARNING">Warning</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <Label htmlFor="broadcast-expires">Expires (optional)</Label>
                <Input
                  id="broadcast-expires"
                  type="datetime-local"
                  value={expiresLocal}
                  onChange={(e) => setExpiresLocal(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="w-fit"
              disabled={saving || !title.trim() || !body.trim()}
              onClick={() => setConfirmOpen(true)}
            >
              <Megaphone size={14} />
              Publish to all merchants
            </Button>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h3>Delivery notes</h3>
              <p>How merchants receive this</p>
            </div>
          </div>
          <div style={{ padding: 20, fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.55 }}>
            <p style={{ margin: '0 0 10px' }}>
              Published messages appear as an in-app banner and in the merchant notifications inbox.
            </p>
            <p style={{ margin: '0 0 10px' }}>
              Merchants can dismiss the banner; the message stays in their inbox until it expires or you revoke it.
            </p>
            <p style={{ margin: 0 }}>WhatsApp, email, and SMS are not used for this channel.</p>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3>Broadcast history</h3>
            <p>Past and active messages</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Title', 'Severity', 'Status', 'Published', 'Expires', ''].map((h) => (
                  <th
                    key={h || 'actions'}
                    style={{
                      padding: '8px 16px',
                      textAlign: 'left',
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historyPagination.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, color: 'var(--muted-foreground)' }}>
                    {loading ? <InlineSpinner label="Loading…" /> : 'No broadcasts yet.'}
                  </td>
                </tr>
              ) : (
                historyPagination.pageItems.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', maxWidth: 280 }}>
                      <div style={{ fontWeight: 500 }}>{b.title}</div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 12,
                          color: 'var(--muted-foreground)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {b.body}
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge variant="secondary" className={SEVERITY_CLASS[b.severity] ?? ''}>
                        {b.severity}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge variant="secondary" className={STATUS_CLASS[b.status] ?? ''}>
                        {b.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>
                      {formatDate(b.publishedAt)}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>
                      {formatDate(b.expiresAt)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      {b.status === 'PUBLISHED' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={saving}
                          onClick={() => setRevokeId(b.id)}
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={historyPagination} hideWhenEmpty={false} />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish to all merchants?</AlertDialogTitle>
            <AlertDialogDescription>
              This message will appear in every merchant&apos;s app banner and inbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={() => void handlePublish()}>
              {saving ? 'Publishing…' : 'Publish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(revokeId)} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              Merchants will no longer see it in their banner or inbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={() => void handleRevoke()}>
              {saving ? 'Revoking…' : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
