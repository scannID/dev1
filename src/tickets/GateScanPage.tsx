import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { publicTicketsApi } from '../api/services'
import type { TicketScanValidationResponse } from '../api/types'

type Props = {
  gateName?: string
  gateLocation?: string
  initialPayload?: string | null
  initialEventId?: string | null
}

const RESUME_MS = 1600
const SAME_CODE_COOLDOWN_MS = 4000

/** Pull SCANNY:TICKET:... out of a raw scan or gate URL. */
export function extractTicketPayload(raw: string): string {
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

export default function GateScanPage({
  gateName = 'Gate Device',
  gateLocation = 'Main Gate',
  initialPayload = null,
  initialEventId = null,
}: Props) {
  const [eventRef, setEventRef] = useState(() => normalizeEventRef(initialEventId || ''))
  const [sessionEventId, setSessionEventId] = useState<string | null>(null)
  const [payload, setPayload] = useState(() => extractTicketPayload(initialPayload || ''))
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TicketScanValidationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanCount, setScanCount] = useState(0)
  const [validCount, setValidCount] = useState(0)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraSupported, setCameraSupported] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ tone: 'ok' | 'bad'; title: string; detail: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanTimerRef = useRef<number | null>(null)
  const resumeTimerRef = useRef<number | null>(null)
  const barcodeDetectorRef = useRef<BarcodeDetector | null>(null)
  const busyRef = useRef(false)
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null)
  const sessionEventIdRef = useRef<string | null>(null)
  const cameraActiveRef = useRef(false)
  const pausedRef = useRef(false)

  useEffect(() => {
    sessionEventIdRef.current = sessionEventId
  }, [sessionEventId])

  useEffect(() => {
    cameraActiveRef.current = cameraActive
  }, [cameraActive])

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window
    setCameraSupported(supported)
    if (supported) {
      barcodeDetectorRef.current = new BarcodeDetector({ formats: ['qr_code'] })
    }
    return () => {
      stopCamera()
      if (resumeTimerRef.current != null) {
        window.clearTimeout(resumeTimerRef.current)
        resumeTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function beginSession(event: React.FormEvent) {
    event.preventDefault()
    const id = normalizeEventRef(eventRef)
    if (!id) {
      setError('Enter the event ID from when the event was created')
      return
    }
    setError(null)
    setResult(null)
    setFlash(null)
    pausedRef.current = false
    setSessionEventId(id)
    setScanCount(0)
    setValidCount(0)
  }

  function endSession() {
    stopCamera()
    setSessionEventId(null)
    setResult(null)
    setFlash(null)
    setError(null)
    pausedRef.current = false
    setScanCount(0)
    setValidCount(0)
  }

  async function submitScan(scannedPayload: string, opts?: { keepCamera?: boolean }) {
    const raw = extractTicketPayload(scannedPayload)
    if (!raw) return
    const eventId = sessionEventIdRef.current
    if (!eventId) {
      setError('Enter the event ID before scanning tickets')
      return
    }

    setPayload(raw)
    setLoading(true)
    setError(null)
    try {
      const response = await publicTicketsApi.validate({
        payload: raw,
        eventId,
        scannedBy: gateName,
        scanLocation: gateLocation,
        deviceInfo: navigator.userAgent,
      })
      setResult(response)
      setScanCount((n) => n + 1)
      if (response.valid) setValidCount((n) => n + 1)
      setFlash({
        tone: response.valid ? 'ok' : 'bad',
        title: response.valid ? 'VALID — ENTRY ALLOWED' : 'REJECTED',
        detail: response.message,
      })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message || 'Scan failed'
          : err instanceof Error
            ? err.message
            : 'Scan failed'
      setError(message)
      setResult(null)
      setFlash({
        tone: 'bad',
        title: 'REJECTED',
        detail: message,
      })
      setScanCount((n) => n + 1)
    } finally {
      setLoading(false)
      if (opts?.keepCamera && cameraActiveRef.current) {
        scheduleResumeScan()
      } else {
        pausedRef.current = false
        busyRef.current = false
      }
    }
  }

  function scheduleResumeScan() {
    pausedRef.current = true
    if (resumeTimerRef.current != null) {
      window.clearTimeout(resumeTimerRef.current)
    }
    resumeTimerRef.current = window.setTimeout(() => {
      resumeTimerRef.current = null
      setFlash(null)
      setError(null)
      pausedRef.current = false
      busyRef.current = false
    }, RESUME_MS)
  }

  async function handleManualSubmit(event: React.FormEvent) {
    event.preventDefault()
    busyRef.current = true
    await submitScan(payload, { keepCamera: cameraActiveRef.current })
  }

  function stopCamera() {
    if (scanTimerRef.current != null) {
      window.clearInterval(scanTimerRef.current)
      scanTimerRef.current = null
    }
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
    setFlash(null)
    setCameraActive(false)
  }

  async function startCamera() {
    if (!sessionEventIdRef.current) {
      setError('Enter the event ID before opening the camera')
      return
    }
    setCameraError(null)
    setFlash(null)
    setResult(null)
    try {
      if (!cameraSupported || !barcodeDetectorRef.current) {
        setCameraError('This browser does not support in-app QR detection.')
        return
      }
      if (streamRef.current) {
        stopCamera()
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }
      setCameraActive(true)
      busyRef.current = false
      pausedRef.current = false

      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || !barcodeDetectorRef.current) return
        if (busyRef.current || pausedRef.current) return
        try {
          const barcodes = await barcodeDetectorRef.current.detect(videoRef.current)
          const code = barcodes.find((b) => !!b.rawValue)?.rawValue?.trim()
          if (!code) return

          const last = lastCodeRef.current
          const now = Date.now()
          if (last && last.code === code && now - last.at < SAME_CODE_COOLDOWN_MS) {
            return
          }

          busyRef.current = true
          lastCodeRef.current = { code, at: now }
          // Keep camera live — flash result, then auto-resume without tapping Scan.
          await submitScan(code, { keepCamera: true })
        } catch {
          busyRef.current = false
        }
      }, 450)
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Could not start camera')
      stopCamera()
    }
  }

  const statusTone = useMemo(() => {
    if (!result) return ''
    return result.valid ? '#065f46' : '#991b1b'
  }, [result])

  const inSession = Boolean(sessionEventId)

  return (
    <div className="scanny-page">
      <div className="scanny-page-narrow">
        <div className="scanny-card">
          <p className="scanny-eyebrow">Gate validation</p>
          <h1 className="scanny-title">Scan Event Ticket</h1>
          <p className="scanny-sub">
            Enter the event ID from creation, open the camera, then keep scanning bought-ticket QRs.
            After each result the camera resumes automatically — no need to tap Scan again.
          </p>

          {!inSession ? (
            <form onSubmit={beginSession} className="scanny-form" style={{ marginTop: 14 }}>
              <label className="scanny-field">
                <span className="scanny-label">Event ID / ref</span>
                <input
                  className="scanny-input"
                  value={eventRef}
                  onChange={(e) => setEventRef(e.target.value)}
                  placeholder="e.g. TKT-3D02AA56"
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <button type="submit" className="scanny-btn scanny-btn-primary" disabled={!eventRef.trim()}>
                Start gate session
              </button>
              {error ? <p className="scanny-error" role="alert">{error}</p> : null}
            </form>
          ) : (
            <>
              <div className="scanny-panel" style={{ marginTop: 14 }}>
                <p className="scanny-stat-label">Gate session</p>
                <p className="scanny-stat-value" style={{ fontFamily: 'monospace', fontSize: 18 }}>
                  {sessionEventId}
                </p>
                <p className="scanny-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                  Scanned {scanCount} · Allowed {validCount}
                  {cameraActive ? ' · Camera live' : ''}
                </p>
                <div className="scanny-actions" style={{ marginTop: 12 }}>
                  {cameraActive ? (
                    <button type="button" className="scanny-btn scanny-btn-secondary" onClick={stopCamera}>
                      Close camera
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="scanny-btn scanny-btn-primary"
                      onClick={() => void startCamera()}
                      disabled={!cameraSupported || loading}
                    >
                      Open camera
                    </button>
                  )}
                  <button type="button" className="scanny-btn scanny-btn-secondary" onClick={endSession}>
                    End session
                  </button>
                </div>
              </div>

              <div className="scanny-panel" style={{ marginTop: 14, position: 'relative' }}>
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    background: '#111827',
                    minHeight: 200,
                    display: cameraActive ? 'block' : 'none',
                    objectFit: 'cover',
                  }}
                />
                {flash ? (
                  <div
                    style={{
                      position: cameraActive ? 'absolute' : 'relative',
                      inset: cameraActive ? 12 : undefined,
                      borderRadius: 12,
                      padding: 16,
                      background: flash.tone === 'ok' ? 'rgba(6, 95, 70, 0.92)' : 'rgba(153, 27, 27, 0.92)',
                      color: '#fff',
                      display: 'grid',
                      placeContent: 'center',
                      textAlign: 'center',
                      gap: 6,
                      minHeight: cameraActive ? undefined : 120,
                      marginTop: cameraActive ? 0 : 0,
                    }}
                    role="status"
                  >
                    <strong style={{ fontSize: 18, letterSpacing: '0.02em' }}>{flash.title}</strong>
                    <span style={{ fontSize: 13, opacity: 0.95 }}>{flash.detail}</span>
                    {cameraActive ? (
                      <span style={{ fontSize: 11, opacity: 0.8, marginTop: 6 }}>Resuming scan…</span>
                    ) : null}
                  </div>
                ) : null}
                {!cameraActive && !flash ? (
                  <p className="scanny-hint" style={{ margin: 0 }}>
                    {cameraSupported
                      ? 'Camera is off. Open it once, then keep presenting tickets — results flash and scan resumes by itself.'
                      : 'Camera scan not supported in this browser. Paste a ticket payload below.'}
                  </p>
                ) : null}
              </div>

              <form onSubmit={handleManualSubmit} className="scanny-form" style={{ marginTop: 14 }}>
                <label className="scanny-field">
                  <span className="scanny-label">Or paste ticket QR payload</span>
                  <textarea
                    className="scanny-input"
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    rows={3}
                    placeholder="SCANNY:TICKET:... or gate URL"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading || !payload.trim()}
                  className="scanny-btn scanny-btn-primary"
                >
                  {loading ? 'Validating…' : 'Validate ticket'}
                </button>
              </form>

              {cameraError ? <p className="scanny-error" role="alert">{cameraError}</p> : null}
              {error && !flash ? <p className="scanny-error" role="alert">{error}</p> : null}

              {result && !cameraActive ? (
                <div className="scanny-panel" style={{ marginTop: 16, borderLeft: `4px solid ${statusTone}` }}>
                  <p className="scanny-stat-label">Last result</p>
                  <p className="scanny-stat-value" style={{ color: statusTone }}>
                    {result.valid ? 'VALID - ENTRY ALLOWED' : 'REJECTED'}
                  </p>
                  <p className="scanny-hint" style={{ marginTop: 8 }}>
                    {result.message}
                  </p>
                  <p className="scanny-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                    Ticket: {result.ticket.id} · Status: {result.ticket.status} · Usage:{' '}
                    {result.ticket.usageCount}/{result.ticket.usageLimit}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
