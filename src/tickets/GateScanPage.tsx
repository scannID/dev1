import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { publicTicketsApi } from '../api/services'
import type { TicketScanValidationResponse } from '../api/types'

type Props = {
  gateName?: string
  gateLocation?: string
  initialPayload?: string | null
}

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

export default function GateScanPage({
  gateName = 'Gate Device',
  gateLocation = 'Main Gate',
  initialPayload = null,
}: Props) {
  const [payload, setPayload] = useState(() => extractTicketPayload(initialPayload || ''))
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TicketScanValidationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraSupported, setCameraSupported] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanTimerRef = useRef<number | null>(null)
  const barcodeDetectorRef = useRef<BarcodeDetector | null>(null)
  const busyRef = useRef(false)
  const autoStartedRef = useRef(false)

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window
    setCameraSupported(supported)
    if (supported) {
      barcodeDetectorRef.current = new BarcodeDetector({ formats: ['qr_code'] })
    }
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submitScan(scannedPayload: string) {
    const raw = extractTicketPayload(scannedPayload)
    if (!raw) return

    setPayload(raw)
    setLoading(true)
    setError(null)
    try {
      const response = await publicTicketsApi.validate({
        payload: raw,
        scannedBy: gateName,
        scanLocation: gateLocation,
        deviceInfo: navigator.userAgent,
      })
      setResult(response)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Scan failed')
      } else {
        setError(err instanceof Error ? err.message : 'Scan failed')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autoStartedRef.current) return
    const seed = extractTicketPayload(initialPayload || '')
    if (!seed) return
    autoStartedRef.current = true
    void submitScan(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPayload])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    await submitScan(payload)
  }

  function stopCamera() {
    if (scanTimerRef.current != null) {
      window.clearInterval(scanTimerRef.current)
      scanTimerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  async function startCamera() {
    setCameraError(null)
    setResult(null)
    try {
      if (!cameraSupported || !barcodeDetectorRef.current) {
        setCameraError('This browser does not support in-app QR detection.')
        return
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

      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || !barcodeDetectorRef.current || busyRef.current) return
        try {
          busyRef.current = true
          const barcodes = await barcodeDetectorRef.current.detect(videoRef.current)
          const code = barcodes.find((b) => !!b.rawValue)?.rawValue?.trim()
          if (code) {
            stopCamera()
            await submitScan(code)
          }
        } catch {
          // keep polling silently
        } finally {
          busyRef.current = false
        }
      }, 500)
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Could not start camera')
      stopCamera()
    }
  }

  const statusTone = useMemo(() => {
    if (!result) return ''
    return result.valid ? '#065f46' : '#991b1b'
  }, [result])

  return (
    <div className="scanny-page">
      <div className="scanny-page-narrow">
        <div className="scanny-card">
          <p className="scanny-eyebrow">Gate validation</p>
          <h1 className="scanny-title">Scan Event Ticket</h1>
          <p className="scanny-sub">
            Scan a paid ticket QR (opens this page) or paste the payload. First valid scan knocks off the ticket.
          </p>

          <div className="scanny-actions" style={{ marginTop: 14 }}>
            {cameraActive ? (
              <button type="button" className="scanny-btn scanny-btn-secondary" onClick={stopCamera}>
                Stop camera
              </button>
            ) : (
              <button
                type="button"
                className="scanny-btn scanny-btn-primary"
                onClick={() => void startCamera()}
                disabled={!cameraSupported}
              >
                Start camera scan
              </button>
            )}
          </div>

          <div className="scanny-panel" style={{ marginTop: 14 }}>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{
                width: '100%',
                borderRadius: 12,
                background: '#111827',
                minHeight: 180,
                display: cameraActive ? 'block' : 'none',
              }}
            />
            {!cameraActive ? (
              <p className="scanny-hint" style={{ margin: 0 }}>
                {cameraSupported
                  ? 'Camera is off. Tap "Start camera scan".'
                  : 'Camera scan not supported in this browser. Open a ticket QR link or paste payload.'}
              </p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="scanny-form" style={{ marginTop: 14 }}>
            <label className="scanny-field">
              <span className="scanny-label">Ticket QR payload</span>
              <textarea
                className="scanny-input"
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={3}
                placeholder="SCANNY:TICKET:... or gate URL"
              />
            </label>
            <button type="submit" disabled={loading || !payload.trim()} className="scanny-btn scanny-btn-primary">
              {loading ? 'Validating…' : 'Validate ticket'}
            </button>
          </form>

          {cameraError ? <p className="scanny-error" role="alert">{cameraError}</p> : null}
          {error ? <p className="scanny-error" role="alert">{error}</p> : null}

          {result ? (
            <div className="scanny-panel" style={{ marginTop: 16, borderLeft: `4px solid ${statusTone}` }}>
              <p className="scanny-stat-label">Result</p>
              <p className="scanny-stat-value" style={{ color: statusTone }}>
                {result.valid ? 'VALID - ENTRY ALLOWED' : 'REJECTED'}
              </p>
              <p className="scanny-hint" style={{ marginTop: 8 }}>
                {result.message}
              </p>
              <p className="scanny-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                Ticket: {result.ticket.id} · Status: {result.ticket.status} · Usage: {result.ticket.usageCount}/
                {result.ticket.usageLimit}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
