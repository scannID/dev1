/** Format kitchen ETA like "~12–15 min". */
export function formatWaitRange(minutes?: number | null): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null
  const low = Math.max(1, Math.round(minutes))
  const high = Math.min(45, low + 3)
  if (high <= low) return `~${low} min`
  return `~${low}–${high} min`
}
