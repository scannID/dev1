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
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [done, setDone] = useState(false)

  if (done) {
    return <p className="cm-muted">Thanks for your feedback!</p>
  }

  return (
    <div className="cm-feedback">
      <p className="cm-muted">How was your order?</p>
      <div className="cm-feedback-stars">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" className={value <= rating ? 'active' : ''} onClick={() => setRating(value)}>
            {value}
          </button>
        ))}
      </div>
      <Textarea placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button
        className="cm-full"
        onClick={() => void operationsApi.submitFeedback(publicId, { rating, comment, phone }).then(() => setDone(true))}
      >
        Submit feedback
      </Button>
    </div>
  )
}
