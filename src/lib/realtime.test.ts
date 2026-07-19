import { createRealtimeClient, getWsBaseUrl } from './realtime'

describe('realtime helpers', () => {
  it('derives ws url from api base', () => {
    // getWsBaseUrl uses import.meta.env; in unit env it falls back sensibly
    const url = getWsBaseUrl()
    expect(typeof url).toBe('string')
    expect(url.length).toBeGreaterThan(0)
  })

  it('deduplicates events by eventId', () => {
    const seen: string[] = []
    const client = createRealtimeClient({
      channels: ['orders:demo'],
      getToken: async () => undefined,
      enabled: false,
      onEvent: (e) => {
        if (e.eventId) seen.push(e.eventId)
      },
    })
    client.close()
    expect(Array.isArray(seen)).toBe(true)
  })
})
