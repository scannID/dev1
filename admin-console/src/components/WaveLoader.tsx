type WaveLoaderProps = {
  label?: string
  size?: number
}

/** Animated waving hand for sign-out / goodbye transitions. */
export function WaveLoader({
  label = 'Signing you out…',
  size = 88,
}: WaveLoaderProps) {
  return (
    <div
      className="wave-loader"
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{ ['--wave-size' as string]: `${size}px` }}
    >
      <style>{`
        .wave-loader {
          display: grid;
          justify-items: center;
          gap: 16px;
          color: #ea580c;
        }
        .wave-loader-hand {
          width: var(--wave-size, 88px);
          height: var(--wave-size, 88px);
          transform-origin: 70% 70%;
          animation: wave-loader-wave 1.1s ease-in-out infinite;
          will-change: transform;
        }
        .wave-loader-hand svg {
          display: block;
          width: 100%;
          height: 100%;
        }
        .wave-loader-label {
          margin: 0;
          font-size: 14px;
          font-weight: 500;
          color: var(--muted-foreground, #6b7280);
          letter-spacing: 0.01em;
        }
        @keyframes wave-loader-wave {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(18deg); }
          30% { transform: rotate(-12deg); }
          45% { transform: rotate(16deg); }
          60% { transform: rotate(-8deg); }
          75% { transform: rotate(10deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .wave-loader-hand { animation: none; }
        }
      `}</style>

      <div className="wave-loader-hand" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none">
          <path
            d="M22 36V18.5a3.5 3.5 0 0 1 7 0V34"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M29 34V14.5a3.5 3.5 0 0 1 7 0V34"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M36 34V16.5a3.5 3.5 0 0 1 7 0V36"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M43 36.5V24.5a3.5 3.5 0 0 1 7 0v14c0 9.5-7 16.5-17.5 16.5S15 48 15 38.5V31a3.5 3.5 0 0 1 7 0v5"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="wave-loader-label">{label}</p>
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default WaveLoader
