/**
 * Inline SVG data URLs for each element kind.
 * These are rendered as Konva Image nodes on the canvas so staff
 * can instantly recognise furniture without reading labels.
 *
 * Each SVG is designed on a 100×100 viewBox and will be scaled
 * to match the element's width/height at render time.
 */

import type { ElementKind } from '../../api/floorPlan'

// Cache of HTMLImageElement objects so we don't re-parse SVG every frame
const _cache: Partial<Record<ElementKind, HTMLImageElement>> = {}

const SVGS: Partial<Record<ElementKind, string>> = {

  TABLE: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
    <rect x="4" y="14" width="92" height="42" rx="6" fill="#d4a373" stroke="#a0785a" stroke-width="2.5"/>
    <rect x="8" y="18" width="84" height="34" rx="4" fill="#e8c99a" opacity="0.5"/>
    <rect x="10" y="4" width="8" height="14" rx="3" fill="#a0785a"/>
    <rect x="82" y="4" width="8" height="14" rx="3" fill="#a0785a"/>
    <rect x="10" y="52" width="8" height="14" rx="3" fill="#a0785a"/>
    <rect x="82" y="52" width="8" height="14" rx="3" fill="#a0785a"/>
  </svg>`,

  CHAIR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">
    <circle cx="30" cy="30" r="26" fill="#b5838d" stroke="#8b5e66" stroke-width="2"/>
    <circle cx="30" cy="30" r="18" fill="#d4a5ad" opacity="0.6"/>
    <rect x="22" y="22" width="16" height="16" rx="3" fill="#8b5e66" opacity="0.4"/>
  </svg>`,

  BAR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 50">
    <rect x="2" y="8" width="156" height="34" rx="5" fill="#6b4226" stroke="#4a2d18" stroke-width="2"/>
    <rect x="2" y="8" width="156" height="12" rx="5" fill="#8b5e3a"/>
    <line x1="30" y1="8" x2="30" y2="42" stroke="#4a2d18" stroke-width="1.5" opacity="0.5"/>
    <line x1="60" y1="8" x2="60" y2="42" stroke="#4a2d18" stroke-width="1.5" opacity="0.5"/>
    <line x1="90" y1="8" x2="90" y2="42" stroke="#4a2d18" stroke-width="1.5" opacity="0.5"/>
    <line x1="120" y1="8" x2="120" y2="42" stroke="#4a2d18" stroke-width="1.5" opacity="0.5"/>
    <circle cx="30" cy="4" r="3" fill="#c9a96e"/>
    <circle cx="60" cy="4" r="3" fill="#c9a96e"/>
    <circle cx="90" cy="4" r="3" fill="#c9a96e"/>
    <circle cx="120" cy="4" r="3" fill="#c9a96e"/>
  </svg>`,

  WALL: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 20">
    <rect x="0" y="0" width="160" height="20" fill="#9ca3af"/>
    <rect x="2" y="2" width="36" height="7" rx="1" fill="#d1d5db" opacity="0.5"/>
    <rect x="42" y="11" width="36" height="7" rx="1" fill="#d1d5db" opacity="0.5"/>
    <rect x="82" y="2" width="36" height="7" rx="1" fill="#d1d5db" opacity="0.5"/>
    <rect x="122" y="11" width="36" height="7" rx="1" fill="#d1d5db" opacity="0.5"/>
  </svg>`,

  DOOR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 80">
    <rect x="4" y="4" width="42" height="72" rx="3" fill="#93c5fd" stroke="#60a5fa" stroke-width="2"/>
    <rect x="8" y="8" width="34" height="64" rx="2" fill="#bfdbfe" opacity="0.7"/>
    <circle cx="38" cy="40" r="3.5" fill="#2563eb"/>
    <path d="M 46 4 A 42 72 0 0 1 46 76" fill="none" stroke="#93c5fd" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7"/>
  </svg>`,

  WINDOW: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 16">
    <rect x="0" y="3" width="80" height="10" rx="2" fill="#93c5fd" stroke="#60a5fa" stroke-width="1.5"/>
    <line x1="40" y1="3" x2="40" y2="13" stroke="#60a5fa" stroke-width="1.5"/>
    <line x1="0" y1="8" x2="80" y2="8" stroke="#60a5fa" stroke-width="1" opacity="0.5"/>
  </svg>`,

  STAGE: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
    <rect x="2" y="2" width="196" height="96" rx="4" fill="#fbbf24" stroke="#d97706" stroke-width="2"/>
    <rect x="2" y="2" width="196" height="20" rx="4" fill="#f59e0b"/>
    <circle cx="100" cy="60" r="18" fill="#fde68a" stroke="#f59e0b" stroke-width="2"/>
    <polygon points="100,46 107,62 122,62 110,71 115,87 100,78 85,87 90,71 78,62 93,62" fill="#f59e0b"/>
    <rect x="16" y="82" width="8" height="14" rx="2" fill="#d97706"/>
    <rect x="176" y="82" width="8" height="14" rx="2" fill="#d97706"/>
  </svg>`,

  PLANT: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
    <circle cx="25" cy="25" r="22" fill="#4ade80" stroke="#22c55e" stroke-width="2"/>
    <circle cx="18" cy="20" r="9" fill="#86efac" opacity="0.7"/>
    <circle cx="32" cy="18" r="8" fill="#86efac" opacity="0.7"/>
    <circle cx="25" cy="32" r="9" fill="#22c55e" opacity="0.6"/>
    <rect x="22" y="36" width="6" height="10" rx="2" fill="#92400e"/>
  </svg>`,

  DECOR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
    <rect x="5" y="5" width="40" height="40" rx="4" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2"/>
    <circle cx="25" cy="25" r="12" fill="#e5e7eb" stroke="#9ca3af" stroke-width="1.5"/>
    <circle cx="25" cy="25" r="5" fill="#9ca3af"/>
  </svg>`,

  HOTEL_ROOM: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90">
    <rect x="2" y="2" width="116" height="86" rx="5" fill="#a5b4fc" stroke="#818cf8" stroke-width="2"/>
    <rect x="10" y="30" width="50" height="44" rx="4" fill="#c7d2fe" stroke="#818cf8" stroke-width="1.5"/>
    <rect x="12" y="32" width="46" height="18" rx="3" fill="#e0e7ff"/>
    <rect x="10" y="30" width="24" height="44" rx="2" fill="#a5b4fc" opacity="0.5"/>
    <rect x="70" y="50" width="40" height="24" rx="3" fill="#c7d2fe" stroke="#818cf8" stroke-width="1.5"/>
    <rect x="12" y="10" width="96" height="16" rx="3" fill="#818cf8" opacity="0.3"/>
    <rect x="18" y="13" width="20" height="10" rx="2" fill="#6366f1" opacity="0.5"/>
  </svg>`,

  ZONE: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150">
    <rect x="4" y="4" width="192" height="142" rx="8" fill="#e0f2fe" stroke="#7dd3fc" stroke-width="2" stroke-dasharray="10 5"/>
  </svg>`,

  LABEL: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 30">
    <rect x="1" y="1" width="78" height="28" rx="4" fill="#f9fafb" stroke="#e5e7eb" stroke-width="1.5"/>
    <line x1="8" y1="10" x2="72" y2="10" stroke="#9ca3af" stroke-width="2" stroke-linecap="round"/>
    <line x1="8" y1="18" x2="52" y2="18" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
}

function svgToDataUrl(svg: string): string {
  const encoded = btoa(unescape(encodeURIComponent(svg)))
  return `data:image/svg+xml;base64,${encoded}`
}

export function getIconImage(kind: ElementKind): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    if (_cache[kind]) {
      resolve(_cache[kind]!)
      return
    }
    const svg = SVGS[kind]
    if (!svg) {
      // Return a transparent 1×1 placeholder
      const img = new Image(1, 1)
      resolve(img)
      return
    }
    const img = new Image()
    img.onload = () => {
      _cache[kind] = img
      resolve(img)
    }
    img.onerror = () => resolve(new Image(1, 1))
    img.src = svgToDataUrl(svg)
  })
}
