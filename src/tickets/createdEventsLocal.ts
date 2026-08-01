/** Device-local list of events created on this browser (for create-event QR gallery). */

export type LocalCreatedEvent = {
  eventId: string
  eventName: string
  purchaseUrl: string
  eventDate?: string | null
  location?: string
  host?: string
  createdAt: string
}

const STORAGE_KEY = 'kode-created-events'
const MAX_EVENTS = 40

function readAll(): LocalCreatedEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LocalCreatedEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(events: LocalCreatedEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)))
  } catch {
    // ignore quota / private mode
  }
}

export function loadCreatedEvents(): LocalCreatedEvent[] {
  return readAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function saveCreatedEvent(event: LocalCreatedEvent): LocalCreatedEvent[] {
  const existing = readAll().filter((entry) => entry.eventId !== event.eventId)
  const next = [event, ...existing].slice(0, MAX_EVENTS)
  writeAll(next)
  return loadCreatedEvents()
}

export function removeCreatedEvent(eventId: string): LocalCreatedEvent[] {
  const next = readAll().filter((entry) => entry.eventId !== eventId)
  writeAll(next)
  return loadCreatedEvents()
}
