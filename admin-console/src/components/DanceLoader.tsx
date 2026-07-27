type DanceLoaderProps = {
  label?: string
  size?: number
}

/** Animated dancing figure for admin console boot. */
export function DanceLoader({
  label = 'Opening admin console…',
  size = 120,
}: DanceLoaderProps) {
  return (
    <div
      className="dance-loader"
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{ ['--dance-size' as string]: `${size}px` }}
    >
      <style>{`
        .dance-loader {
          display: grid;
          justify-items: center;
          gap: 18px;
          color: #ea580c;
        }
        .dance-loader-stage {
          position: relative;
          width: var(--dance-size, 120px);
          height: var(--dance-size, 120px);
          display: grid;
          place-items: center;
        }
        .dance-loader-figure {
          width: 72%;
          height: 72%;
          transform-origin: 50% 100%;
          animation: dance-loader-bounce 0.85s ease-in-out infinite;
          will-change: transform;
        }
        .dance-loader-figure svg {
          display: block;
          width: 100%;
          height: 100%;
        }
        .dance-loader-arm-left {
          transform-origin: 22px 30px;
          animation: dance-loader-arm-l 0.85s ease-in-out infinite;
        }
        .dance-loader-arm-right {
          transform-origin: 42px 30px;
          animation: dance-loader-arm-r 0.85s ease-in-out infinite;
        }
        .dance-loader-leg-left {
          transform-origin: 26px 44px;
          animation: dance-loader-leg-l 0.85s ease-in-out infinite;
        }
        .dance-loader-leg-right {
          transform-origin: 38px 44px;
          animation: dance-loader-leg-r 0.85s ease-in-out infinite;
        }
        .dance-loader-shadow {
          position: absolute;
          bottom: 8%;
          left: 50%;
          width: 42%;
          height: 8%;
          border-radius: 50%;
          background: color-mix(in srgb, currentColor 22%, transparent);
          transform: translateX(-50%);
          animation: dance-loader-shadow 0.85s ease-in-out infinite;
        }
        .dance-loader-label {
          margin: 0;
          font-size: 14px;
          font-weight: 500;
          color: var(--muted-foreground, #6b7280);
          letter-spacing: 0.01em;
          animation: dance-loader-fade 1.6s ease-in-out infinite;
        }
        @keyframes dance-loader-bounce {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-4deg); }
          25% { transform: translate3d(-4px, -10px, 0) rotate(3deg); }
          50% { transform: translate3d(0, 0, 0) rotate(4deg); }
          75% { transform: translate3d(4px, -10px, 0) rotate(-3deg); }
        }
        @keyframes dance-loader-arm-l {
          0%, 100% { transform: rotate(-35deg); }
          50% { transform: rotate(40deg); }
        }
        @keyframes dance-loader-arm-r {
          0%, 100% { transform: rotate(40deg); }
          50% { transform: rotate(-35deg); }
        }
        @keyframes dance-loader-leg-l {
          0%, 100% { transform: rotate(18deg); }
          50% { transform: rotate(-22deg); }
        }
        @keyframes dance-loader-leg-r {
          0%, 100% { transform: rotate(-18deg); }
          50% { transform: rotate(22deg); }
        }
        @keyframes dance-loader-shadow {
          0%, 100%, 50% { transform: translateX(-50%) scaleX(1); opacity: 0.55; }
          25%, 75% { transform: translateX(-50%) scaleX(0.7); opacity: 0.3; }
        }
        @keyframes dance-loader-fade {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dance-loader-figure,
          .dance-loader-arm-left,
          .dance-loader-arm-right,
          .dance-loader-leg-left,
          .dance-loader-leg-right,
          .dance-loader-shadow,
          .dance-loader-label {
            animation: none;
          }
        }
      `}</style>

      <div className="dance-loader-stage" aria-hidden="true">
        <div className="dance-loader-figure">
          <svg viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="14" r="7" stroke="currentColor" strokeWidth="3" />
            <path
              d="M32 22v20"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              className="dance-loader-arm-left"
              d="M32 30c-6 2-10 7-12 12"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              className="dance-loader-arm-right"
              d="M32 30c6 2 10 7 12 12"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              className="dance-loader-leg-left"
              d="M32 42c-5 6-7 12-7 16"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              className="dance-loader-leg-right"
              d="M32 42c5 6 7 12 7 16"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="dance-loader-shadow" />
      </div>

      <p className="dance-loader-label">{label}</p>
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default DanceLoader
