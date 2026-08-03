import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { ApiError } from '../api/client'
import { publicTicketsApi } from '../api/services'
import type { EventTicketTrackingMetrics, Ticket } from '../api/types'
import { KodeMark } from '../customer/KodeMark'
import './GateScan.css'

type Props = {
  gateName?: string
  gateLocation?: string
  initialPayload?: string | null
  initialEventId?: string | null
}

/** Brief flash after allow — keep the line moving. */
const RESUME_OK_MS = 900
/** Longer flash on reject so staff can read why. */
const RESUME_BAD_MS = 2200
const SAME_CODE_COOLDOWN_MS = 4000
const METRICS_POLL_MS = 15000
const LAST_EVENT_KEY = 'kode-gate-last-event'
const ACTIVE_SESSION_KEY = 'kode-gate-active-event'
/** Ignore frames briefly after camera opens so a leftover QR isn't auto-fired. */
const CAMERA_WARMUP_MS = 1200

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
    const gatePath = pathname.startsWith('/ticket/gate') ? pathname : '/ticket/gate'
    const target = `https://${host}${gatePath}${search}`
    return `Camera is blocked on ${protocol}//${host}. Open ${target} instead, accept the browser certificate warning once, then retry camera.`
  }
  return 'This browser refused camera access. Allow the camera permission for this site, then tap Retry camera.'
}

function secureGateUrl() {
  if (typeof window === 'undefined') return ''
  const { host, pathname, search, hash } = window.location
  const gatePath = pathname.startsWith('/ticket/gate') ? pathname : '/ticket/gate'
  return `https://${host}${gatePath}${search}${hash}`
}

function cameraStartErrorMessage(err: unknown) {
  if (!(err instanceof Error)) return 'Could not start camera'
  const name = err.name || ''
  const message = err.message || ''
  if (/NotAllowedError|SecurityError/i.test(name) || /NotAllowed|Permission/i.test(message)) {
    return cameraBlockedMessage()
  }
  if (/NotFoundError|OverconstrainedError|NotReadableError/i.test(name)) {
    return 'No usable camera was found. Close other apps using camera, then tap Retry camera.'
  }
  return message || 'Could not start camera'
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

function loadLastEventId() {
  try {
    return normalizeEventRef(localStorage.getItem(LAST_EVENT_KEY) || '')
  } catch {
    return ''
  }
}

function saveLastEventId(eventId: string) {
  try {
    localStorage.setItem(LAST_EVENT_KEY, normalizeEventRef(eventId))
  } catch {
    // ignore
  }
}

function loadActiveSessionEventId() {
  try {
    return normalizeEventRef(localStorage.getItem(ACTIVE_SESSION_KEY) || '')
  } catch {
    return ''
  }
}

function saveActiveSessionEventId(eventId: string) {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, normalizeEventRef(eventId))
  } catch {
    // ignore
  }
}

function clearActiveSessionEventId() {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY)
  } catch {
    // ignore
  }
}

/** Soft beep so staff can keep eyes on the queue. */
function playGateTone(ok: boolean) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = ok ? 880 : 240
    gain.gain.value = 0.07
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime
    osc.start(now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + (ok ? 0.14 : 0.32))
    osc.stop(now + (ok ? 0.15 : 0.34))
    window.setTimeout(() => void ctx.close(), 500)
  } catch {
    // ignore autoplay / unsupported
  }
}

