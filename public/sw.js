const CACHE = 'kode-menu-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE))
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET') return
  if (!url.pathname.includes('/api/businesses/') || !url.pathname.endsWith('/menu')) return

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const response = await fetch(event.request)
        if (response.ok) {
          cache.put(event.request, response.clone())
        }
        return response
      } catch {
        const cached = await cache.match(event.request)
        if (cached) return cached
        throw new Error('offline')
      }
    }),
  )
})
