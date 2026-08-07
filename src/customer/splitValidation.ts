/** Guest bill-split helpers — amounts are whole UGX (no fractional shillings). */

export type SplitShareDraft = {
  name: string
  phone: string
  amount: string
}

export type SplitValidation = {
  ok: boolean
  allocated: number
  remaining: number
  errors: string[]
}

/** Equal split: leftover UGX from total % n goes +1 to the first remainder guests. */
export function distributeEqually(
  totalUgx: number,
  count: number,
  existing: SplitShareDraft[] = [],
): SplitShareDraft[] {
  const n = Math.max(2, Math.min(8, count))
  const total = Math.round(totalUgx)
  const base = Math.floor(total / n)
  const rem = total % n
  return Array.from({ length: n }, (_, i) => ({
    name: existing[i]?.name?.trim() || `Guest ${i + 1}`,
    phone: existing[i]?.phone ?? '0',
    amount: String(base + (i < rem ? 1 : 0)),
  }))
}

/**
 * After the user edits share at `changedIndex`, assign whatever remains
 * of the total to the last share that isn't the changed one.
 */
export function redistributeRemaining(
  totalUgx: number,
  shares: SplitShareDraft[],
  changedIndex: number,
): SplitShareDraft[] {
  const total = Math.round(totalUgx)
  if (shares.length < 2) return shares

  // Target is last share that isn't the one just changed
  const targetIndex = shares.length - 1 === changedIndex ? shares.length - 2 : shares.length - 1

  // Sum everything except the target
  const sumExcludingTarget = shares.reduce((sum, s, i) => {
    if (i === targetIndex) return sum
    return sum + (Math.round(Number(s.amount)) || 0)
  }, 0)

  const targetAmount = Math.max(1, total - sumExcludingTarget)

  return shares.map((s, i) =>
    i === targetIndex ? { ...s, amount: String(targetAmount) } : s,
  )
}

export function validateCustomSplit(
  orderTotal: number,
  shares: SplitShareDraft[],
  validatePhone: (phone: string) => string | null,
): SplitValidation {
  const errors: string[] = []
  const total = Math.round(orderTotal)

  if (shares.length < 2 || shares.length > 8) {
    errors.push('Split requires 2–8 guests')
  }

  const amounts = shares.map((share, i) => {
    if (!share.name.trim()) {
      errors.push(`Guest ${i + 1}: name required`)
    }
    const phoneErr = validatePhone(share.phone.trim())
    if (phoneErr) {
      errors.push(`Guest ${i + 1}: ${phoneErr}`)
    }
    const amount = Math.round(Number(share.amount))
    if (!Number.isFinite(amount) || amount < 1) {
      errors.push(`Guest ${i + 1}: amount must be at least 1 UGX`)
      return 0
    }
    return amount
  })

  const allocated = amounts.reduce((sum, n) => sum + n, 0)
  if (allocated !== total) {
    errors.push(
      allocated < total
        ? `Allocate ${total - allocated} UGX more`
        : `Over by ${allocated - total} UGX`,
    )
  }

  return {
    ok: errors.length === 0,
    allocated,
    remaining: total - allocated,
    errors,
  }
}
