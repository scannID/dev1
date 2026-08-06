import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { ApiError } from '../api/client'
import { publicTicketsApi } from '../api/services'
import type { EventTicketTrackingMetrics, GateRedeemedAttendee, Ticket } from '../api/types'
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

type ScanNotice = {
  tone: 'ok' | 'bad'
  text: string
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

function shortCodeFromTicketId(ticketId: string): string {
  const cleaned = (ticketId || '').replace(/[^a-z0-9]/gi, '').toUpperCase()
  if (!cleaned) return ''
  return cleaned.length <= 4 ? cleaned : cleaned.slice(-4)
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
    return `Camera is blocked on ${protocol}//${host}. Open ${target} instead and accept the browser certificate warning once.`
  }
  return 'This browser refused camera access. Allow the camera permission for this site.'
}

function cameraStartErrorMessage(err: unknown) {
  if (!(err instanceof Error)) return 'Could not start camera'
  const name = err.name || ''
  const message = err.message || ''
  if (/NotAllowedError|SecurityError/i.test(name) || /NotAllowed|Permission/i.test(message)) {
    return cameraBlockedMessage()
  }
  if (/NotFoundError|OverconstrainedError|NotReadableError/i.test(name)) {
    return 'No usable camera was found. Close other apps using camera.'
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

function extractMasterQrToken(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const fromPath = (pathname: string) => {
    const match = pathname.match(/^\/ticket\/([^/?#]+)\/?$/)
    if (!match) return ''
    const token = decodeURIComponent(match[1] || '')
    if (!token || token === 'gate' || token === 'view') return ''
    return token
  }
  try {
    const url = new URL(trimmed)
    const fromUrlPath = fromPath(url.pathname)
    if (fromUrlPath) return fromUrlPath
  } catch {
    // not a URL
  }
  const pathMatch = trimmed.match(/\/ticket\/([^/?#\s]+)/i)
  if (!pathMatch) return ''
  const token = decodeURIComponent(pathMatch[1] || '')
  if (!token || token === 'gate' || token === 'view') return ''
  return token
}

function extractEventIdFromGateLink(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    if (!/^\/ticket\/gate\/?$/i.test(url.pathname)) return ''
    const value = url.searchParams.get('eventId') || url.searchParams.get('event') || ''
    return normalizeEventRef(value)
  } catch {
    return ''
  }
}

/** Soft beep so staff can keep eyes on the queue. */
function playGateTone(ok: boolean) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const makeTone = (freq: number, start: number, duration: number, type: OscillatorType, volume: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(volume, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + duration)
    }
    if (ok) {
      // Two short, rising pings for a clear "allowed" signal.
      makeTone(900, now, 0.11, 'sine', 0.09)
      makeTone(1300, now + 0.12, 0.12, 'sine', 0.09)
      window.setTimeout(() => void ctx.close(), 500)
    } else {
      // Lower descending buzz for "rejected".
      makeTone(320, now, 0.16, 'square', 0.08)
      makeTone(220, now + 0.15, 0.2, 'square', 0.08)
      window.setTimeout(() => void ctx.close(), 650)
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ok ? [40, 40, 40] : [120, 60, 120])
      } catch {
        // ignore
      }
    }
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
  const initialEventRef = normalizeEventRef(initialEventId || '')
  const restoredSessionId = initialEventRef ? null : loadActiveSessionEventId()
  const [sessionEventId, setSessionEventId] = useState<string | null>(restoredSessionId || null)
  const [eventIdInput, setEventIdInput] = useState<string>(initialEventRef || '')
  const [eventLoginBusy, setEventLoginBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<EventTicketTrackingMetrics | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [, setCameraError] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [resumeMs, setResumeMs] = useState(RESUME_OK_MS)
  const [lastNotice, setLastNotice] = useState<ScanNotice | null>(null)
  const [redeemedOpen, setRedeemedOpen] = useState(false)
  const [redeemedLoading, setRedeemedLoading] = useState(false)
  const [redeemedQuery, setRedeemedQuery] = useState('')
  const [redeemedError, setRedeemedError] = useState<string | null>(null)
  const [redeemedRows, setRedeemedRows] = useState<GateRedeemedAttendee[]>([])

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const scannerInputRef = useRef<HTMLInputElement | null>(null)
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
  const pendingPayloadRef = useRef(extractTicketPayload(initialPayload || ''))
  const submitScanRef = useRef<(payload: string) => Promise<void>>(async () => {})
  const refreshMetricsRef = useRef<(eventId: string) => Promise<void>>(async () => {})

  const focusScannerInput = useCallback(() => {
    const input = scannerInputRef.current
    if (!input) return
    if (document.activeElement !== input) input.focus()
  }, [])

  useEffect(() => {
    sessionEventIdRef.current = sessionEventId
  }, [sessionEventId])

  useEffect(() => {
    if (!initialEventRef) return
    setEventIdInput(initialEventRef)
    setError(null)
  }, [initialEventRef])

  // Drop deep-link ticket payloads — gate mode is continuous camera validation,
  // and now manual code entry handles payloads after event selection.
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

  const loadRedeemed = useCallback(async (eventId: string, query: string) => {
    setRedeemedLoading(true)
    setRedeemedError(null)
    try {
      const rows = await publicTicketsApi.redeemed(eventId, query)
      setRedeemedRows(rows)
    } catch (err) {
      try {
        const metricsData = await publicTicketsApi.track(eventId)
        const codeQuery = (query || '').trim().toUpperCase()
        const rows: GateRedeemedAttendee[] = metricsData.recentAttendees
          .filter((item) => item.status?.toLowerCase() === 'redeemed')
          .map((item) => ({
            ticketId: item.ticketId,
            ticketCode: shortCodeFromTicketId(item.ticketId),
            holderName: item.holderName || '',
            holderPhone: item.holderPhone || '',
            ticketType: item.ticketType || '',
            paymentStatus: item.paymentStatus || '',
            status: item.status || '',
            redeemedAt: item.createdAt || null,
          }))
          .filter((item) => !codeQuery || item.ticketCode === codeQuery)
        setRedeemedRows(rows)
        setRedeemedError(null)
      } catch (fallbackErr) {
        const message =
          fallbackErr instanceof ApiError
            ? fallbackErr.message || 'Could not load redeemed tickets'
            : fallbackErr instanceof Error
              ? fallbackErr.message
              : err instanceof ApiError
                ? err.message || 'Could not load redeemed tickets'
                : err instanceof Error
                  ? err.message
                  : 'Could not load redeemed tickets'
        setRedeemedError(message)
      }
    } finally {
      setRedeemedLoading(false)
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
      if (loopId !== scanLoopIdRef.current) return

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

      if (loopId === scanLoopIdRef.current) {
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
        setCameraError('Scanner view is not ready yet.')
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
    focusScannerInput()
  }, [focusScannerInput])

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
      const wait = tone === 'ok' ? RESUME_OK_MS : RESUME_BAD_MS
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
    [pauseScanning, resumeScanning],
  )

  const activateEventSession = useCallback(async (rawEventId: string) => {
    const nextEventId = normalizeEventRef(rawEventId)
    if (!nextEventId) {
      setError('Scan an event QR first.')
      return false
    }
    try {
      const data = await publicTicketsApi.track(nextEventId)
      setSessionEventId(nextEventId)
      saveLastEventId(nextEventId)
      saveActiveSessionEventId(nextEventId)
      setMetrics(data)
      setError(null)
      ignoreScansUntilRef.current = Date.now() + 450
      return true
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message || 'Event ID not found'
          : err instanceof Error
            ? err.message
            : 'Event ID not found'
      setError(message)
      return false
    }
  }, [])

  const submitScan = useCallback(
    async (scannedPayload: string) => {
      const raw = extractTicketPayload(scannedPayload)
      if (!raw) {
        busyRef.current = false
        return
      }
      const eventId = sessionEventIdRef.current
      if (!eventId) {
        const candidate = normalizeEventRef(raw)
        if (/^ERI-[A-Z0-9-]+$/i.test(candidate)) {
          await activateEventSession(candidate)
          busyRef.current = false
          return
        }
        const fromManagerLink = extractEventIdFromGateLink(raw)
        if (fromManagerLink) {
          await activateEventSession(fromManagerLink)
          busyRef.current = false
          return
        }
        const masterQrToken = extractMasterQrToken(raw)
        if (masterQrToken) {
          try {
            const event = await publicTicketsApi.getEvent(masterQrToken)
            const masterId = normalizeEventRef(event.masterTicketId || '')
            if (!masterId) {
              setError('Could not resolve event ID from this event QR.')
              busyRef.current = false
              return
            }
            await activateEventSession(masterId)
          } catch (err) {
            const message =
              err instanceof ApiError
                ? err.message || 'Could not load event from QR'
                : err instanceof Error
                  ? err.message
                  : 'Could not load event from QR'
            setError(message)
          }
          busyRef.current = false
          return
        }
        setError('Scan the event QR code first to load the Event ID.')
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
        if (response.valid) {
          const guest = response.ticket?.holderName?.trim() || 'Guest'
          const ticketCode = response.ticket?.id || ''
          setLastNotice({
            tone: 'ok',
            text: `Redeemed: ${guest}${ticketCode ? ` (${ticketCode})` : ''}`,
          })
        } else {
          setLastNotice({
            tone: 'bad',
            text: `Rejected: ${response.message}`,
          })
        }
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
        setLastNotice({
          tone: 'bad',
          text: `Rejected: ${message}`,
        })
        playGateTone(false)
        scheduleResumeScan('bad')
      }
    },
    [activateEventSession, gateLocation, gateName, pauseScanning, refreshMetrics, scheduleResumeScan],
  )

  const startCamera = useCallback(async () => {
    setVerdict(null)
    setCameraError(null)
    pausedRef.current = false
    busyRef.current = false
    ignoreScansUntilRef.current = Date.now() + CAMERA_WARMUP_MS
    const ok = await acquireCamera()
    if (ok) startScanLoop()
  }, [acquireCamera, startScanLoop])

  const loginEventSession = useCallback(async () => {
    const candidate = normalizeEventRef(eventIdInput)
    if (!candidate) {
      setError('Enter an Event ID first.')
      return
    }
    setEventLoginBusy(true)
    try {
      const ok = await activateEventSession(candidate)
      if (ok) {
        setEventIdInput(candidate)
      }
    } finally {
      setEventLoginBusy(false)
    }
  }, [activateEventSession, eventIdInput])

  // Keep the latest callbacks reachable from the session effect / scan loop
  // without putting them in dependency lists that would restart the camera.
  useEffect(() => {
    submitScanRef.current = submitScan
    refreshMetricsRef.current = refreshMetrics
  }, [submitScan, refreshMetrics])

  useEffect(() => {
    void startCamera()
  }, [startCamera])

  // Scanner machine mode: keep focus on the HID scanner input.
  useEffect(() => {
    const onWindowFocus = () => focusScannerInput()
    const onWindowClick = () => focusScannerInput()
    const id = window.setInterval(() => {
      focusScannerInput()
    }, 1200)
    window.addEventListener('focus', onWindowFocus)
    window.addEventListener('click', onWindowClick)
    focusScannerInput()
    const queued = pendingPayloadRef.current
    if (queued) {
      pendingPayloadRef.current = ''
      void submitScanRef.current(queued)
    }
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onWindowFocus)
      window.removeEventListener('click', onWindowClick)
    }
  }, [focusScannerInput])

  // Refresh event metrics only while a session is locked.
  useEffect(() => {
    if (!sessionEventId) return
    void refreshMetricsRef.current(sessionEventId)
    metricsTimerRef.current = window.setInterval(() => {
      void refreshMetricsRef.current(sessionEventId)
    }, METRICS_POLL_MS)
    return () => {
      if (metricsTimerRef.current != null) {
        window.clearInterval(metricsTimerRef.current)
        metricsTimerRef.current = null
      }
    }
  }, [sessionEventId])

  useEffect(() => {
    if (redeemedOpen) return
    const id = window.setTimeout(() => {
      focusScannerInput()
    }, 120)
    return () => window.clearTimeout(id)
  }, [focusScannerInput, redeemedOpen, sessionEventId, verdict])

  useEffect(() => {
    if (!redeemedOpen) return
    if (!sessionEventId) return
    const cleaned = redeemedQuery.trim().replace(/[^a-z0-9]/gi, '').toUpperCase()
    if (cleaned && cleaned.length !== 4) {
      setRedeemedRows([])
      setRedeemedError(null)
      setRedeemedLoading(false)
      return
    }
    const id = window.setTimeout(() => {
      void loadRedeemed(sessionEventId, cleaned)
    }, 220)
    return () => window.clearTimeout(id)
  }, [loadRedeemed, redeemedOpen, redeemedQuery, sessionEventId])

  // Tear down camera only when leaving the page.
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const ticket = verdict?.ticket
  const eventLabel = metrics?.eventName || (sessionEventId || 'Scan event QR first')
  const eventIdLabel = sessionEventId || 'NOT LOGGED IN'
  const eventImageUrl = metrics?.eventImageUrl?.trim() || ''

  return (
    <div
      className="gate-shell"
      style={{ ['--gate-resume' as string]: `${resumeMs}ms` }}
    >
      {sessionEventId ? (
        <header className="gate-topbar">
          <div className="gate-brand">
            <div className="gate-brand-logo" aria-hidden>
              <KodeMark size={22} />
            </div>
            <div className="gate-brand-text">
              <span className="gate-brand-name">Kode</span>
            </div>
          </div>
        </header>
      ) : (
        <div className="gate-floating-brand" aria-hidden>
          <span className="gate-floating-logo">
            <KodeMark size={30} />
          </span>
          <span className="gate-floating-name">Kode</span>
        </div>
      )}

      {sessionEventId ? (
        <>
          <div className="gate-counts">
            <div className="gate-count">
              <p className="gate-count-value">{metrics?.purchasedTickets ?? 0}</p>
              <p className="gate-count-label">Bought</p>
            </div>
            <div className="gate-count is-allowed">
              <p className="gate-count-value">{metrics?.redeemedTickets ?? 0}</p>
              <p className="gate-count-label">Redeemed</p>
            </div>
          </div>
          <div className="gate-metrics-actions">
            <button
              type="button"
              className="gate-btn gate-btn-ghost gate-redeemed-btn"
              onClick={() => {
                setRedeemedOpen(true)
                setRedeemedQuery('')
              }}
            >
              Redeemed list ({metrics?.redeemedTickets ?? 0})
            </button>
          </div>

          <section className="gate-event-hero" aria-label="Active event">
            {eventImageUrl ? (
              <img className="gate-event-hero-image" src={eventImageUrl} alt="" />
            ) : (
              <div className="gate-event-hero-fallback" aria-hidden>
                <KodeMark size={28} />
              </div>
            )}
            <div className="gate-event-hero-overlay">
              <p className="gate-event-hero-name">{eventLabel}</p>
              <p className="gate-event-hero-id">{eventIdLabel}</p>
            </div>
          </section>
        </>
      ) : null}

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
                {sessionEventId
                  ? 'Scanner ready: scan attendee ticket barcode/QR now.'
                  : 'Scanner ready: scan manager event QR to start validation.'}
              </div>
            ) : null}
          </>
        ) : null}
        {!cameraActive && !verdict ? (
          <div className="gate-prompt">
            <span className="gate-dot" />
            {sessionEventId
              ? 'Scanner ready: scan attendee ticket barcode/QR now.'
              : 'Scanner ready: scan manager event QR to start validation.'}
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

      <section className={`gate-manual-entry${!sessionEventId ? ' gate-manual-entry-centered' : ''}`}>
        {sessionEventId ? (
          <>
            <label className="gate-manual-label" htmlFor="gate-ticket-id">
              Ticket ID
            </label>
            <input
              id="gate-ticket-id"
              ref={scannerInputRef}
              className="gate-manual-input"
              placeholder="Ticket ID"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={4}
              onChange={(e) => {
                const cleaned = e.currentTarget.value.replace(/[^a-z0-9]/gi, '').toUpperCase()
                e.currentTarget.value = cleaned
                if (cleaned.length === 4) {
                  setError(null)
                  void submitScan(cleaned)
                  e.currentTarget.value = ''
                }
              }}
              onBlur={() => {
                window.setTimeout(() => focusScannerInput(), 30)
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const value = e.currentTarget.value.trim().replace(/[^a-z0-9]/gi, '').toUpperCase()
                e.currentTarget.value = ''
                if (!value || value.length !== 4) return
                setError(null)
                void submitScan(value)
              }}
            />
          </>
        ) : (
          <>
            <label className="gate-manual-label" htmlFor="gate-event-id">
              Event ID
            </label>
            <p className="gate-hint">Enter Event ID, then login to validate.</p>
            <div className="gate-manual-row">
              <input
                id="gate-event-id"
                className="gate-manual-input"
                value={eventIdInput}
                onChange={(e) => setEventIdInput(e.target.value.toUpperCase())}
                placeholder="ERI-XXXXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  void loginEventSession()
                }}
              />
              <button
                type="button"
                className="gate-btn gate-btn-primary gate-manual-btn"
                onClick={() => void loginEventSession()}
                disabled={eventLoginBusy}
              >
                {eventLoginBusy ? 'Logging in…' : 'Login to validate'}
              </button>
            </div>
          </>
        )}
        {lastNotice ? (
          <p className={lastNotice.tone === 'ok' ? 'gate-alert gate-alert-ok' : 'gate-alert'} role="status" aria-live="polite">
            {lastNotice.text}
          </p>
        ) : null}
        {error ? <p className="gate-alert" role="alert">{error}</p> : null}
      </section>

      {redeemedOpen ? (
        <div className="gate-redeemed-overlay" role="dialog" aria-modal="true" aria-label="Redeemed tickets list">
          <div className="gate-redeemed-card">
            <div className="gate-redeemed-head">
              <p className="gate-redeemed-title">Redeemed tickets</p>
              <button
                type="button"
                className="gate-icon-btn"
                onClick={() => setRedeemedOpen(false)}
                aria-label="Close redeemed list"
              >
                ×
              </button>
            </div>
            <input
              className="gate-manual-input"
              value={redeemedQuery}
              onChange={(e) => setRedeemedQuery(e.target.value.toUpperCase())}
              placeholder="Search by 4-char ticket ID"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={4}
            />
            {redeemedQuery.trim() && redeemedQuery.trim().replace(/[^a-z0-9]/gi, '').length !== 4 ? (
              <p className="gate-hint">Enter exactly 4 characters.</p>
            ) : null}
            {redeemedLoading ? <p className="gate-hint">Loading redeemed list…</p> : null}
            {redeemedError ? <p className="gate-alert">{redeemedError}</p> : null}
            {!redeemedLoading && !redeemedError ? (
              <div className="gate-redeemed-list">
                {redeemedRows.length === 0 ? (
                  <p className="gate-hint">No redeemed tickets found.</p>
                ) : (
                  redeemedRows.map((row) => (
                    <div key={row.ticketId} className="gate-redeemed-row">
                      <p className="gate-redeemed-name">{row.holderName || 'Guest'}</p>
                      <p className="gate-redeemed-meta">
                        {row.ticketCode ? `${row.ticketCode} · ` : ''}
                        {row.ticketType || 'Ticket'}
                        {row.holderPhone ? ` · ${row.holderPhone}` : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
