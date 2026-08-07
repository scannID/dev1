import { CalendarRange, Megaphone, X } from 'lucide-react'
import type { BusinessAnnouncement } from '../api/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDateRange(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
  if (startsAt && endsAt) return `${fmt(startsAt)} – ${fmt(endsAt)}`
  if (startsAt) return `From ${fmt(startsAt)}`
  if (endsAt) return `Until ${fmt(endsAt)}`
  return ''
}

// ── component ─────────────────────────────────────────────────────────────────

export function AnnouncementsCustomerPanel({
  announcements,
  onClose,
}: {
  announcements: BusinessAnnouncement[]
  onClose: () => void
}) {
  return (
    <div className="cm-track-overlay cm-ann-overlay" role="dialog" aria-modal="true" aria-label="Announcements">
      <button
        type="button"
        className="cm-track-backdrop"
        aria-label="Close announcements"
        onClick={onClose}
      />

      <div className="cm-track-sheet cm-ann-sheet">
        {/* Header */}
        <div className="cm-track-sheet-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Announcements</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--cm-muted)' }}>
              {announcements.length === 1
                ? '1 active announcement'
                : `${announcements.length} active announcements`}
            </p>
          </div>
          <button type="button" className="cm-track-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Cards */}
        {announcements.length === 0 ? (
          <div className="cm-ann-empty">
            <Megaphone size={26} aria-hidden="true" />
            <p>Nothing new right now.</p>
          </div>
        ) : (
          <div className="cm-ann-list">
            {announcements.map((a) => {
              const dateRange = formatDateRange(a.startsAt, a.endsAt)
              return (
                <div key={a.id} className="cm-ann-card">
                  {a.imageUrl ? (
                    <div className="cm-ann-card-img">
                      <img src={a.imageUrl} alt="" />
                    </div>
                  ) : (
                    <div className="cm-ann-card-icon-strip" aria-hidden="true">
                      <Megaphone size={18} />
                    </div>
                  )}
                  <div className="cm-ann-card-body">
                    <p className="cm-ann-card-title">{a.title}</p>
                    {a.body ? (
                      <p className="cm-ann-card-text">{a.body}</p>
                    ) : null}
                    {dateRange ? (
                      <p className="cm-ann-card-dates">
                        <CalendarRange size={11} aria-hidden="true" />
                        {dateRange}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
