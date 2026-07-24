/** Orange fork / knife / spoon loader for the customer menu boot. */
export function UtensilLoader({ size = 58 }: { size?: number }) {
  return (
    <div
      className="cm-utensil-loader"
      role="status"
      aria-live="polite"
      aria-label="Preparing menu"
      style={{ ['--cm-utensil-size' as string]: `${size}px` }}
    >
      <span className="sr-only">Preparing menu</span>

      {/* Fork */}
      <svg className="cm-utensil cm-utensil-fork" viewBox="0 0 32 64" fill="none" aria-hidden="true">
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

      {/* Knife */}
      <svg className="cm-utensil cm-utensil-knife" viewBox="0 0 32 64" fill="none" aria-hidden="true">
        <path
          d="M11 8c9 6 12 16 12 24H11V8Z"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <path d="M11 32v26" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      </svg>

      {/* Spoon */}
      <svg className="cm-utensil cm-utensil-spoon" viewBox="0 0 32 64" fill="none" aria-hidden="true">
        <ellipse cx="16" cy="14" rx="8" ry="10" stroke="currentColor" strokeWidth="2.6" />
        <path d="M16 24v34" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export default UtensilLoader