export default function GateScanPage({
  gateName = 'Gate Device',
  gateLocation = 'Main Gate',
  initialPayload = null,
  initialEventId = null,
}: Props) {
  const restoredSessionId = normalizeEventRef(initialEventId || '') || loadActiveSessionEventId()
  const [eventRef, setEventRef] = useState(() => restoredSessionId || loadLastEventId())
  const [sessionEventId, setSessionEventId] = useState<string | null>(restoredSessionId || null)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<EventTicketTrackingMetrics | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [resumeMs, setResumeMs] = useState(RESUME_OK_MS)
  const [rapidMode, setRapidMode] = useState(true)

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
  const ignoreScansUntilRef = useRef(0)
  const submitScanRef = useRef<(payload: string) => Promise<void>>(async () => {})
  const startCameraRef = useRef<() => Promise<void>>(async () => {})
  const refreshMetricsRef = useRef<(eventId: string) => Promise<void>>(async () => {})

  useEffect(() => {
    sessionEventIdRef.current = sessionEventId
  }, [sessionEventId])

  // Drop deep-link ticket payloads — gate mode is continuous camera validation,
  // not one-shot validate of the QR that opened this page.
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('p') || url.searchParams.has('payload')) {
        url.searchParams.delete('p')
        url.searchParams.delete('payload')
        const next = `${url.pathname}${url.search}${url.hash}`
        window.history.replaceState({}, '', next)
      }
    } catch {
      // ignore
    }
  }, [])

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
          if (Date.now() < ignoreScansUntilRef.current) {
            // warm-up / post-verdict grace
          } else {
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

  const acquireCamera = useCallback(async (): Promise<boolean> => {
    if (!sessionEventIdRef.current) return false
    if (!canUseCamera()) {
      setCameraError(cameraBlockedMessage())
      setCameraActive(false)
      return false
    }

    if (streamRef.current) {
      const ok = await wakeVideo()
      if (ok) {
        setCameraActive(true)
        setCameraError(null)
        return true
      }
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    try {
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
        setCameraActive(false)
        return false
      }

      video.srcObject = stream
      await video.play()
      setCameraActive(true)
      setCameraError(null)
      return true
    } catch (err) {
      setCameraError(cameraStartErrorMessage(err))
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      setCameraActive(false)
      return false
    }
  }, [wakeVideo])

  const resumeScanning = useCallback(() => {
    pausedRef.current = false
    busyRef.current = false
    ignoreScansUntilRef.current = Date.now() + 450
    void (async () => {
      // Stay on this event session — reopen the camera if the track died.
      const ok = (await wakeVideo()) || (await acquireCamera())
      if (!ok) return
      setCameraActive(true)
      setCameraError(null)
      startScanLoop()
    })()
  }, [acquireCamera, startScanLoop, wakeVideo])

  const dismissVerdict = useCallback(() => {
    if (resumeTimerRef.current != null) {
      window.clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
    setVerdict(null)
    resumeScanning()
  }, [resumeScanning])

  const scheduleResumeScan = useCallback(
    (tone: Verdict['tone']) => {
      pauseScanning()
      const wait =
        tone === 'ok'
          ? rapidMode
            ? RESUME_OK_MS
            : 1400
          : rapidMode
            ? RESUME_BAD_MS
            : 2800
      setResumeMs(wait)
      if (resumeTimerRef.current != null) {
        window.clearTimeout(resumeTimerRef.current)
      }
      resumeTimerRef.current = window.setTimeout(() => {
        resumeTimerRef.current = null
        setVerdict(null)
        resumeScanning()
      }, wait)
    },
    [pauseScanning, rapidMode, resumeScanning],
  )

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
      const payloadPreview = raw.length > 80 ? `${raw.slice(0, 80)}…` : raw
      console.info('[gate] validate', { eventId, payloadPreview })
      try {
        const response = await publicTicketsApi.validate({
          payload: raw,
          eventId,
          scannedBy: gateName,
          scanLocation: gateLocation,
          deviceInfo: navigator.userAgent,
        })
        console.info('[gate] result', {
          valid: response.valid,
          result: response.result,
          message: response.message,
          ticketId: response.ticket?.id,
        })
        const tone: Verdict['tone'] = response.valid ? 'ok' : 'bad'
        setVerdict({
          tone,
          title: response.valid ? 'Allowed' : 'Rejected',
          reason: response.message,
          ticket: response.ticket,
        })
        playGateTone(response.valid)
        if (response.valid) {
          void refreshMetrics(eventId)
        }
        scheduleResumeScan(tone)
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message || 'Scan failed'
            : err instanceof Error
              ? err.message
              : 'Scan failed'
        console.error('[gate] validate error', { eventId, payloadPreview, message, err })
        setVerdict({ tone: 'bad', title: 'Rejected', reason: message, ticket: null })
        playGateTone(false)
        scheduleResumeScan('bad')
      }
    },
    [gateLocation, gateName, pauseScanning, refreshMetrics, scheduleResumeScan],
  )

  const startCamera = useCallback(async () => {
    if (!sessionEventIdRef.current) return
    setVerdict(null)
    setCameraError(null)
    pausedRef.current = false
    busyRef.current = false
    ignoreScansUntilRef.current = Date.now() + CAMERA_WARMUP_MS
    const ok = await acquireCamera()
    if (ok) startScanLoop()
  }, [acquireCamera, startScanLoop])

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
      const resolvedId = data.ticketId || id
      setMetrics(data)
      setError(null)
      setVerdict(null)
      setCameraError(null)
      lastCodeRef.current = null
      busyRef.current = false
      pauseScanning()
      saveLastEventId(resolvedId)
      saveActiveSessionEventId(resolvedId)
      setSessionEventId(resolvedId)
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
    clearActiveSessionEventId()
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
  const rememberedEventId = loadLastEventId()
  const fromScannedTicketQr = Boolean(initialPayload && extractTicketPayload(initialPayload))
  const secureUrl = secureGateUrl()
  const needsHttps = typeof window !== 'undefined' && window.location.protocol !== 'https:'

  if (!sessionEventId) {
    return (
      <div className="gate-shell">
        <div className="gate-setup">
          <div className="gate-setup-card">
            <div className="gate-badge">
              <KodeMark size={30} />
            </div>
            <p className="gate-eyebrow">Gate collection</p>
            <h1 className="gate-heading">Start a gate session</h1>
            <p className="gate-sub">
              Enter the event ID once. Camera stays open on that event — keep scanning guest tickets
              without coming back here.
            </p>
            {needsHttps ? (
              <p className="gate-alert" role="alert">
                Camera needs HTTPS on this device. Open secure gate scanner first.
              </p>
            ) : null}
            {fromScannedTicketQr ? (
              <p className="gate-hint">
                Ticket QR detected. Enter the event ID (`ERI-...`) for this gate, then scan attendee tickets.
              </p>
            ) : null}

            <form onSubmit={(e) => void beginSession(e)} className="gate-form" noValidate>
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
              {needsHttps ? (
                <a
                  className="gate-btn gate-btn-ghost"
                  href={secureUrl}
                >
                  Open secure scanner (HTTPS)
                </a>
              ) : null}
              {rememberedEventId && rememberedEventId === normalizeEventRef(eventRef) ? (
                <p className="gate-hint">Last used on this device — ready to reopen.</p>
              ) : null}
              {error ? <p className="gate-alert" role="alert">{error}</p> : null}
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="gate-shell"
      style={{ ['--gate-resume' as string]: `${resumeMs}ms` }}
    >
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
        <button
          type="button"
          className={`gate-mode-btn${rapidMode ? ' is-on' : ''}`}
          onClick={() => setRapidMode((v) => !v)}
          aria-pressed={rapidMode}
          title={rapidMode ? 'Rapid mode on' : 'Rapid mode off'}
        >
          {rapidMode ? 'Rapid' : 'Slow'}
        </button>
        <button type="button" className="gate-icon-btn" onClick={endSession} aria-label="End gate session">
          <CloseIcon />
        </button>
      </header>

      <main className={`gate-stage${verdict ? ` is-flash is-${verdict.tone}` : ''}`}>
        {/* Keep the video in the DOM for the whole session so the stream never detaches. */}
        <video
          ref={videoRef}
          className="gate-video"
          muted
          playsInline
          style={{ opacity: cameraActive ? 1 : 0 }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden />

        {cameraActive ? (
          <>
            <div className="gate-reticle" aria-hidden>
              <span className="gate-corner tl" />
              <span className="gate-corner tr" />
              <span className="gate-corner bl" />
              <span className="gate-corner br" />
              <span className="gate-laser" />
            </div>
            {!verdict ? (
              <div className="gate-prompt">
                <span className="gate-dot" />
                Hold the ticket QR in the frame
              </div>
            ) : null}
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
            {needsHttps ? (
              <a className="gate-btn gate-btn-ghost" href={secureUrl}>
                Open secure scanner (HTTPS)
              </a>
            ) : null}
          </div>
        ) : null}

        {verdict ? (
          <div
            className={`gate-flash ${verdict.tone === 'ok' ? 'is-ok' : 'is-bad'}`}
            role="status"
            aria-live="assertive"
          >
            <div className="gate-flash-main">
              <div className="gate-flash-icon" aria-hidden>
                {verdict.tone === 'ok' ? <CheckIcon /> : <CrossIcon />}
              </div>
              <div className="gate-flash-copy">
                <p className="gate-flash-title">{verdict.title}</p>
                {ticket ? (
                  <p className="gate-flash-guest">
                    {ticket.holderName || 'Guest'}
                    {ticket.ticketType ? ` · ${ticket.ticketType}` : ''}
                  </p>
                ) : (
                  <p className="gate-flash-guest">{verdict.reason}</p>
                )}
                {ticket && verdict.tone === 'bad' ? (
                  <p className="gate-flash-reason">{verdict.reason}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="gate-flash-next"
                onClick={dismissVerdict}
              >
                Next
              </button>
            </div>
            <div className="gate-resume-track" aria-hidden>
              <span className="gate-resume-fill" />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
