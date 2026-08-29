import { useState, useEffect, useRef } from 'react'
import {
  Scissors,
  Check,
  QrCode,
  ClipboardList,
  ShoppingBag,
  CreditCard,
} from 'lucide-react'
import { usePageMeta } from './hooks/usePageMeta'

/* ─────────────────────────────────────────────────────────────
   Concept: a kitchen order ticket, not a SaaS dashboard.
   Paper, modern Outfit typography, a rubber stamp, a spike of tickets.
   ───────────────────────────────────────────────────────────── */

const C = {
  paper: '#efe6d2',
  paperLt: '#f7f1e3',
  ink: '#26201a',
  inkSoft: '#6b5e4e',
  stamp: '#b23425',
  spike: '#8a7355',
  ok: '#3f5c3c',
}

const FONT = "'Outfit Variable', 'Outfit', ui-sans-serif, system-ui, sans-serif"

// Landing hero only — events page uses /hero-bg.jpg separately.
const heroPhoto = '/hero-restaurant.jpg'

/* ─────────────────────────────────────────────────────────────
   Zigzag ticket edge
   ───────────────────────────────────────────────────────────── */

function Zigzag({ color = C.paperLt, flip = false }) {
  const teeth = 26

  const pts = Array.from({ length: teeth }, (_, i) => {
    const x = (i / teeth) * 100
    const y = i % 2 === 0 ? 0 : 100
    return `${x},${y}`
  }).join(' ')

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        width: '100%',
        height: 10,
        display: 'block',
        transform: flip ? 'scaleY(-1)' : 'none',
      }}
    >
      <polygon points={`0,100 ${pts} 100,100`} fill={color} />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────
   Punch holes
   ───────────────────────────────────────────────────────────── */

