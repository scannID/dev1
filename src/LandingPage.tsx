import { useState, useEffect } from 'react'
import {
  Scissors,
  Check,
  QrCode,
  ClipboardList,
  ShoppingBag,
  CreditCard,
} from 'lucide-react'

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
            fontFamily: "'Outfit', sans-serif",
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
                fontFamily: "'Outfit', sans-serif",
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: C.ink,
              }}
            >
              KODE
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
          transform: `rotate(-16deg) scale(${
            stamped ? 1 : 0
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
            fontFamily: "'Outfit', sans-serif",
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
  { key: 'ready',    label: 'Ready' },
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
          fontFamily: "'Outfit', sans-serif",
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
                        <path d="M2 5l2.5 2.5L8 3" stroke={C.paperLt} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {active && !done && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: C.stamp,
                        animation: 'kodePulseDot 1s ease-in-out infinite',
                      }} />
                    )}
                  </div>
                  {/* Label */}
                  <span style={{
                    fontSize: 11, fontWeight: done || active ? 700 : 400,
                    color: done || active ? C.ink : `${C.ink}55`,
                    fontFamily: "'Outfit', sans-serif",
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

      {/* ── Ticket book (phase: tickets) ── */}
      <div style={{
        position: phase !== 'tickets' ? 'absolute' : 'relative',
        inset: 0,
        width: 420,
        opacity: phase === 'tickets' ? 1 : 0,
        transform: phase === 'tickets' ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
        transition: 'opacity 0.55s ease 0.15s, transform 0.55s ease 0.15s',
        pointerEvents: phase === 'tickets' ? 'auto' : 'none',
      }}>
        <TicketBook onDone={handleTicketsDone} />
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
          fontFamily: "'Outfit', sans-serif",
          position: 'relative',
        }}
      >
        <div
          style={{
            fontFamily: "'Outfit', sans-serif",
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
            fontFamily: "'Outfit', sans-serif",
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
                'kodePulseDot 1.4s ease-in-out infinite',
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
            'kodeGatePulse 2.6s ease-in-out infinite',
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
            fontFamily: "'Outfit', sans-serif",
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
   Ticket Book — real paper-stack flip with borders
   ───────────────────────────────────────────────────────────── */

const bookEvents = [
  {
    title: 'RIVERSIDE SESSIONS',
    detail: 'JINJA · SAT 24 OCT · GATE 7:00 PM',
    tier1: 'GENERAL', price1: 'UGX 40,000',
    tier2: 'VIP',     price2: 'UGX 120,000',
    sold: 214,
  },
  {
    title: 'NEON GARDEN RAVE',
    detail: 'KAMPALA · FRI 7 NOV · GATE 9:00 PM',
    tier1: 'REGULAR', price1: 'UGX 30,000',
    tier2: 'TABLE',   price2: 'UGX 300,000',
    sold: 88,
  },
  {
    title: 'LAKE BREEZE BRUNCH',
    detail: 'ENTEBBE · SUN 16 NOV · 11:00 AM',
    tier1: 'BRUNCH',  price1: 'UGX 55,000',
    tier2: 'COUPLE',  price2: 'UGX 90,000',
    sold: 57,
  },
  {
    title: 'AFROBEATS FRIDAY',
    detail: 'KAMPALA · FRI 21 NOV · GATE 8:00 PM',
    tier1: 'STANDARD',  price1: 'UGX 25,000',
    tier2: 'VIP BOOTH', price2: 'UGX 200,000',
    sold: 341,
  },
]

function TicketBook({ onDone }: { onDone?: () => void } = {}) {
  const [current, setCurrent] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'peel' | 'land'>('idle')
  const [soldCount, setSoldCount] = useState(0)
  const total = bookEvents.length
  const maxFlips = 3

  // page-turn cycle — runs maxFlips times then calls onDone
  useEffect(() => {
    let count = 0
    function doFlip() {
      if (count >= maxFlips) { onDone?.(); return }
      setPhase('peel')
      setTimeout(() => {
        setCurrent((c) => (c + 1) % total)
        setPhase('land')
        setTimeout(() => {
          setPhase('idle')
          count++
          // schedule next flip
          setTimeout(doFlip, 2200)
        }, 400)
      }, 400)
    }
    const initial = setTimeout(doFlip, 2200)
    return () => clearTimeout(initial)
  }, []) // run once on mount

  // sold counter
  useEffect(() => {
    const target = bookEvents[current].sold
    let n = 0
    setSoldCount(0)
    const iv = setInterval(() => {
      n += Math.ceil(target / 30)
      if (n >= target) { n = target; clearInterval(iv) }
      setSoldCount(n)
    }, 30)
    return () => clearInterval(iv)
  }, [current])

  const ev = bookEvents[current]
  const next = bookEvents[(current + 1) % total]

  // The "stack" behind — 4 paper layers peeking
  const stackOffsets = [
    { x: 6,  y: 6,  rot: 2.2 },
    { x: 12, y: 12, rot: 4.2 },
    { x: 18, y: 17, rot: 6.0 },
    { x: 24, y: 22, rot: 7.8 },
  ]

  return (
    <div style={{ position: 'relative', width: 380, height: 420 }}>

      {/* Back paper stack layers */}
      {stackOffsets.map((o, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            top: o.y,
            left: o.x,
            borderRadius: 16,
            background: i === 0 ? '#f0e8d8' : i === 1 ? '#e8dfc8' : '#ddd5bb',
            boxShadow: '0 8px 24px rgba(38,32,26,0.12)',
            border: `1.5px solid ${C.spike}44`,
            transform: `rotate(${o.rot}deg)`,
          }}
        />
      ))}

      {/* Next card — lands from above when peeling */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          height: 420,
          borderRadius: 16,
          background: C.paperLt,
          border: `2px solid ${C.spike}55`,
          boxShadow: '0 20px 48px rgba(38,32,26,0.18)',
          overflow: 'hidden',
          transform: phase === 'land' ? 'translateY(-18px) rotate(-1deg) scale(0.97)' : 'none',
          transition: phase === 'land' ? 'transform 0.38s cubic-bezier(.2,.9,.3,1)' : 'none',
          opacity: phase === 'peel' ? 0 : 1,
        }}
      >
        <TicketBookPage ev={next} soldCount={0} fading={false} />
      </div>

      {/* Current card — peels away on exit */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          height: 420,
          borderRadius: 16,
          background: C.paperLt,
          border: `2px solid ${C.spike}55`,
          boxShadow: '0 28px 56px rgba(38,32,26,0.26)',
          overflow: 'hidden',
          transformOrigin: 'bottom center',
          transform: phase === 'peel'
            ? 'translateY(-24px) rotateX(12deg) scale(0.95)'
            : 'none',
          transition: phase === 'peel'
            ? 'transform 0.38s cubic-bezier(.4,0,.6,1), opacity 0.38s ease'
            : 'transform 0.28s ease',
          opacity: phase === 'peel' ? 0 : 1,
          perspective: 800,
        }}
      >
        <TicketBookPage ev={ev} soldCount={soldCount} fading={phase === 'peel'} />
      </div>

      {/* Border decorations — rounded corners */}
      <div style={{
        position: 'absolute', top: -7, right: -7,
        width: 32, height: 32,
        borderTop: `3px solid ${C.stamp}`,
        borderRight: `3px solid ${C.stamp}`,
        borderRadius: '0 14px 0 0',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -7, right: -7,
        width: 32, height: 32,
        borderBottom: `3px solid ${C.stamp}`,
        borderRight: `3px solid ${C.stamp}`,
        borderRadius: '0 0 14px 0',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -7, left: -7,
        width: 32, height: 32,
        borderBottom: `3px solid ${C.stamp}`,
        borderLeft: `3px solid ${C.stamp}`,
        borderRadius: '0 0 0 14px',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: -7, left: -7,
        width: 32, height: 32,
        borderTop: `3px solid ${C.stamp}`,
        borderLeft: `3px solid ${C.stamp}`,
        borderRadius: '14px 0 0 0',
        pointerEvents: 'none',
      }} />

      {/* Page dots */}
      <div style={{ position: 'absolute', bottom: -26, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
        {bookEvents.map((_, i) => (
          <span key={i} style={{
            width: i === current ? 18 : 5,
            height: 5,
            borderRadius: 3,
            background: i === current ? C.stamp : `${C.ink}2a`,
            transition: 'all .35s ease',
          }} />
        ))}
      </div>
    </div>
  )
}

function TicketBookPage({ ev, soldCount, fading }: {
  ev: typeof bookEvents[0],
  soldCount: number,
  fading: boolean,
}) {
  return (
    <div style={{
      padding: '26px 26px 60px',
      fontFamily: "'Outfit', sans-serif",
      position: 'relative',
      height: 420,
      boxSizing: 'border-box',
    }}>
      {/* Top strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.stamp }}>ADMIT ONE</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: `${C.ink}28` }} />
          ))}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: C.inkSoft }}>KODE</span>
      </div>

      <div style={{ borderTop: `1px dashed ${C.ink}33`, marginBottom: 16 }} />

      {/* Event name */}
      <div style={{
        fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em',
        color: C.ink, lineHeight: 1.1, marginBottom: 8,
        opacity: fading ? 0 : 1, transition: 'opacity 0.2s ease',
      }}>
        {ev.title}
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 500, color: C.inkSoft, letterSpacing: '0.07em', marginBottom: 20 }}>
        {ev.detail}
      </div>

      {/* Tiers */}
      <div style={{ display: 'flex', gap: 28, marginBottom: 20 }}>
        {[{ label: ev.tier1, price: ev.price1 }, { label: ev.tier2, price: ev.price2 }].map(({ label, price }) => (
          <div key={label}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.ink, letterSpacing: '0.07em' }}>{label}</div>
            <div style={{ fontWeight: 500, fontSize: 13, color: C.inkSoft, marginTop: 3 }}>{price}</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: `1px dashed ${C.ink}33`, marginBottom: 16 }} />

      {/* Live sold + barcode row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: C.ok }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: C.ok,
            animation: 'kodePulseDot 1.4s ease-in-out infinite',
          }} />
          {soldCount} SOLD
        </div>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} style={{
              width: 2,
              height: (i * 7) % 5 === 0 ? 22 : 13,
              background: C.ink, opacity: 0.5,
            }} />
          ))}
        </div>
      </div>

      {/* Bottom scan strip — pinned to bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: C.ink, padding: '10px 26px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderRadius: '0 0 16px 16px',
      }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: C.paper, opacity: 0.6 }}>
          SCAN AT GATE
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} style={{ width: 2, height: (i * 3) % 2 === 0 ? 12 : 7, background: C.paper, opacity: 0.4 }} />
          ))}
        </div>
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
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          <PunchHoles />

          <div
            style={{
              fontFamily: "'Outfit', sans-serif",
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
  },
  {
    Icon: ClipboardList,
    title: 'Live order dashboard',
    body: 'Orders land in real time — pending to ready in a tap.',
  },
  {
    Icon: ShoppingBag,
    title: 'Catalog management',
    body: 'Edit items anytime, customers see it instantly.',
  },
  {
    Icon: CreditCard,
    title: 'Payment tracking',
    body: 'Mark paid, unpaid, or refunded. Revenue at a glance.',
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
      <div
        style={{
          textAlign: 'center',
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 800,
          fontSize: 20,
          letterSpacing: '0.08em',
          color: C.ink,
          marginBottom: 30,
        }}
      >
        WHAT'S INCLUDED
      </div>

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
          ({ Icon, title, body }, i) => (
            <div
              key={title}
              style={{
                position: 'relative',
                background: C.paperLt,
                borderRadius: 4,
                padding: '24px 20px 22px',
                boxShadow:
                  '0 14px 30px rgba(38,32,26,0.14)',
                transform: `rotate(${rot[i]}deg)`,
              }}
            >
              <Zigzag />

              <div
                style={{
                  padding: '18px 0 4px',
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: `${C.stamp}18`,
                    border: `1.5px solid ${C.stamp}55`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Icon
                    size={17}
                    color={C.stamp}
                    strokeWidth={2}
                  />
                </div>

                <div
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800,
                    fontSize: 16,
                    letterSpacing: '0.02em',
                    color: C.ink,
                    marginBottom: 8,
                  }}
                >
                  {title.toUpperCase()}
                </div>

                <p
                  style={{
                    fontFamily: "'Outfit', sans-serif",
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
          fontFamily: "'Outfit', sans-serif",
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
            'kodeManifest 32s linear infinite',
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
              fontFamily: "'Outfit', sans-serif",
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
   Main
   ───────────────────────────────────────────────────────────── */

type KodeLandingTicketProps = {
  onGetStarted?: () => void
  onCreateEventTicket?: () => void
}

export default function KodeLandingTicket({
  onGetStarted,
  onCreateEventTicket,
}: KodeLandingTicketProps = {}) {
  return (
    <div
      style={{
        background: C.paper,
        color: C.ink,
        minHeight: '100vh',
        overflowX: 'hidden',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: 'Outfit', sans-serif;
        }

        button,
        input,
        textarea,
        select {
          font-family: 'Outfit', sans-serif;
        }

        @keyframes kodeManifest {
          from {
            transform: translateX(0);
          }

          to {
            transform: translateX(-50%);
          }
        }

        @keyframes kodeDeckIn {
          from {
            opacity: 0;
            transform: translateY(18px) rotate(-4deg);
          }

          to {
            opacity: 1;
            transform: translateY(0) rotate(0deg);
          }
        }

        @keyframes kodePulseDot {
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

        @keyframes kodeGatePulse {
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

        .kode-stamp-btn {
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .kode-stamp-btn:hover {
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
                  src="/kode-icon.svg"
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
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: C.ink,
                }}
              >
                KODE
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
                className="kode-stamp-btn"
                style={{
                  background: 'transparent',
                  border: `1.5px dashed ${C.ink}66`,
                  color: C.ink,
                  borderRadius: 6,
                  padding: '7px 14px',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <Scissors size={12} />
                EVENT TICKETING
              </button>

              <button
                className="kode-stamp-btn"
                style={{
                  background: 'transparent',
                  border: `2.5px solid ${C.stamp}`,
                  color: C.stamp,
                  borderRadius: 8,
                  padding: '7px 16px',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  transform: 'rotate(-2deg)',
                }}
                onClick={onGetStarted}
              >
                GET STARTED
              </button>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section
          style={{
            padding: 'clamp(50px,8vw,90px) 0 60px',
          }}
        >
          <div
            style={{
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
                  fontFamily: "'Outfit', sans-serif",
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
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 800,
                  fontSize: 'clamp(46px,7vw,78px)',
                  lineHeight: 0.98,
                  letterSpacing: '-0.04em',
                  margin: '0 0 28px',
                }}
              >
                ONE SCAN.
                <br />
                <span style={{ color: C.stamp }}>
                  TOTAL CONTROL.
                </span>
              </h1>

              <p
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 17,
                  fontWeight: 400,
                  lineHeight: 1.7,
                  color: C.inkSoft,
                  maxWidth: 420,
                  margin: '0 0 40px',
                  opacity: 0.85,
                }}
              >
                One code. Orders to your counter, tickets
                at the gate — no app, no queue.
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
                  className="kode-stamp-btn"
                  style={{
                    background: C.ink,
                    color: C.paperLt,
                    border: 'none',
                    padding: '13px 26px',
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800,
                    fontSize: 16,
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                  onClick={onGetStarted}
                >
                  GET STARTED
                </button>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: "'Outfit', sans-serif",
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
              fontFamily: "'Outfit', sans-serif",
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
              fontFamily: "'Outfit', sans-serif",
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

        {/* EVENT TICKETING */}
        <section
          style={{
            padding: '20px 24px 90px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 11.5,
              fontWeight: 600,
              color: C.stamp,
              letterSpacing: '0.1em',
              marginBottom: 10,
            }}
          >
            ALSO ON KODE
          </div>

          <h2
            style={{
              fontFamily: "'Outfit', sans-serif",
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
              fontFamily: "'Outfit', sans-serif",
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
                  fontFamily: "'Outfit', sans-serif",
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
                  fontFamily: "'Outfit', sans-serif",
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
                className="kode-stamp-btn"
                style={{
                  background: C.stamp,
                  color: C.paperLt,
                  border: 'none',
                  padding: '15px 34px',
                  borderRadius: 3,
                  fontFamily:
                    "'Outfit', sans-serif",
                  fontWeight: 800,
                  fontSize: 17,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
                onClick={onGetStarted}
              >
                GET STARTED
              </button>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer
          style={{
            borderTop: `1px dashed ${C.ink}44`,
            padding: '48px 24px 26px',
            fontFamily: "'Outfit', sans-serif",
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
                    fontFamily:
                      "'Outfit', sans-serif",
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: C.ink,
                    marginBottom: 10,
                  }}
                >
                  KODE
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
                Kode is a product of QBI Labs SMC ·
                Kampala, Uganda
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}