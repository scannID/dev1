import { useState } from 'react'
import { operationsApi } from '../api/operations'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function OrderFeedbackForm({
  publicId,
  phone,
}: {
  publicId: string
  phone: string
}) {
  const [rating, setRating] = useState(1)
  const [comment, setComment] = useState('')
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitFeedback() {
    const cleanPhone = phone.trim()
    if (!cleanPhone) {
      setError('Missing phone number for feedback. Reopen your order and try again.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await operationsApi.submitFeedback(publicId, {
        rating,
        comment: comment.trim(),
        phone: cleanPhone,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback right now')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return <p className="cm-muted">Thanks for your feedback!</p>
  }

  return (
    <div className="cm-feedback">
      <p className="cm-muted">How was your order?</p>
      <div className="cm-feedback-stars">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            className={value <= rating ? 'active' : ''}
            onClick={() => setRating(value)}
            aria-label={`${value} star${value === 1 ? '' : 's'}`}
            aria-pressed={value === rating}
            title={`${value} star${value === 1 ? '' : 's'}`}
          >
            ★
          </button>
        ))}
      </div>
      <p className="cm-muted">{rating} out of 5 stars</p>
      <Textarea placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      {error ? <p className="cm-field-error">{error}</p> : null}
      <Button
        className="cm-full"
        disabled={submitting}
        onClick={() => void submitFeedback()}
      >
        {submitting ? 'Submitting...' : 'Submit feedback'}
      </Button>
    </div>
  )
}