function PunchHoles() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-evenly',
        padding: '0 6px',
      }}
    >
      {Array.from({ length: 14 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: C.paper,
          }}
        />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Signature: a live printing order ticket
   ───────────────────────────────────────────────────────────── */

const orderLines = [
  { qty: '2x', item: 'Rolex, extra onion' },
  { qty: '1x', item: 'Chicken luwombo' },
  { qty: '3x', item: 'Nile Special' },
  { qty: '1x', item: 'Passion juice' },
]

function OrderTicket({ onStamped }: { onStamped?: (v: boolean) => void }) {
  const [visible, setVisible] = useState(0)
  const [stamped, setStamped] = useState(false)

  useEffect(() => {
    let cancelled = false
    let printInterval: ReturnType<typeof setInterval> | undefined
    let stampTimeout: ReturnType<typeof setTimeout> | undefined
    let resetTimeout: ReturnType<typeof setTimeout> | undefined

    function runCycle() {
      setVisible(0)
      setStamped(false)
      onStamped?.(false)

      let i = 0

      printInterval = setInterval(() => {
        if (cancelled) return

        i += 1
        setVisible(i)

        if (i >= orderLines.length) {
          if (printInterval) clearInterval(printInterval)

          stampTimeout = setTimeout(() => {
            if (!cancelled) { setStamped(true); onStamped?.(true) }
          }, 500)

          resetTimeout = setTimeout(() => {
            if (!cancelled) runCycle()
          }, 7000)
        }
      }, 480)
    }

    runCycle()

    return () => {
      cancelled = true
      if (printInterval) clearInterval(printInterval)
      if (stampTimeout) clearTimeout(stampTimeout)
      if (resetTimeout) clearTimeout(resetTimeout)
    }
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: 300,
        transform: 'rotate(1.2deg)',
      }}
    >
      <div
        style={{
          boxShadow: '0 30px 60px rgba(38,32,26,0.25)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <Zigzag />

        <div
          style={{
            background: C.paperLt,
            padding: '22px 26px 30px',
            fontFamily: FONT,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: C.ink,
              }}
            >
              Koddly
            </div>

            <div
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: C.inkSoft,
                letterSpacing: '0.1em',
              }}
            >
              BREW HOUSE CAFÉ · ONE CODE, ALL ORDERS
            </div>
          </div>

          <div
            style={{
              borderTop: `1px dashed ${C.ink}55`,
              margin: '14px 0',
            }}
          />

          <div
            style={{
              minHeight: orderLines.length * 22,
            }}
          >
            {orderLines.map((l, i) => (
              <div
                key={l.item}
                style={{
                  display: 'flex',
                  gap: 10,
                  fontSize: 12.5,
                  color: C.ink,
                  padding: '3px 0',
                  opacity: i < visible ? 1 : 0,
                  transform:
                    i < visible
                      ? 'translateY(0)'
                      : 'translateY(4px)',
                  transition:
                    'opacity .25s ease, transform .25s ease',
                }}
              >
                <span
                  style={{
                    color: C.stamp,
                    fontWeight: 700,
                    width: 22,
                  }}
                >
                  {l.qty}
                </span>

                <span>{l.item}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              borderTop: `1px dashed ${C.ink}55`,
              margin: '14px 0',
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              fontWeight: 500,
              color: C.inkSoft,
            }}
          >
            <span>ORDER № 0482</span>

            <span>
              {visible < orderLines.length
                ? 'PRINTING…'
                : 'IN KITCHEN'}
            </span>
          </div>

          {/* Barcode-style QR nod */}
          <div
            style={{
              display: 'flex',
              gap: 1.5,
              marginTop: 16,
              justifyContent: 'center',
            }}
          >
            {Array.from({ length: 34 }, (_, i) => (
              <div
                key={i}
                style={{
                  width: 2,
                  height: (i * 7) % 5 === 0 ? 20 : 12,
                  background: C.ink,
                }}
              />
            ))}
          </div>
        </div>

        <Zigzag flip />
      </div>

      {/* Rubber stamp */}
      <div
        style={{
          position: 'absolute',
          top: 34,
          right: -18,
          transform: `rotate(-16deg) scale(${stamped ? 1 : 0
            })`,
          transition:
            'transform .35s cubic-bezier(.34,1.6,.64,1)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            border: `3px solid ${C.stamp}`,
            borderRadius: 8,
            color: C.stamp,
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: '0.08em',
            padding: '4px 12px',
            opacity: 0.85,
          }}
        >
          CONFIRMED
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Order tracker — slides out from the receipt after CONFIRMED
   ───────────────────────────────────────────────────────────── */

const trackSteps = [
  { key: 'received', label: 'Received' },
  { key: 'ready', label: 'Ready' },
  { key: 'complete', label: 'Complete' },
]

function OrderTracker({ visible: show, onComplete }: { visible: boolean; onComplete?: () => void }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!show) { setStep(0); return }
    let s = 0
    setStep(0)
    const iv = setInterval(() => {
      s += 1
      if (s >= trackSteps.length) {
        clearInterval(iv)
        setTimeout(() => onComplete?.(), 900)
      }
      setStep(s)
    }, 1400)
    return () => clearInterval(iv)
  }, [show])

  return (
    <div style={{
      overflow: 'hidden',
      maxWidth: show ? 220 : 0,
      opacity: show ? 1 : 0,
      transform: show ? 'translateX(0)' : 'translateX(30px)',
      transition: 'max-width 0.5s cubic-bezier(.4,0,.2,1), opacity 0.45s ease, transform 0.45s ease',
      flexShrink: 0,
    }}>
      <div style={{
        background: C.paperLt,
        border: `1px dashed ${C.ink}33`,
        borderRadius: 12,
        padding: '18px 16px',
        width: 200,
        marginLeft: 12,
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          color: C.inkSoft, marginBottom: 18,
          fontFamily: FONT,
        }}>
          ORDER № 0482 · TRACKING
        </div>

        {/* Vertical step list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {trackSteps.map((s, i) => {
            const done = i < step
            const active = i === step
            return (
              <div key={s.key} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Circle */}
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${done || active ? C.stamp : `${C.ink}22`}`,
                    background: done ? C.stamp : active ? `${C.stamp}15` : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.4s ease',
                    boxShadow: active ? `0 0 0 4px ${C.stamp}18` : 'none',
                  }}>
                    {done && (
                      <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke={C.paperLt} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {active && !done && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: C.stamp,
                        animation: 'kodtePulseDot 1s ease-in-out infinite',
                      }} />
                    )}
                  </div>
                  {/* Label */}
                  <span style={{
                    fontSize: 11, fontWeight: done || active ? 700 : 400,
                    color: done || active ? C.ink : `${C.ink}55`,
                    fontFamily: FONT,
                    letterSpacing: '0.03em',
                    transition: 'color 0.3s ease',
                  }}>
                    {s.label}
                  </span>
                </div>
                {/* Vertical connector */}
                {i < trackSteps.length - 1 && (
                  <div style={{
                    width: 2, height: 22, marginLeft: 12,
                    background: done ? C.stamp : `${C.ink}18`,
                    borderRadius: 1,
                    transition: 'background 0.4s ease',
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Order scene — receipt → tracker slides in from right → ticket book
   ───────────────────────────────────────────────────────────── */

type ScenePhase = 'receipt' | 'tracker' | 'tickets'

function OrderScene() {
  const [phase, setPhase] = useState<ScenePhase>('receipt')
  const [confirmed, setConfirmed] = useState(false)

  function handleTrackComplete() {
    setPhase('tickets')
  }

  function handleTicketsDone() {
    setPhase('receipt')
    setConfirmed(false)
  }

  function handleStamped(v: boolean) {
    setConfirmed(v)
    if (v) setPhase('tracker')
  }

  return (
    <div style={{ position: 'relative', width: 560, minHeight: 420 }}>

      {/* ── Receipt + tracker side by side (phases: receipt, tracker) ── */}
      <div style={{
        position: phase === 'tickets' ? 'absolute' : 'relative',
        inset: 0,
        opacity: phase === 'tickets' ? 0 : 1,
        transform: phase === 'tickets' ? 'scale(0.96) translateY(8px)' : 'scale(1) translateY(0)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
        pointerEvents: phase === 'tickets' ? 'none' : 'auto',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
      }}>
        <OrderTicket onStamped={handleStamped} />
        <OrderTracker visible={confirmed} onComplete={handleTrackComplete} />
      </div>

      {/* ── Ticket book (phase: tickets) — split-flap departures board ── */}
      <div style={{
        position: phase !== 'tickets' ? 'absolute' : 'relative',
        inset: 0,
        width: 420,
        opacity: phase === 'tickets' ? 1 : 0,
        transform: phase === 'tickets' ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
        transition: 'opacity 0.55s ease 0.15s, transform 0.55s ease 0.15s',
        pointerEvents: phase === 'tickets' ? 'auto' : 'none',
        display: 'flex',
        alignItems: 'center',
      }}>
        <DeparturesBoard onDone={handleTicketsDone} />
      </div>

    </div>
  )
}

function EventTicketStub() {
  const [sold, setSold] = useState(0)
  const target = 214

  useEffect(() => {
    let cancelled = false
    let iv: ReturnType<typeof setInterval> | undefined

    function runCount() {
      let n = 0
      setSold(0)

      iv = setInterval(() => {
        if (cancelled) return

        n += Math.ceil(target / 40)

        if (n >= target) {
          n = target

          if (iv) clearInterval(iv)

          setTimeout(() => {
            if (!cancelled) runCount()
          }, 3800)
        }

        setSold(n)
      }, 45)
    }

    runCount()

    return () => {
      cancelled = true

      if (iv) clearInterval(iv)
    }
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        maxWidth: 460,
        margin: '0 auto',
        boxShadow: '0 24px 50px rgba(38,32,26,0.2)',
        transform: 'rotate(-0.6deg)',
      }}
    >
      <div
        style={{
          background: C.paperLt,
          flex: 1,
          padding: '22px 24px',
          fontFamily: FONT,
          position: 'relative',
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 12,
            color: C.stamp,
            letterSpacing: '0.12em',
            marginBottom: 6,
          }}
        >
          ADMIT ONE · EVENT TICKET
        </div>

        <div
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 24,
            letterSpacing: '-0.02em',
            color: C.ink,
            marginBottom: 4,
          }}
        >
          RIVERSIDE SESSIONS
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: C.inkSoft,
            marginBottom: 14,
          }}
        >
          JINJA · SAT 24 OCT · GATE 7:00 PM
        </div>

        <div
          style={{
            display: 'flex',
            gap: 18,
            fontSize: 10.5,
            fontWeight: 500,
            color: C.inkSoft,
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                color: C.ink,
                fontWeight: 700,
              }}
            >
              GENERAL
            </div>
            UGX 40,000
          </div>

          <div>
            <div
              style={{
                color: C.ink,
                fontWeight: 700,
              }}
            >
              VIP
            </div>
            UGX 120,000
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 10,
            fontWeight: 600,
            color: C.ok,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: C.ok,
              animation:
                'kodtePulseDot 1.4s ease-in-out infinite',
            }}
          />

          {sold} SOLD, LIVE
        </div>
      </div>

      {/* Perforation */}
      <div
        style={{
          position: 'relative',
          width: 0,
        }}
      >
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: -4,
              top: i * 26 + 6,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: C.paper,
            }}
          />
        ))}
      </div>

      <div
        style={{
          background: C.ink,
          color: C.paperLt,
          width: 96,
          padding: '18px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          animation:
            'kodteGatePulse 2.6s ease-in-out infinite',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 1.5,
          }}
        >
          {Array.from({ length: 25 }, (_, i) => (
            <div
              key={i}
              style={{
                width: 5,
                height: 5,
                background:
                  (i * 7) % 3 === 0
                    ? C.paperLt
                    : 'transparent',
              }}
            />
          ))}
        </div>

        <span
          style={{
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 8.5,
            letterSpacing: '0.06em',
            writingMode: 'vertical-rl',
          }}
        >
          SCAN AT GATE
        </span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Ticket Book replacement — "DEPARTURES BOARD" split-flap widget
   ───────────────────────────────────────────────────────────── */

const FB = {
  board: C.paper,
  boardEdge: C.spike,
  flap: C.paperLt,
  flapDim: '#e8dfcc',
  ink: C.ink,
  amber: C.stamp,
  ok: C.ok,
}

const flapEvents = [
  { title: 'RIVERSIDE SESSIONS', venue: 'JINJA', date: 'SAT 24 OCT  7:00 PM', tier1: 'GENERAL', price1: '40,000', tier2: 'VIP', price2: '120,000', sold: 214 },
  { title: 'NEON GARDEN RAVE', venue: 'KAMPALA', date: 'FRI 07 NOV  9:00 PM', tier1: 'REGULAR', price1: '30,000', tier2: 'TABLE', price2: '300,000', sold: 88 },
  { title: 'LAKE BREEZE BRUNCH', venue: 'ENTEBBE', date: 'SUN 16 NOV  11:00 AM', tier1: 'BRUNCH', price1: '55,000', tier2: 'COUPLE', price2: '90,000', sold: 57 },
  { title: 'AFROBEATS FRIDAY', venue: 'KAMPALA', date: 'FRI 21 NOV  8:00 PM', tier1: 'STANDARD', price1: '25,000', tier2: 'VIP BOOTH', price2: '200,000', sold: 341 },
]

const FLAP_TITLE_WIDTH = 19 // fixed-width flap row for the title

function flapPad(str: string, len: number) {
  const s = str.toUpperCase().slice(0, len)
  return s + ' '.repeat(len - s.length)
}

/* Single flap cell — flips on character change */
function FlapChar({ char, delay = 0, size = 15 }: { char: string; delay?: number; size?: number }) {
  const [display, setDisplay] = useState(char)
  const [flip, setFlip] = useState(false)
  const prev = useRef(char)

  useEffect(() => {
    if (char === prev.current) return
    prev.current = char
    const t0 = setTimeout(() => {
      setFlip(true)
      const t1 = setTimeout(() => setDisplay(char), 130)
      const t2 = setTimeout(() => setFlip(false), 260)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }, delay)
    return () => clearTimeout(t0)
  }, [char, delay])

  return (
    <div style={{
      position: 'relative', width: size * 0.72, height: size * 1.15,
      background: FB.flap, borderRadius: 2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      boxShadow: `0 1px 0 ${C.spike}44`,
      perspective: 120,
      flexShrink: 0,
    }}>
      {/* center seam */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: `${C.spike}55`, zIndex: 3 }} />
      {/* subtle top/bottom shading like real flap halves */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(255,255,255,0.18), transparent 50%, ${C.spike}18 51%, transparent)` }} />
      <span style={{
        position: 'relative', zIndex: 2,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size * 0.62,
        color: FB.ink,
        transform: flip ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transition: 'transform 0.13s ease-in',
        display: 'inline-block',
      }}>
        {display === ' ' ? '\u00A0' : display}
      </span>
    </div>
  )
}

