import { useState } from 'react'
import { MessageSquareHeart, X } from 'lucide-react'
import { funnelApi } from '../api/services'

// ── Types ─────────────────────────────────────────────────────────────────────

type FeedbackReason =
  | 'too_expensive'
  | 'long_wait'
  | 'just_browsing'
  | 'changed_mind'
  | 'payment_issue'
  | 'menu_limited'
  | 'other'

const REASON_CHIPS: { key: FeedbackReason; label: string; emoji: string }[] = [
  { key: 'too_expensive',  label: 'Too expensive',   emoji: '💸' },
  { key: 'long_wait',      label: 'Seemed too slow',  emoji: '⏳' },
  { key: 'just_browsing',  label: 'Just browsing',    emoji: '👀' },
  { key: 'changed_mind',   label: 'Changed my mind',  emoji: '🔄' },
  { key: 'payment_issue',  label: 'Payment trouble',  emoji: '📱' },
  { key: 'menu_limited',   label: 'Nothing I wanted', emoji: '🍽️' },
  { key: 'other',          label: 'Something else',   emoji: '💬' },
]

const STEP_LABELS: Record<string, string> = {
  menu:    'browsing the menu',
  cart:    'reviewing your cart',
  details: 'filling in your details',
  pay:     'the payment step',
}

// ── Component ─────────────────────────────────────────────────────────────────

interface FunnelNudgeProps {
  businessId: string
  deviceId: string
  /** The step the customer dropped off at last visit */
  lastStep: string
  onDismiss: () => void
}

type Phase = 'prompt' | 'chips' | 'text' | 'done'

export function FunnelNudge({ businessId, deviceId, lastStep, onDismiss }: FunnelNudgeProps) {
  const [phase, setPhase] = useState<Phase>('prompt')
  const [selectedReason, setSelectedReason] = useState<FeedbackReason | null>(null)
  const [extraText, setExtraText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const stepLabel = STEP_LABELS[lastStep] ?? 'a previous step'

  function handleDismiss() {
    onDismiss()
  }

  function handleGiveFeedback() {
    setPhase('chips')
  }

  async function handleSelectReason(reason: FeedbackReason) {
    setSelectedReason(reason)
    // For most reasons show "done" immediately; for "other" show text box
    if (reason === 'other') {
      setPhase('text')
    } else {
      await submitFeedback(reason, '')
    }
  }

  async function handleSubmitText() {
    if (!selectedReason) return
    await submitFeedback(selectedReason, extraText)
  }

  async function submitFeedback(reason: FeedbackReason, text: string) {
    setSubmitting(true)
    await funnelApi.submitFeedback(businessId, { deviceId, reason, text: text || undefined })
    setSubmitting(false)
    setPhase('done')
    // Auto-dismiss after a short thank-you moment
    setTimeout(onDismiss, 2000)
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Quick feedback"
      style={{
        position: 'fixed',
        bottom: 72, // sits just above the bottom nav bar
        left: 0,
        right: 0,
        zIndex: 120,
        padding: '0 12px 8px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 18,
          boxShadow: '0 -2px 24px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)',
          border: '1px solid #f0e8df',
          padding: '14px 16px',
          maxWidth: 480,
          margin: '0 auto',
          pointerEvents: 'auto',
          animation: 'fnudge-slide-up 0.28s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {/* ── Prompt phase ─────────────────────────────── */}
        {phase === 'prompt' && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 22, lineHeight: 1, marginTop: 1 }} aria-hidden="true">👋</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
                  Welcome back!
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#6b7280', lineHeight: 1.4 }}>
                  Last time you stopped at <strong style={{ color: '#111827' }}>{stepLabel}</strong>.
                  Mind telling us why?
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 4, color: '#9ca3af', flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={handleGiveFeedback}
                style={{
                  flex: 1,
                  background: '#e86a17',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '9px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <MessageSquareHeart size={14} />
                Share feedback
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                style={{
                  background: '#f3f4f6',
                  color: '#6b7280',
                  border: 'none',
                  borderRadius: 10,
                  padding: '9px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Skip
              </button>
            </div>
          </>
        )}

        {/* ── Chips phase ──────────────────────────────── */}
        {phase === 'chips' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>
                What held you back?
              </p>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af' }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {REASON_CHIPS.map(({ key, label, emoji }) => (
                <button
                  key={key}
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSelectReason(key)}
                  style={{
                    background: '#fff7ed',
                    border: '1.5px solid #fed7aa',
                    borderRadius: 20,
                    padding: '6px 12px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#9a3412',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    opacity: submitting ? 0.5 : 1,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <span aria-hidden="true">{emoji}</span>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Text phase (for "other") ──────────────────── */}
        {phase === 'text' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>
                Tell us more (optional)
              </p>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af' }}
              >
                <X size={15} />
              </button>
            </div>
            <textarea
              value={extraText}
              onChange={(e) => setExtraText(e.target.value)}
              placeholder="What stopped you? (optional)"
              maxLength={500}
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1.5px solid #e5e7eb',
                borderRadius: 10,
                padding: '8px 10px',
                fontSize: 13,
                color: '#111827',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmitText()}
                style={{
                  flex: 1,
                  background: '#e86a17',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '9px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? 'Saving…' : 'Send feedback'}
              </button>
              <button
                type="button"
                onClick={() => void submitFeedback('other', '')}
                style={{
                  background: '#f3f4f6',
                  color: '#6b7280',
                  border: 'none',
                  borderRadius: 10,
                  padding: '9px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Skip
              </button>
            </div>
          </>
        )}

        {/* ── Done phase ───────────────────────────────── */}
        {phase === 'done' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }} aria-hidden="true">🙏</span>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>
                Thanks for the feedback!
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                It helps us improve.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Keyframe injected once */}
      <style>{`
        @keyframes fnudge-slide-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
