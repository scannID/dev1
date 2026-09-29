/** Device-local list of events created on this browser (for create-event QR gallery). */

export type LocalCreatedEvent = {
  eventId: string
  eventName: string
  purchaseUrl: string
  managerUrl?: string
  eventDate?: string | null
  location?: string
  host?: string
  hostContact?: string
  /** Original create/edit form values for reliable local re-editing. */
  formSnapshot?: {
    date?: string
    time?: string
    saleStartsDate?: string
    saleStartsTime?: string
    saleEndsDate?: string
    saleEndsTime?: string
    location?: string
    host?: string
    hostContact?: string
    paymentDetails?: string
    template?: 'classic' | 'festival' | 'minimal' | 'gold'
    ticketClasses?: Array<{
      name?: string
      fee?: string
      capacity?: string
      saleEndsAt?: string
      presaleCode?: string
    }>
    tables?: Array<{
      name?: string
      seats?: string
      price?: string
      capacity?: string
      saleEndsAt?: string
    }>
    eventImageUrl?: string
    queueEnabled?: boolean
    category?: string
  }
  createdAt: string
}

const STORAGE_KEY = 'kodte-created-events'
const MAX_EVENTS = 40

/** Grace period after event date before it disappears (6 hours). */
const PAST_GRACE_MS = 6 * 60 * 60 * 1000

function isExpired(event: LocalCreatedEvent): boolean {
  if (!event.eventDate) return false
  try {
    const eventMs = new Date(event.eventDate).getTime()
    if (Number.isNaN(eventMs)) return false
    return Date.now() > eventMs + PAST_GRACE_MS
  } catch {
    return false
  }
}

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

/** For the public discovery page — excludes past events. */
export function loadCreatedEvents(): LocalCreatedEvent[] {
  return readAll()
    .filter((e) => !isExpired(e))
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
}

/** For the organiser gallery — includes past events so they can re-edit / revoke. */
export function loadAllCreatedEvents(): LocalCreatedEvent[] {
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