function FlapWord({ text, width, size = 15, gap = 2 }: { text: string; width: number; size?: number; gap?: number }) {
  const chars = flapPad(text, width).split('')
  return (
    <div style={{ display: 'flex', gap }}>
      {chars.map((c, i) => (
        <FlapChar key={i} char={c} delay={i * 35} size={size} />
      ))}
    </div>
  )
}

/* A whole-line flap for less critical rows (venue/date, tiers) */
function FlapLine({ text, size = 11 }: { text: string; size?: number }) {
  const [display, setDisplay] = useState(text)
  const [flip, setFlip] = useState(false)
  const prev = useRef(text)

  useEffect(() => {
    if (text === prev.current) return
    prev.current = text
    setFlip(true)
    const t1 = setTimeout(() => setDisplay(text), 140)
    const t2 = setTimeout(() => setFlip(false), 280)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [text])

  return (
    <div style={{
      background: FB.flap, borderRadius: 3, padding: '5px 10px',
      position: 'relative', overflow: 'hidden', display: 'inline-block',
    }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: `${C.spike}44` }} />
      <span style={{
        fontFamily: FONT,
        fontWeight: 600, fontSize: size, color: FB.ink, letterSpacing: '0.04em',
        display: 'inline-block',
        transform: flip ? 'rotateX(-85deg)' : 'rotateX(0deg)',
        transition: 'transform 0.16s ease-in',
      }}>
        {display}
      </span>
    </div>
  )
}

