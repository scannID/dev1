import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { ApiError } from '../api/client'
import { publicTicketsApi } from '../api/services'
import type { EventTicketTrackingMetrics, Ticket } from '../api/types'
import './GateScan.css'

type Props = {
  gateName?: string
  gateLocation?: string
  initialPayload?: string | null
  initialEventId?: string | null
}

/** How long the result stays up before scanning resumes. */
const RESUME_MS = 2400
const SAME_CODE_COOLDOWN_MS = 4000
const METRICS_POLL_MS = 15000

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>
}

type Verdict = {
  tone: 'ok' | 'bad'
  title: string
  reason: string
  ticket?: Ticket | null
}

function extractTicketPayload(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('SCANNY:TICKET:')) return trimmed
  try {
    const url = new URL(trimmed)
    const fromQuery = url.searchParams.get('p') || url.searchParams.get('payload')
    if (fromQuery?.startsWith('SCANNY:TICKET:')) return fromQuery
  } catch {
    // not a URL
  }
  const marker = trimmed.indexOf('SCANNY:TICKET:')
  if (marker >= 0) return trimmed.slice(marker)
  return trimmed
}

function normalizeEventRef(raw: string) {
  return raw.trim().replace(/^#/, '').toUpperCase()
}

function money(amount: number, currency: string) {
  return `${amount.toLocaleString()} ${currency || 'UGX'}`
}

function canUseCamera() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

/**
 * Browsers only expose the camera in a secure context, so a plain-HTTP LAN URL
 * silently has no mediaDevices at all. Point staff at the https address instead.
 */
function cameraBlockedMessage() {
  if (typeof window === 'undefined') return 'This device cannot open a camera.'
  const { protocol, host, pathname, search } = window.location
  if (protocol !== 'https:') {
    return `The camera is blocked because this page is on ${protocol}//${host}. Open https://${host}${pathname}${search} instead (accept the certificate warning once).`
  }
  return 'This browser refused camera access. Allow the camera permission for this site, then tap Retry camera.'
}

async function waitForVideo(
  getVideo: () => HTMLVideoElement | null,
  timeoutMs = 2500,
): Promise<HTMLVideoElement | null> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const video = getVideo()
    if (video) return video
    await new Promise((r) => window.setTimeout(r, 40))
  }
  return getVideo()
}

function CheckIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function ScanIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export default function GateScanPage({
  gateName = 'Gate Device',
  gateLocation = 'Main Gate',
  initialPayload = null,
  initialEventId = null,
}: Props) {
  const [eventRef, setEventRef] = useState(() => normalizeEventRef(initialEventId || ''))
  const [sessionEventId, setSessionEventId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<EventTicketTrackingMetrics | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanTimerRef = useRef<number | null>(null)
  const scanLoopIdRef = useRef(0)
  const resumeTimerRef = useRef<number | null>(null)
  const metricsTimerRef = useRef<number | null>(null)
  const barcodeDetectorRef = useRef<BarcodeDetectorLike | null>(null)
  const busyRef = useRef(false)
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null)
  const sessionEventIdRef = useRef<string | null>(null)
  const pausedRef = useRef(false)
  const pendingPayloadRef = useRef(extractTicketPayload(initialPayload || ''))
  const submitScanRef = useRef<(payload: string) => Promise<void>>(async () => {})
  const startCameraRef = useRef<() => Promise<void>>(async () => {})
  const refreshMetricsRef = useRef<(eventId: string) => Promise<void>>(async () => {})

  useEffect(() => {
    sessionEventIdRef.current = sessionEventId
  }, [sessionEventId])

  useEffect(() => {
    const Detector = (
      window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike }
    ).BarcodeDetector
    if (typeof Detector === 'function') {
      try {
        barcodeDetectorRef.current = new Detector({ formats: ['qr_code'] })
      } catch {
        barcodeDetectorRef.current = null
      }
    }
  }, [])

  const refreshMetrics = useCallback(async (eventId: string) => {
    try {
      const data = await publicTicketsApi.track(eventId)
      setMetrics(data)
    } catch {
      // Keep last known counts if refresh fails mid-session.
    }
  }, [])

  const pauseScanning = useCallback(() => {
    pausedRef.current = true
  }, [])

  const clearScanLoop = useCallback(() => {
    scanLoopIdRef.current += 1
    if (scanTimerRef.current != null) {
      window.clearTimeout(scanTimerRef.current)
      scanTimerRef.current = null
    }
  }, [])

  const stopCamera = useCallback(() => {
    clearScanLoop()
    if (resumeTimerRef.current != null) {
      window.clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    busyRef.current = false
    pausedRef.current = false
    lastCodeRef.current = null
    setCameraActive(false)
  }, [clearScanLoop])

  const readCodeFromVideo = useCallback(async (video: HTMLVideoElement): Promise<string | null> => {
    if (video.readyState < 2 || video.paused || video.ended) {
      try {
        await video.play()
      } catch {
        return null
      }
    }
    if (barcodeDetectorRef.current) {
      try {
        const barcodes = await barcodeDetectorRef.current.detect(video)
        const native = barcodes.find((b) => !!b.rawValue)?.rawValue?.trim()
        if (native) return native
      } catch {
        // fall through to jsQR
      }
    }

    const canvas = canvasRef.current
    if (!canvas || video.videoWidth < 16 || video.videoHeight < 16) return null
    const scale = Math.min(1, 640 / video.videoWidth)
    const w = Math.max(1, Math.floor(video.videoWidth * scale))
    const h = Math.max(1, Math.floor(video.videoHeight * scale))
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, w, h)
    const image = ctx.getImageData(0, 0, w, h)
    const decoded = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
    return decoded?.data?.trim() || null
  }, [])

  // Serial scan loop (recursive timeout) — setInterval + async was stacking
  // overlapping reads and leaving busyRef stuck after the first hit.
  const startScanLoop = useCallback(() => {
    clearScanLoop()
    const loopId = scanLoopIdRef.current

    const tick = async () => {
      scanTimerRef.current = null
      if (loopId !== scanLoopIdRef.current || !sessionEventIdRef.current) return

      if (!busyRef.current && !pausedRef.current && videoRef.current) {
        try {
          const code = await readCodeFromVideo(videoRef.current)
          if (
            loopId === scanLoopIdRef.current &&
            code &&
            !busyRef.current &&
            !pausedRef.current
          ) {
            const last = lastCodeRef.current
            const now = Date.now()
            const duplicate =
              !!last && last.code === code && now - last.at < SAME_CODE_COOLDOWN_MS
            if (!duplicate) {
              busyRef.current = true
              lastCodeRef.current = { code, at: now }
              await submitScanRef.current(code)
            }
          }
        } catch {
          if (loopId === scanLoopIdRef.current) busyRef.current = false
        }
      }

      if (loopId === scanLoopIdRef.current && sessionEventIdRef.current) {
        scanTimerRef.current = window.setTimeout(() => {
          void tick()
        }, 280)
      }
    }

    void tick()
  }, [clearScanLoop, readCodeFromVideo])

  const wakeVideo = useCallback(async () => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return false
    const live = stream.getVideoTracks().some((t) => t.readyState === 'live')
    if (!live) return false
    if (video.srcObject !== stream) video.srcObject = stream
    try {
      await video.play()
    } catch {
      // Autoplay may already be running.
    }
    return true
  }, [])

  const resumeScanning = useCallback(() => {
    pausedRef.current = false
    busyRef.current = false
    void wakeVideo().then((ok) => {
      if (ok) {
        setCameraActive(true)
        setCameraError(null)
        startScanLoop()
      } else {
        setCameraActive(false)
        setCameraError('Camera stopped after the last scan. Tap Retry camera.')
      }
    })
  }, [startScanLoop, wakeVideo])

  const dismissVerdict = useCallback(() => {
    if (resumeTimerRef.current != null) {
      window.clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
    setVerdict(null)
    // Allow the next guest's QR immediately; same-code cooldown still blocks
    // accidental double-fire of the ticket we just handled.
    resumeScanning()
  }, [resumeScanning])

  const scheduleResumeScan = useCallback(() => {
    pauseScanning()
    if (resumeTimerRef.current != null) {
      window.clearTimeout(resumeTimerRef.current)
    }
    resumeTimerRef.current = window.setTimeout(() => {
      resumeTimerRef.current = null
      setVerdict(null)
      resumeScanning()
    }, RESUME_MS)
  }, [pauseScanning, resumeScanning])

  const submitScan = useCallback(
    async (scannedPayload: string) => {
      const raw = extractTicketPayload(scannedPayload)
      if (!raw) {
        busyRef.current = false
        return
      }
      const eventId = sessionEventIdRef.current
      if (!eventId) {
        busyRef.current = false
        return
      }

      pauseScanning()
      try {
        const response = await publicTicketsApi.validate({
          payload: raw,
          eventId,
          scannedBy: gateName,
          scanLocation: gateLocation,
          deviceInfo: navigator.userAgent,
        })
        setVerdict({
          tone: response.valid ? 'ok' : 'bad',
          title: response.valid ? 'Entry allowed' : 'Rejected',
          reason: response.message,
          ticket: response.ticket,
        })
        if (response.valid) {
          void refreshMetrics(eventId)
        }
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message || 'Scan failed'
            : err instanceof Error
              ? err.message
              : 'Scan failed'
        setVerdict({ tone: 'bad', title: 'Rejected', reason: message, ticket: null })
      } finally {
        scheduleResumeScan()
      }
    },
    [gateLocation, gateName, pauseScanning, refreshMetrics, scheduleResumeScan],
  )

  const startCamera = useCallback(async () => {
    if (!sessionEventIdRef.current) return
    setCameraError(null)
    setVerdict(null)
    try {
      if (!canUseCamera()) {
        setCameraError(cameraBlockedMessage())
        return
      }

      // Reuse an already-live stream — never bounce staff back to the ID screen.
      if (streamRef.current) {
        const ok = await wakeVideo()
        if (ok) {
          setCameraActive(true)
          resumeScanning()
          return
        }
        // Track died — fall through and request a fresh stream.
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream

      const video = await waitForVideo(() => videoRef.current)
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setCameraError('Scanner view is not ready yet. Tap Retry camera.')
        return
      }

      video.srcObject = stream
      await video.play()
      setCameraActive(true)
      resumeScanning()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start camera'
      setCameraError(
        /NotAllowed|Permission/i.test(message)
          ? 'Camera access is blocked. Allow the camera for this site, then tap Retry camera.'
          : message,
      )
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      setCameraActive(false)
      clearScanLoop()
    }
  }, [clearScanLoop, resumeScanning, wakeVideo])

  // Keep the latest callbacks reachable from the session effect / scan loop
  // without putting them in dependency lists that would restart the camera.
  useEffect(() => {
    startCameraRef.current = startCamera
    submitScanRef.current = submitScan
    refreshMetricsRef.current = refreshMetrics
  }, [startCamera, submitScan, refreshMetrics])

  // Open camera only after the session screen (and <video>) has mounted.
  // Depend only on sessionEventId so we don't tear the stream down on re-renders.
  useEffect(() => {
    if (!sessionEventId) return

    let cancelled = false
    ;(async () => {
      await refreshMetricsRef.current(sessionEventId)
      if (cancelled) return
      await startCameraRef.current()
      if (cancelled) return
      const queued = pendingPayloadRef.current
      if (queued) {
        pendingPayloadRef.current = ''
        void submitScanRef.current(queued)
      }
    })()

    metricsTimerRef.current = window.setInterval(() => {
      void refreshMetricsRef.current(sessionEventId)
    }, METRICS_POLL_MS)

    return () => {
      cancelled = true
      if (metricsTimerRef.current != null) {
        window.clearInterval(metricsTimerRef.current)
        metricsTimerRef.current = null
      }
    }
  }, [sessionEventId])

  // Tear down camera only when leaving the page.
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  async function beginSession(event: React.FormEvent) {
    event.preventDefault()
    const id = normalizeEventRef(eventRef)
    if (!id) {
      setError('Enter the event ID (ERI-…) shown when the event was created')
      return
    }
    try {
      const data = await publicTicketsApi.track(id)
      // track() also resolves an attendee ticket up to its event. A guest's
      // TKT id must not open a gate session, so only accept the event's own id.
      const resolved = normalizeEventRef(data.ticketId || '')
      if (resolved && resolved !== id) {
        setError(
          `${id} is a guest ticket, not an event ID. Enter the event ID (${resolved}) shown when the event was created.`,
        )
        return
      }
      setMetrics(data)
      setError(null)
      setVerdict(null)
      setCameraError(null)
      pauseScanning()
      setSessionEventId(data.ticketId || id)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message || 'Event not found'
          : err instanceof Error
            ? err.message
            : 'Event not found'
      setError(message)
    }
  }

  function endSession() {
    stopCamera()
    setSessionEventId(null)
    setMetrics(null)
    setVerdict(null)
    setError(null)
    setCameraError(null)
  }

  const ticket = verdict?.ticket
  const bought = metrics?.purchasedTickets ?? 0
  const redeemed = metrics?.redeemedTickets ?? 0
  const eventLabel = metrics?.eventName || sessionEventId

  if (!sessionEventId) {
    return (
      <div className="gate-shell">
        <div className="gate-setup">
          <div className="gate-setup-card">
            <div className="gate-badge">
              <ScanIcon size={26} />
            </div>
            <p className="gate-eyebrow">Gate collection</p>
            <h1 className="gate-heading">Start a gate session</h1>
            <p className="gate-sub">
              Enter the event ID from creation. The camera stays open for the whole session — you only
              enter the ID once.
            </p>

            <form onSubmit={(e) => void beginSession(e)} className="gate-form">
              <label className="gate-field">
                <span className="gate-field-label">Event ID</span>
                <input
                  className="gate-input"
                  value={eventRef}
                  onChange={(e) => setEventRef(e.target.value)}
                  placeholder="ERI-3D02AA56"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  autoFocus
                />
              </label>
              <button type="submit" className="gate-btn gate-btn-primary" disabled={!eventRef.trim()}>
                Open scanner
              </button>
              {error ? <p className="gate-alert" role="alert">{error}</p> : null}
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="gate-shell">
      <header className="gate-topbar">
        <div className="gate-event">
          <p className="gate-event-label">{eventLabel}</p>
          <p className="gate-event-id">{sessionEventId}</p>
        </div>
        <div className="gate-counts">
          <div className="gate-count">
            <p className="gate-count-value">{bought}</p>
            <p className="gate-count-label">Bought</p>
          </div>
          <div className="gate-count is-allowed">
            <p className="gate-count-value">{redeemed}</p>
            <p className="gate-count-label">Redeemed</p>
          </div>
        </div>
        <button type="button" className="gate-icon-btn" onClick={endSession} aria-label="End gate session">
          <CloseIcon />
        </button>
      </header>

      <main className="gate-stage">
        {/* Keep the video in the DOM for the whole session so the stream never detaches. */}
        <video
          ref={videoRef}
          className="gate-video"
          muted
          playsInline
          style={{ opacity: cameraActive ? 1 : 0 }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden />

        {cameraActive && !verdict ? (
          <>
            <div className="gate-reticle">
              <span className="gate-corner tl" />
              <span className="gate-corner tr" />
              <span className="gate-corner bl" />
              <span className="gate-corner br" />
              <span className="gate-laser" />
            </div>
            <div className="gate-prompt">
              <span className="gate-dot" />
              Hold the ticket QR in the frame
            </div>
          </>
        ) : null}

        {!cameraActive && !verdict ? (
          <div className="gate-idle">
            <div className="gate-idle-icon">
              <ScanIcon size={28} />
            </div>
            <p className="gate-idle-text">
              {cameraError || 'Camera is starting…'}
            </p>
            <button type="button" className="gate-btn gate-btn-primary" onClick={() => void startCamera()}>
              Retry camera
            </button>
          </div>
        ) : null}

        {verdict ? (
          <div className={`gate-result ${verdict.tone === 'ok' ? 'is-ok' : 'is-bad'}`} role="status" aria-live="assertive">
            <div className="gate-result-body">
              <div className="gate-verdict-icon">
                {verdict.tone === 'ok' ? <CheckIcon /> : <CrossIcon />}
              </div>
              <p className="gate-verdict">{verdict.title}</p>

              {ticket ? (
                <>
                  <p className="gate-guest">{ticket.holderName || 'Guest'}</p>
                  <span className="gate-class">{ticket.ticketType}</span>
                  <div className="gate-details">
                    {ticket.eventName ? (
                      <div className="gate-detail-row">
                        <span className="gate-detail-key">Event</span>
                        <span className="gate-detail-value">{ticket.eventName}</span>
                      </div>
                    ) : null}
                    <div className="gate-detail-row">
                      <span className="gate-detail-key">Ticket</span>
                      <span className="gate-detail-value is-mono">{ticket.id}</span>
                    </div>
                    <div className="gate-detail-row">
                      <span className="gate-detail-key">Paid</span>
                      <span className="gate-detail-value">{money(ticket.price, ticket.currency)}</span>
                    </div>
                    <div className="gate-detail-row">
                      <span className="gate-detail-key">Entries used</span>
                      <span className="gate-detail-value">
                        {ticket.usageCount} / {ticket.usageLimit}
                      </span>
                    </div>
                  </div>
                </>
              ) : null}

              {!ticket || verdict.tone === 'bad' ? (
                <p className="gate-reason">{verdict.reason}</p>
              ) : null}
            </div>

            <div className="gate-resume">
              <p className="gate-resume-label">Next guest</p>
              <div className="gate-resume-track">
                <span className="gate-resume-fill" />
              </div>
              <button
                type="button"
                className="gate-btn gate-btn-ghost gate-resume-cancel"
                onClick={dismissVerdict}
              >
                Cancel — scan next
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
