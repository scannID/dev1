/**
 * og-server/server.mjs
 *
 * Lightweight Express server that replaces Nginx for the `merchant` Docker
 * container. It serves the Vite-built SPA static files exactly as Nginx did,
 * but intercepts requests from social crawlers and returns a minimal HTML
 * response with real, data-filled OG/Twitter meta tags baked in.
 *
 * ── COVERED ROUTES ──────────────────────────────────────────────────────────
 *
 *  Route                    Crawler gets                    Browser gets
 *  ─────────────────────    ──────────────────────────────  ────────────────
 *  /ticket/:token           OG shell — event name, date,    Normal SPA
 *                           image, tiers, host               (index.html)
 *  /pay/:token              OG shell — description,          Normal SPA
 *                           amount, currency, owner          (index.html)
 *  All other routes         Normal SPA index.html            Normal SPA
 *                           (OG tags come from the static    (index.html)
 *                           defaults baked into index.html)
 *
 * ── ROUTES NOT COVERED (static defaults only) ───────────────────────────────
 *  /                        Landing page — static OG tags are baked into
 *                           index.html (Organization JSON-LD + og:image).
 *  /create-event            Static creation form — no meaningful per-request
 *                           data, static OG in index.html is fine.
 *  /b/:id, /kitchen/*       Internal/merchant routes — no social sharing.
 *  /track/:number           Payment tracking — noindex by design.
 *  Marketing slugs          Static content — static OG in index.html covers
 *  (/pricing, /about…)      these. Per-slug titles are client-side only.
 *
 * ── HOW TO TEST ─────────────────────────────────────────────────────────────
 *  # Ticket page:
 *  curl -s -A "facebookexternalhit/1.1" https://kodte.ug/ticket/YOUR_TOKEN | grep og:
 *
 *  # Quick pay page:
 *  curl -s -A "Twitterbot/1.0" https://kodte.ug/pay/YOUR_QR_TOKEN | grep og:
 *
 *  # Real browser — should get normal SPA (empty root div):
 *  curl -s https://kodte.ug/ticket/YOUR_TOKEN | grep 'id="root"'
 *
 * ── ENVIRONMENT VARIABLES ───────────────────────────────────────────────────
 *  PORT               Listening port (default: 3000)
 *  API_BASE_URL       Internal API URL — e.g. http://api-1:4000/api
 *                     NOT the public https://api.kodte.com/api — resolved
 *                     inside Docker network without TLS.
 *  SITE_BASE_URL      Public site URL for canonical/og:url (default: https://kodte.ug)
 *  STATIC_DIR         Path to the Vite dist/ output (default: /app/dist)
 *  API_TIMEOUT_MS     Max ms to wait for the API before falling back (default: 4000)
 */

import express from 'express'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'

// ── Config ───────────────────────────────────────────────────────────────────

const PORT         = parseInt(process.env.PORT         ?? '3000', 10)
const API_BASE_URL = (process.env.API_BASE_URL         ?? 'http://api-1:4000/api').replace(/\/$/, '')
const SITE_BASE    = (process.env.SITE_BASE_URL        ?? 'https://kodte.ug').replace(/\/$/, '')
const STATIC_DIR   = process.env.STATIC_DIR            ?? '/app/dist'
const API_TIMEOUT  = parseInt(process.env.API_TIMEOUT_MS ?? '4000', 10)
const INDEX_HTML   = join(STATIC_DIR, 'index.html')

// ── Crawler detection ────────────────────────────────────────────────────────
//
// Social platforms send distinctive User-Agent strings. We only intercept for
// these — all real browsers get the normal SPA. Keep the list explicit so a
// compromised bot can't force server-side rendering for arbitrary requests.

const CRAWLER_RE = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|Slackbot|LinkedInBot|Discord|Discordbot|iframely|Embedly|Google-InspectionTool|googlebot-preview|vkShare|outbrain|pinterest|Pinterestbot|bingbot-preview|Bytespider|applebot/i

