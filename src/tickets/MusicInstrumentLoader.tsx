/** Orange music-instrument loader for event / ticket boot screens. */
import { KodteMark } from '../customer/KodteMark'

export function MusicInstrumentLoader({ size = 58 }: { size?: number }) {
  const markSize = Math.max(36, Math.round(size * 0.9))

  return (
    <div
      className="tk-boot-loader"
      role="status"
      aria-live="polite"
      aria-label="Loading event"
      style={{ ['--tk-music-size' as string]: `${size}px` }}
    >
      <style>{`
        .tk-boot-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 22px;
        }
        .tk-music-loader {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 14px;
          color: #f97316;
          height: calc(var(--tk-music-size, 56px) * 1.2);
        }
        .tk-music-icon {
          display: block;
          width: calc(var(--tk-music-size, 56px) * 0.48);
          height: var(--tk-music-size, 56px);
          transform-origin: 50% 100%;
          will-change: transform;
          animation: tk-music-bounce 1.05s ease-in-out infinite;
        }
        .tk-music-icon svg {
          display: block;
          width: 100%;
          height: 100%;
        }
        .tk-music-note { animation-delay: 0ms; }
        .tk-music-guitar { animation-delay: 140ms; }
        .tk-music-drum { animation-delay: 280ms; }
        @keyframes tk-music-bounce {
          0%, 100% {
            transform: translate3d(0, 0, 0) rotate(0deg);
            opacity: 0.7;
          }
          35% {
            transform: translate3d(0, -12px, 0) rotate(-6deg);
            opacity: 1;
          }
          55% {
            transform: translate3d(0, -4px, 0) rotate(4deg);
            opacity: 1;
          }
        }
      `}</style>
      <span className="sr-only">Loading event</span>

      <KodteMark size={markSize} />

      <div className="tk-music-loader" aria-hidden="true">
        <span className="tk-music-icon tk-music-note">
          <svg viewBox="0 0 40 64" fill="none">
            <path
              d="M28 8v32.5a9 9 0 1 1-4.5-7.8V16.5L14 20v24a9 9 0 1 1-4.5-7.8V16.2L28 8Z"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <span className="tk-music-icon tk-music-guitar">
          <svg viewBox="0 0 40 64" fill="none">
            <path d="M20 6v22" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M16 10h8M15 14h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path
              d="M12 34c-5 2-8 7-8 12 0 7 6 12 14 12h4c8 0 14-5 14-12 0-5-3-10-8-12-2 4-6 6-10 6s-8-2-10-6Z"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <circle cx="20" cy="46" r="4" stroke="currentColor" strokeWidth="2.4" />
          </svg>
        </span>

        <span className="tk-music-icon tk-music-drum">
          <svg viewBox="0 0 40 64" fill="none">
            <ellipse cx="20" cy="28" rx="14" ry="6" stroke="currentColor" strokeWidth="2.6" />
            <path
              d="M6 28v18c0 4 6 8 14 8s14-4 14-8V28"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path d="M6 38h28M6 46h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path
              d="M10 18l6 8M30 16l-7 10"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </div>
    </div>
  )
}

export default MusicInstrumentLoader