/* Digit counter that flips up as it climbs, like a mechanical tally */
function FlapNumber({ value, digits = 3, size = 15 }: { value: number; digits?: number; size?: number }) {
  const str = String(value).padStart(digits, '0').split('')
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {str.map((d, i) => (
        <FlapChar key={i} char={d} delay={i * 25} size={size} />
      ))}
    </div>
  )
}

function DeparturesBoard({ onDone }: { onDone?: () => void } = {}) {
  const [idx, setIdx] = useState(0)
  const [sold, setSold] = useState(flapEvents[0].sold)
  const flipCount = useRef(0)
  const maxFlips = 3 // matches the old TicketBook cadence before handing back to the receipt

  useEffect(() => {
    flipCount.current = 0
    const iv = setInterval(() => {
      flipCount.current += 1
      if (flipCount.current >= maxFlips) {
        clearInterval(iv)
        // let the last flap settle before the scene resets
        setTimeout(() => onDone?.(), 1800)
        return
      }
      setIdx((i) => (i + 1) % flapEvents.length)
    }, 3600)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const target = flapEvents[idx].sold
    let n = 0
    setSold(0)
    const iv = setInterval(() => {
      n += Math.ceil(target / 14)
      if (n >= target) { n = target; clearInterval(iv) }
      setSold(n)
    }, 55)
    return () => clearInterval(iv)
  }, [idx])

  const ev = flapEvents[idx]

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{
        width: 400, margin: '0 auto',
        background: `linear-gradient(180deg, ${C.paperLt}, ${C.paper})`,
        border: `3px solid ${FB.boardEdge}55`,
        borderRadius: 10,
        boxShadow: '0 30px 60px rgba(38,32,26,0.22), inset 0 0 0 1px rgba(38,32,26,0.06)',
        padding: '20px 18px 22px',
        boxSizing: 'border-box',
      }}>
        {/* header strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: FB.amber }}>NOW SELLING</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: FB.ok, boxShadow: `0 0 6px ${FB.ok}` }} />
            <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', color: C.inkSoft }}>LIVE</span>
          </div>
        </div>

        {/* title — per-character flap */}
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <FlapWord text={ev.title} width={FLAP_TITLE_WIDTH} size={19} />
        </div>

        {/* venue / date */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <FlapLine text={ev.venue} />
          <FlapLine text={ev.date} />
        </div>

        {/* tiers */}
        <div style={{ display: 'flex', gap: 18, marginBottom: 18 }}>
          {[{ l: ev.tier1, p: ev.price1 }, { l: ev.tier2, p: ev.price2 }].map(({ l, p }) => (
            <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: C.inkSoft }}>{l}</span>
              <FlapLine text={`UGX ${p}`} size={12} />
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px dashed ${C.ink}33`, marginBottom: 16 }} />

        {/* sold counter — digit flaps */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FlapNumber value={sold} digits={3} size={17} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: C.inkSoft }}>SOLD</span>
          </div>
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: C.inkSoft }}>GATE 07</span>
        </div>
      </div>

      {/* dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 14 }}>
        {flapEvents.map((_, i) => (
          <span key={i} style={{
            width: i === idx ? 18 : 5, height: 5, borderRadius: 3,
            background: i === idx ? FB.amber : `${C.ink}2a`,
            transition: 'all .35s ease',
          }} />
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Steps
   ───────────────────────────────────────────────────────────── */

const steps = [
  {
    n: '01',
    title: 'Build your catalog',
    body: 'Items, prices, photos. Save and it’s live.',
  },
  {
    n: '02',
    title: 'Share your QR',
    body: 'On the table. Customers scan and order.',
  },
  {
    n: '03',
    title: 'Run the counter',
    body: 'Tickets print in. Mark ready, mark paid.',
  },
]

function TicketStack() {
  const rot = [-6, 2, -2]

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 26,
        flexWrap: 'wrap',
        padding: '20px 0 10px',
      }}
    >
      {steps.map((s, i) => (
        <div
          key={s.n}
          style={{
            background: C.paperLt,
            width: 220,
            borderRadius: 2,
            padding: '18px 18px 22px',
            transform: `rotate(${rot[i]}deg)`,
            boxShadow:
              '0 14px 30px rgba(38,32,26,0.18)',
            fontFamily: FONT,
          }}
        >
          <PunchHoles />

          <div
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 30,
              color: `${C.ink}33`,
              marginTop: 10,
            }}
          >
            {s.n}
          </div>

          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: C.ink,
              margin: '6px 0 8px',
            }}
          >
            {s.title}
          </div>

          <div
            style={{
              fontSize: 11.5,
              fontWeight: 400,
              lineHeight: 1.6,
              color: C.inkSoft,
            }}
          >
            {s.body}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Features
   ───────────────────────────────────────────────────────────── */

const topFeatures = [
  {
    Icon: QrCode,
    title: 'Instant QR generation',
    body: 'One code, live the moment you sign up.',
    photo: '/features/qr.jpg',
    objectPosition: 'center 35%',
  },
  {
    Icon: ClipboardList,
    title: 'Live order dashboard',
    body: 'Orders land in real time — pending to ready in a tap.',
    photo: '/features/dashboard.jpg',
    objectPosition: 'center top',
  },
  {
    Icon: ShoppingBag,
    title: 'Catalog management',
    body: 'Edit items anytime, customers see it instantly.',
    photo: '/features/catalog.jpg',
    objectPosition: 'center 55%',
  },
  {
    Icon: CreditCard,
    title: 'Payment tracking',
    body: 'Mark paid, unpaid, or refunded. Revenue at a glance.',
    photo: '/features/payments.jpg',
    objectPosition: 'center 40%',
  },
]

function FeatureCards() {
  const rot = [-1.4, 0.8, -0.6, 1.2]

  return (
    <div
      style={{
        maxWidth: 1040,
        margin: '0 auto',
      }}
    >
      <h2
        style={{
          textAlign: 'center',
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 20,
          letterSpacing: '0.08em',
          color: C.ink,
          marginBottom: 30,
        }}
      >
        WHAT'S INCLUDED
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            window.innerWidth < 760
              ? 'repeat(2, 1fr)'
              : 'repeat(4, 1fr)',
          gap: 20,
        }}
      >
        {topFeatures.map(
          ({ Icon, title, body, photo, objectPosition }, i) => (
            <div
              key={title}
              style={{
                position: 'relative',
                background: C.paperLt,
                borderRadius: 4,
                padding: '0 20px 22px',
                boxShadow:
                  '0 14px 30px rgba(38,32,26,0.14)',
                transform: `rotate(${rot[i]}deg)`,
              }}
            >
              <Zigzag />

              {/* Photo print — framed snapshot tucked into the ticket */}
              <div
                style={{
                  position: 'relative',
                  margin: '0 -20px',
                  padding: '14px 16px 0',
                  background: `linear-gradient(180deg, ${C.paper} 0%, ${C.paperLt} 100%)`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: '50%',
                    transform: `translateX(-50%) rotate(${rot[i] > 0 ? -5 : 5}deg)`,
                    width: 48,
                    height: 16,
                    background: `${C.stamp}44`,
                    boxShadow: '0 2px 4px rgba(38,32,26,0.12)',
                    zIndex: 2,
                    pointerEvents: 'none',
                  }}
                />

                <div
                  style={{
                    position: 'relative',
                    height: 128,
                    overflow: 'hidden',
                    borderRadius: 4,
                    border: `1px solid ${C.spike}40`,
                    boxShadow:
                      'inset 0 0 0 1px rgba(255,255,255,0.45), 0 10px 22px rgba(38,32,26,0.16)',
                    background: C.paper,
                  }}
                >
                  <img
                    src={photo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: objectPosition,
                      display: 'block',
                      filter: 'sepia(0.14) contrast(1.06) saturate(1.08)',
                      transform: 'scale(1.02)',
                    }}
                  />

                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(180deg, rgba(239,230,210,0.05) 0%, rgba(239,230,210,0.55) 88%, rgba(247,241,227,0.95) 100%)',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '0 0 4px',
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: C.paperLt,
                    border: `1.5px solid ${C.stamp}55`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: -22,
                    marginBottom: 14,
                    boxShadow: '0 4px 10px rgba(38,32,26,0.18)',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <Icon
                    size={17}
                    color={C.stamp}
                    strokeWidth={2}
                  />
                </div>

                <h3
                  style={{
                    fontFamily: FONT,
                    fontWeight: 800,
                    fontSize: 16,
                    letterSpacing: '0.02em',
                    color: C.ink,
                    marginBottom: 8,
                  }}
                >
                  {title.toUpperCase()}
                </h3>

                <p
                  style={{
                    fontFamily: FONT,
                    fontSize: 11.5,
                    fontWeight: 400,
                    lineHeight: 1.6,
                    color: C.inkSoft,
                    margin: 0,
                  }}
                >
                  {body}
                </p>
              </div>

              <Zigzag flip />
            </div>
          )
        )}
      </div>

      <div
        style={{
          textAlign: 'center',
          marginTop: 32,
          fontFamily: FONT,
          fontSize: 11.5,
          fontWeight: 500,
          color: C.inkSoft,
          letterSpacing: '0.08em',
        }}
      >
        + EVENT TICKET SALES & SCANNING, ONE PLAN
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Venues
   ───────────────────────────────────────────────────────────── */

const venues = [
  { name: 'Serena Hotel', city: 'Kampala' },
  { name: 'Cafe Javas', city: 'Kampala' },
  { name: 'Speke Resort Munyonyo', city: 'Kampala' },
  { name: 'Sheraton Kampala', city: 'Kampala' },
  { name: 'Source of the Nile Grill', city: 'Jinja' },
  { name: 'Lake Victoria Serena', city: 'Entebbe' },
  { name: 'Igongo Cultural Centre', city: 'Mbarara' },
  { name: 'Acholi Inn', city: 'Gulu' },
]

function Manifest() {
  const loop = [...venues, ...venues]

  return (
    <div
      style={{
        overflow: 'hidden',
        borderTop: `1px dashed ${C.ink}44`,
        borderBottom: `1px dashed ${C.ink}44`,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 'max-content',
          animation:
            'kodteManifest 32s linear infinite',
        }}
      >
        {loop.map((v, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'baseline',
              padding: '14px 30px',
              fontFamily: FONT,
              fontSize: 12.5,
              fontWeight: 500,
              color: C.inkSoft,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ color: C.stamp }}>
              {String(
                (i % venues.length) + 1
              ).padStart(2, '0')}
            </span>

            <span
              style={{
                color: C.ink,
                fontWeight: 600,
              }}
            >
              {v.name}
            </span>

            <span>· {v.city.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Photo strip — real photographs, taped in like proofs pinned to
   a corkboard above the counter. This is the one place real
   photography enters an otherwise illustrated page, so it's kept
   small, tactile, and framed like physical prints rather than a
   generic hero image or stock-photo banner.
   ───────────────────────────────────────────────────────────── */

const galleryPhotos = [
  {
    url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=500&q=80',
    caption: 'Table for two, order in',
    rot: -5,
  },
  {
    url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=500&q=80',
    caption: 'Scan, tap, done',
    rot: 3,
  },
  {
    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=500&q=80',
    caption: 'Kitchen keeps up',
    rot: -2,
  },
  {
    url: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=500&q=80',
    caption: 'Gate night, tickets scanning',
    rot: 4,
  },
]

function Polaroid({ url, caption, rot }: { url: string; caption: string; rot: number }) {
  return (
    <div
      style={{
        background: '#fffdf8',
        padding: '10px 10px 16px',
        boxShadow: '0 16px 32px rgba(38,32,26,0.22)',
        transform: `rotate(${rot}deg)`,
        width: 190,
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* washi tape */}
      <div
        style={{
          position: 'absolute',
          top: -10,
          left: '50%',
          transform: `translateX(-50%) rotate(${rot > 0 ? -6 : 6}deg)`,
          width: 56,
          height: 20,
          background: `${C.stamp}55`,
          opacity: 0.8,
          boxShadow: '0 2px 4px rgba(38,32,26,0.15)',
        }}
      />

      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          overflow: 'hidden',
          background: C.paper,
        }}
      >
        <img
          src={url}
          alt={caption}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            filter: 'sepia(0.12) contrast(1.03)',
          }}
        />
      </div>

      <div
        style={{
          textAlign: 'center',
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 600,
          color: C.inkSoft,
          letterSpacing: '0.02em',
          marginTop: 10,
        }}
      >
        {caption}
      </div>
    </div>
  )
}

function PhotoStrip() {
  return (
    <section style={{ padding: '10px 24px 90px' }}>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 11.5,
          fontWeight: 600,
          color: C.stamp,
          letterSpacing: '0.1em',
          marginBottom: 10,
          textAlign: 'center',
        }}
      >
        FROM THE COUNTER
      </div>

      <h2
        style={{
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 'clamp(18px,2.5vw,26px)',
          letterSpacing: '-0.01em',
          color: C.inkSoft,
          margin: '0 0 34px',
          textAlign: 'center',
        }}
      >
        Real tables, real gates
      </h2>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 28,
          flexWrap: 'wrap',
          maxWidth: 1000,
          margin: '0 auto',
        }}
      >
        {galleryPhotos.map((p) => (
          <Polaroid key={p.caption} {...p} />
        ))}
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   Main
   ───────────────────────────────────────────────────────────── */

type KodteLandingTicketProps = {
  onGetStarted?: () => void
  onCreateEventTicket?: () => void
}

export default function KodteLandingTicket({
  onGetStarted,
  onCreateEventTicket,
}: KodteLandingTicketProps = {}) {
  usePageMeta({
    title: 'Koddly — QR ordering and event ticketing for Uganda',
    description:
      'One QR code lets customers scan, order, and pay from their phone. Sell event tickets at the gate. Built for restaurants, bars, and venues across Uganda.',
    canonicalPath: '/',
    suppressSuffix: true,
  })

  return (
    <div
      style={{
        background: C.paper,
        color: C.ink,
        minHeight: '100vh',
        overflowX: 'hidden',
        fontFamily: FONT,
      }}
    >
      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: ${FONT};
        }

        button,
        input,
        textarea,
        select {
          font-family: ${FONT};
        }

        @keyframes kodteManifest {
          from {
            transform: translateX(0);
          }

          to {
            transform: translateX(-50%);
          }
        }

        @keyframes kodteDeckIn {
          from {
            opacity: 0;
            transform: translateY(18px) rotate(-4deg);
          }

          to {
            opacity: 1;
            transform: translateY(0) rotate(0deg);
          }
        }

        @keyframes kodtePulseDot {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }

          50% {
            opacity: 0.4;
            transform: scale(0.75);
          }
        }

        @keyframes kodteGatePulse {
          0%,
          100% {
            box-shadow:
              inset 0 0 0 0 rgba(246,237,225,0);
          }

          50% {
            box-shadow:
              inset 0 0 14px 0 rgba(246,237,225,0.15);
          }
        }

        .kodte-stamp-btn {
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .kodte-stamp-btn:hover {
          transform: rotate(-2deg) scale(1.03);
        }
      `}</style>

      {/* Subtle paper grain */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.5,
          backgroundImage: `repeating-linear-gradient(
            0deg,
            ${C.ink}05 0 1px,
            transparent 1px 3px
          )`,
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* HEADER */}
        <header
          style={{
            borderBottom: `1px dashed ${C.ink}44`,
            padding: '18px 24px',
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <a
              href="#"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <img
                  src="/kodte-icon.svg"
                  alt=""
                  width={28}
                  height={28}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                  }}
                />
              </div>

              <span
                style={{
                  fontFamily: FONT,
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  color: C.ink,
                }}
              >
                Koddly
              </span>
            </a>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <button
                onClick={onCreateEventTicket}
                className="kodte-stamp-btn"
                style={{
                  background: 'transparent',
                  border: `1.5px dashed ${C.ink}66`,
                  color: C.ink,
                  borderRadius: 6,
                  padding: '7px 14px',
                  fontFamily: FONT,
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <Scissors size={14} />
                 Ticketing
              </button>

              <button
                className="kodte-stamp-btn"
                style={{
                  background: 'transparent',
                  border: `2.5px solid ${C.stamp}`,
                  color: C.stamp,
                  borderRadius: 8,
                  padding: '7px 16px',
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  transform: 'rotate(-2deg)',
                }}
                onClick={onGetStarted}
              >
                Get Started
              </button>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section
          style={{
            position: 'relative',
            padding: 'clamp(50px,8vw,90px) 0 60px',
            overflow: 'hidden',
          }}
        >
          {/* Backdrop photo — a real counter, faded under a paper wash
              so the illustration reads as printed on top of it rather
              than a photo competing with the ticket graphics. */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
            }}
          >
            <img
              src={heroPhoto}
              alt=""
              loading="eager"
              decoding="async"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center 45%',
                filter: 'sepia(0.18) contrast(0.96) brightness(1.08) saturate(1.05)',
              }}
            />

            {/* paper-toned scrim — readable text on the left, photo visible on the right */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(100deg, ${C.paper} 0%, ${C.paper}e8 26%, ${C.paper}b3 48%, ${C.paper}55 68%, ${C.paper}22 100%)`,
              }}
            />
          </div>

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateColumns:
                window.innerWidth < 860
                  ? '1fr'
                  : '1fr auto',
              alignItems: 'center',
              gap: 0,
            }}
          >
            <div style={{ paddingLeft: 'clamp(24px, 6vw, 100px)', maxWidth: 580 }}>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: C.stamp,
                  letterSpacing: '0.1em',
                  marginBottom: 20,
                }}
              >

              </div>

              <h1
                style={{
                  fontFamily: FONT,
                  fontWeight: 500,
                  fontSize: 'clamp(40px,6.5vw,72px)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.04em',
                  margin: '0 0 28px',
                }}
              >
                ONE SCAN.{' '}
                <span style={{ color: C.stamp }}>
                  TOTAL CONTROL.
                </span>
              </h1>

              <p
                style={{
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 400,
                  lineHeight: 1.7,
                  color: C.inkSoft,
                  maxWidth: 480,
                  margin: '0 0 40px',
                  opacity: 0.85,
                }}
              >
                Gone are the days of paper menus, long queues, and chasing payments at
                the till. One QR code lets your guests scan, order, and pay from their
                phone — while you run everything from one live dashboard.
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <button
                  className="kodte-stamp-btn"
                  style={{
                    background: C.ink,
                    color: C.paperLt,
                    border: 'none',
                    padding: '13px 26px',
                    fontFamily: FONT,
                    fontWeight: 800,
                    fontSize: 16,
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                  onClick={onGetStarted}
                >
                  Get Started
                </button>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: FONT,
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: C.inkSoft,
                  }}
                >


                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingRight: 0,
                overflow: 'hidden',
              }}
            >
              <OrderScene />
            </div>
          </div>
        </section>

        <Manifest />

        {/* STEPS */}
        <section
          style={{
            padding: '80px 24px 40px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontSize: 11.5,
              fontWeight: 600,
              color: C.stamp,
              letterSpacing: '0.1em',
              marginBottom: 10,
            }}
          >
            THE SPIKE
          </div>

          <h2
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 'clamp(18px,2.5vw,26px)',
              letterSpacing: '-0.01em',
              color: C.inkSoft,
              margin: '0 0 8px',
            }}
          >
            Three tickets to live
          </h2>

          <TicketStack />
        </section>

        {/* PHOTO STRIP — real photography, taped in like counter proofs */}
        <PhotoStrip />

        {/* EVENT TICKETING */}
        <section
          style={{
            padding: '20px 24px 90px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontSize: 11.5,
              fontWeight: 600,
              color: C.stamp,
              letterSpacing: '0.1em',
              marginBottom: 10,
            }}
          >
            ALSO ON KODDLY
          </div>

          <h2
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 'clamp(18px,2.5vw,26px)',
              letterSpacing: '-0.01em',
              color: C.inkSoft,
              margin: '0 0 8px',
            }}
          >
            Sell event tickets the same way
          </h2>

          <p
            style={{
              fontFamily: FONT,
              fontSize: 11.5,
              fontWeight: 400,
              lineHeight: 1.6,
              color: C.inkSoft,
              maxWidth: 360,
              margin: '0 auto 28px',
              opacity: 0.8,
            }}
          >
            Same platform, same QR — sell tickets, scan at the gate, watch sales live.
          </p>

          <EventTicketStub />
        </section>

        {/* FEATURES */}
        <section
          style={{
            padding: '0 24px 90px',
          }}
        >
          <FeatureCards />
        </section>

        {/* CTA */}
        <section
          style={{
            padding: '0 24px 90px',
          }}
        >
          <div
            style={{
              maxWidth: 560,
              margin: '0 auto',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                borderTop: `2px dashed ${C.ink}66`,
                position: 'relative',
                paddingTop: 34,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: -11,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: C.paper,
                  padding: '0 10px',
                  color: C.inkSoft,
                }}
              >
                <Scissors size={16} />
              </span>

              <h2
                style={{
                  fontFamily: FONT,
                  fontWeight: 800,
                  fontSize:
                    'clamp(28px,4vw,42px)',
                  letterSpacing: '-0.03em',
                  margin: '0 0 14px',
                }}
              >
                READY TO OPEN THE COUNTER?
              </h2>

              <p
                style={{
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 400,
                  lineHeight: 1.7,
                  color: C.inkSoft,
                  margin: '0 0 28px',
                }}
              >
                Menus or tickets — five minutes to your
                first scan. No card, no install.
              </p>

              <button
                className="kodte-stamp-btn"
                style={{
                  background: C.stamp,
                  color: C.paperLt,
                  border: 'none',
                  padding: '15px 34px',
                  borderRadius: 3,
                  fontFamily: FONT,
                  fontWeight: 800,
                  fontSize: 17,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
                onClick={onGetStarted}
              >
                Get Started
              </button>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer
          style={{
            borderTop: `1px dashed ${C.ink}44`,
            padding: '48px 24px 26px',
            fontFamily: FONT,
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: '0 auto',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  window.innerWidth < 700
                    ? '1fr'
                    : '1.3fr 1fr 1fr 1fr',
                gap: 32,
                paddingBottom: 32,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: C.ink,
                    marginBottom: 10,
                  }}
                >
                  Koddly
                </div>

                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    lineHeight: 1.7,
                    color: C.inkSoft,
                    maxWidth: 260,
                    margin: 0,
                  }}
                >
                  One QR for menus, orders, and event
                  tickets — built for venues across Uganda.
                </p>
              </div>

              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: C.ink,
                    marginBottom: 12,
                  }}
                >
                  PRODUCT
                </div>

                {[
                  'QR Menus',
                  'Order Dashboard',
                  'Event Ticketing',
                  'Payments',
                ].map((l) => (
                  <div
                    key={l}
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: C.inkSoft,
                      marginBottom: 8,
                    }}
                  >
                    {l}
                  </div>
                ))}
              </div>

              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: C.ink,
                    marginBottom: 12,
                  }}
                >
                  COMPANY
                </div>

                {['About', 'Contact', 'Support'].map(
                  (l) => (
                    <div
                      key={l}
                      style={{
                        fontSize: 12,
                        fontWeight: 400,
                        color: C.inkSoft,
                        marginBottom: 8,
                      }}
                    >
                      {l}
                    </div>
                  )
                )}
              </div>

              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: C.ink,
                    marginBottom: 12,
                  }}
                >
                  LEGAL
                </div>

                {[
                  'Terms of Service',
                  'Privacy Policy',
                ].map((l) => (
                  <div
                    key={l}
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: C.inkSoft,
                      marginBottom: 8,
                    }}
                  >
                    {l}
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                borderTop: `1px dashed ${C.ink}44`,
                paddingTop: 20,
                display: 'flex',
                flexDirection:
                  window.innerWidth < 700
                    ? 'column'
                    : 'row',
                gap: 8,
                justifyContent: 'space-between',
                fontSize: 11,
                fontWeight: 400,
                color: C.inkSoft,
              }}
            >
              <span>
                © {new Date().getFullYear()} QBI Labs SMC.
                All rights reserved.
              </span>

              <span>
                Koddly is a product of QBI Labs SMC ·
                Kampala, Uganda
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}