function isCrawler(req) {
  const ua = req.headers['user-agent'] ?? ''
  return CRAWLER_RE.test(ua)
}

// ── API helpers ──────────────────────────────────────────────────────────────

/**
 * Fetch JSON from the internal API with a hard timeout.
 * Returns null on any error — callers always fall back to index.html.
 */
async function apiFetch(path) {
  const url = `${API_BASE_URL}${path}`
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), API_TIMEOUT)
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'kodte-og-server/1.0' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ── HTML escape ──────────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ── OG shell template ────────────────────────────────────────────────────────
//
// We return a minimal HTML document — no React, no CSS, no JS bundle.
// Social crawlers only need the <head> meta tags; they don't render the page.
// The <body> contains a canonical redirect so any human who somehow lands here
// (e.g. via Googlebot rendering) is forwarded to the SPA.

function buildOgShell({ title, description, imageUrl, canonicalUrl, extraMeta = '' }) {
  const safeTitle       = esc(title)
  const safeDescription = esc(description)
  const safeImage       = esc(imageUrl || `${SITE_BASE}/og-image.png`)
  const safeCanonical   = esc(canonicalUrl)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <link rel="canonical" href="${safeCanonical}" />
  <meta name="robots" content="noindex, nofollow" />

  <!-- Open Graph -->
  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="Kodte" />
  <meta property="og:url"         content="${safeCanonical}" />
  <meta property="og:title"       content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image"       content="${safeImage}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter / X Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image"       content="${safeImage}" />
${extraMeta}
</head>
<body>
  <!-- OG shell — rendered for social crawlers only. Real browsers receive the SPA. -->
  <script>window.location.replace(${JSON.stringify(canonicalUrl)})</script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${safeCanonical}" />
  </noscript>
</body>
</html>`
}

// ── Route handlers ───────────────────────────────────────────────────────────

/**
 * /ticket/:masterQrToken
 * API: GET /tickets/public/event/:masterQrToken
 *
 * TicketEventInfo fields used:
 *   eventName, eventDate, eventImageUrl, host, currency,
 *   ticketClasses[].name + price, tables[].name + price
 */
async function handleTicketCrawler(req, res) {
  const { masterQrToken } = req.params
  const data = await apiFetch(`/tickets/public/event/${encodeURIComponent(masterQrToken)}`)

  if (!data) {
    // API unavailable or token invalid — fall back to index.html so the SPA
    // can render its own error state.
    return serveIndex(res)
  }

  // Build a human-readable price list for the description
  const allOptions = [
    ...(data.ticketClasses ?? []),
    ...(data.tables ?? []),
  ]
  const priceList = allOptions
    .map((o) => `${o.name}: ${o.price.toLocaleString('en-UG')} ${data.currency}`)
    .join(' · ')

  const dateStr = data.eventDate
    ? new Date(data.eventDate).toLocaleDateString('en-UG', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      })
    : null

  const titleParts = [data.eventName]
  if (dateStr) titleParts.push(dateStr)
  const title = titleParts.join(' — ')

  const descParts = []
  if (data.host) descParts.push(`Hosted by ${data.host}.`)
  if (priceList) descParts.push(`Tickets: ${priceList}.`)
  descParts.push('Buy via mobile money — no app required.')
  const description = descParts.join(' ')

  const imageUrl = data.eventImageUrl || null
  const canonicalUrl = `${SITE_BASE}/ticket/${encodeURIComponent(masterQrToken)}`

  // Structured data — Event schema for rich results
  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: data.eventName,
    ...(data.eventDate ? { startDate: data.eventDate } : {}),
    ...(data.host ? { organizer: { '@type': 'Organization', name: data.host } } : {}),
    url: canonicalUrl,
    ...(imageUrl ? { image: [imageUrl] } : {}),
    offers: allOptions.map((o) => ({
      '@type': 'Offer',
      name: o.name,
      price: String(o.price),
      priceCurrency: data.currency,
      availability: o.soldOut
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      url: canonicalUrl,
    })),
  }
  const extraMeta = `  <script type="application/ld+json">${JSON.stringify(eventSchema)}</script>`

  const html = buildOgShell({ title, description, imageUrl, canonicalUrl, extraMeta })
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  res.status(200).send(html)
}

/**
 * /pay/:qrToken
 * API: GET /quick-payments/codes/qr/:qrToken
 *
 * QuickPaymentCode fields used:
 *   description, amount, currency, ownerName, canBeUsed, status
 */
async function handlePayCrawler(req, res) {
  const { qrToken } = req.params
  const data = await apiFetch(`/quick-payments/codes/qr/${encodeURIComponent(qrToken)}`)

  if (!data) {
    return serveIndex(res)
  }

  const amountStr = `${data.amount.toLocaleString('en-UG')} ${data.currency}`
  const title = `Pay ${amountStr} — ${data.description}`
  const descParts = [`Scan to pay ${amountStr} for ${data.description} via mobile money.`]
  if (data.ownerName) descParts.push(`Collected by ${data.ownerName}.`)
  if (!data.canBeUsed) descParts.push('This payment QR is no longer active.')
  const description = descParts.join(' ')
  const canonicalUrl = `${SITE_BASE}/pay/${encodeURIComponent(qrToken)}`

  const html = buildOgShell({ title, description, imageUrl: null, canonicalUrl })
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  res.status(200).send(html)
}

// ── Static file serving ───────────────────────────────────────────────────────

/**
 * Serve index.html — the normal SPA entry point for browsers.
 * Cache-Control: no-cache so browsers always revalidate (Vite assets are
 * content-hashed and cached permanently; index.html must stay fresh).
 */
function serveIndex(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  return res.status(200).sendFile(INDEX_HTML)
}

// ── Express app ───────────────────────────────────────────────────────────────

const app = express()

// Health endpoint — used by Docker healthcheck and Caddy upstreams.
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }))

// ── Crawler intercepts (before static middleware) ────────────────────────────

app.get('/ticket/:masterQrToken', async (req, res, next) => {
  if (!isCrawler(req)) return next()
  try {
    await handleTicketCrawler(req, res)
  } catch (err) {
    console.error('[og-server] /ticket handler error:', err)
    serveIndex(res)
  }
})

app.get('/pay/:qrToken', async (req, res, next) => {
  if (!isCrawler(req)) return next()
  try {
    await handlePayCrawler(req, res)
  } catch (err) {
    console.error('[og-server] /pay handler error:', err)
    serveIndex(res)
  }
})

// ── Static assets (Vite content-hashed files) ────────────────────────────────

app.use(express.static(STATIC_DIR, {
  // Vite output files are content-hashed — safe to cache for a long time.
  maxAge: '1y',
  immutable: true,
  // Don't serve index.html for directory requests — let the fallback below handle it.
  index: false,
}))

// ── SPA fallback — all unmatched routes → index.html ─────────────────────────
//
// This replicates Nginx's `try_files $uri $uri/ /index.html` behaviour.
// Crawlers on unknown routes get the default index.html OG tags (landing page).

app.use((_req, res) => serveIndex(res))

// ── Start ─────────────────────────────────────────────────────────────────────

if (!existsSync(INDEX_HTML)) {
  console.error(`[og-server] FATAL: index.html not found at ${INDEX_HTML}`)
  console.error('[og-server] Make sure STATIC_DIR points to the Vite dist/ output.')
  process.exit(1)
}

app.listen(PORT, () => {
  console.log(`[og-server] Listening on :${PORT}`)
  console.log(`[og-server] Serving SPA from: ${STATIC_DIR}`)
  console.log(`[og-server] API base: ${API_BASE_URL}`)
  console.log(`[og-server] Site base: ${SITE_BASE}`)
})
