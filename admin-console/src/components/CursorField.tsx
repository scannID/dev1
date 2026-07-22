import { useEffect, useRef } from 'react'

function isBlankHoverTarget(el: Element | null) {
  if (!el) return true
  const interactive = el.closest(
    'a, button, input, textarea, select, label, [role="button"], .admin-login-card, img, svg'
  )
  return !interactive
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  base: number
}

export default function CursorField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const canvas = canvasRef.current
    if (reduce || coarse || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const mouse = { x: -9999, y: -9999, active: false }
    let raf = 0
    let w = 0
    let h = 0
    let particles: Particle[] = []

    const colors = [
      '139, 92, 246',
      '236, 72, 153',
      '56, 189, 248',
      '251, 146, 60',
    ]

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.min(90, Math.floor((w * h) / 18000))
      particles = Array.from({ length: count }, () => {
        const base = 1.2 + Math.random() * 1.8
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          r: base,
          base,
        }
      })
    }

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.active = isBlankHoverTarget(e.target as Element)
    }
    const onLeave = () => {
      mouse.active = false
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy

        if (p.x < -20) p.x = w + 20
        if (p.x > w + 20) p.x = -20
        if (p.y < -20) p.y = h + 20
        if (p.y > h + 20) p.y = -20

        if (mouse.active) {
          const dx = mouse.x - p.x
          const dy = mouse.y - p.y
          const dist = Math.hypot(dx, dy) || 1
          const radius = 160
          if (dist < radius) {
            const force = (1 - dist / radius) * 0.085
            p.vx += dx * force * 0.04 - dy * force * 0.03
            p.vy += dy * force * 0.04 + dx * force * 0.03
            p.r = p.base + (1 - dist / radius) * 2.2
          } else {
            p.r += (p.base - p.r) * 0.08
          }
        } else {
          p.r += (p.base - p.r) * 0.08
        }

        p.vx *= 0.96
        p.vy *= 0.96
        p.vx += (Math.random() - 0.5) * 0.02
        p.vy += (Math.random() - 0.5) * 0.02
      }

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist > 110) continue
          const nearCursor =
            mouse.active &&
            Math.hypot((a.x + b.x) / 2 - mouse.x, (a.y + b.y) / 2 - mouse.y) < 180
          if (!nearCursor && dist > 70) continue
          const alpha = nearCursor ? 0.22 * (1 - dist / 110) : 0.08 * (1 - dist / 70)
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`
          ctx.lineWidth = nearCursor ? 1.2 : 0.7
          ctx.stroke()
        }
      }

      particles.forEach((p, i) => {
        const near =
          mouse.active ? Math.max(0, 1 - Math.hypot(p.x - mouse.x, p.y - mouse.y) / 160) : 0
        const rgb = colors[i % colors.length]
        const alpha = 0.2 + near * 0.55
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb}, ${alpha})`
        ctx.fill()
        if (near > 0.35) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${rgb}, ${near * 0.12})`
          ctx.fill()
        }
      })

      if (mouse.active) {
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 90)
        g.addColorStop(0, 'rgba(255,255,255,0.35)')
        g.addColorStop(0.35, 'rgba(167,139,250,0.16)')
        g.addColorStop(1, 'rgba(167,139,250,0)')
        ctx.beginPath()
        ctx.fillStyle = g
        ctx.arc(mouse.x, mouse.y, 90, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="scanny-cursor-field"
    />
  )
}
