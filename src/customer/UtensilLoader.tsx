/** Orange fork / knife / spoon loader for the customer menu boot. */
import { KodteMark } from './KodteMark'

export function UtensilLoader({ size = 58 }: { size?: number }) {
  const markSize = Math.max(36, Math.round(size * 0.9))

  return (
    <div
      className="cm-boot-loader"
      role="status"
      aria-live="polite"
      aria-label="Preparing menu"
      style={{ ['--cm-utensil-size' as string]: `${size}px` }}
    >
      <style>{`
        .cm-boot-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 22px;
        }
        .cm-utensil-loader {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 14px;
          color: #ea580c;
          height: calc(var(--cm-utensil-size, 56px) * 1.2);
        }
        .cm-utensil {
          display: block;
          width: calc(var(--cm-utensil-size, 56px) * 0.42);
          height: var(--cm-utensil-size, 56px);
          transform-origin: 50% 100%;
          will-change: transform;
          animation: cm-utensil-bounce 1.05s ease-in-out infinite;
        }
        .cm-utensil svg {
          display: block;
          width: 100%;
          height: 100%;
        }
        .cm-utensil-fork { animation-delay: 0ms; }
        .cm-utensil-knife { animation-delay: 140ms; }
        .cm-utensil-spoon { animation-delay: 280ms; }
        @keyframes cm-utensil-bounce {
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
      <span className="sr-only">Preparing menu</span>

      <KodteMark size={markSize} />

      <div className="cm-utensil-loader" aria-hidden="true">
        <span className="cm-utensil cm-utensil-fork">
          <svg viewBox="0 0 32 64" fill="none">
            <path
              d="M8 6v14M14 6v16M20 6v14"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path
              d="M8 20c0 4.5 2.6 7 6 7s6-2.5 6-7"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path d="M14 27v31" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
          </svg>
        </span>

        <span className="cm-utensil cm-utensil-knife">
          <svg viewBox="0 0 32 64" fill="none">
            <path
              d="M11 8c9 6 12 16 12 24H11V8Z"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path d="M11 32v26" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
          </svg>
        </span>

        <span className="cm-utensil cm-utensil-spoon">
          <svg viewBox="0 0 32 64" fill="none">
            <ellipse cx="16" cy="14" rx="8" ry="10" stroke="currentColor" strokeWidth="2.6" />
            <path d="M16 24v34" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
          </svg>
        </span>
      </div>
    </div>
  )
}

export default UtensilLoader
