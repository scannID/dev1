type BookLoaderProps = {
  label?: string
  size?: number
}

/** Calm book-opening loader for the merchant portal boot. */
export function BookLoader({
  label = 'Opening your portal…',
  size = 132,
}: BookLoaderProps) {
  return (
    <div
      className="book-loader"
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{ ['--book-size' as string]: `${size}px` }}
    >
      <div className="book-loader-stage" aria-hidden="true">
        <div className="book-loader-book">
          <div className="book-loader-cover book-loader-cover-left" />
          <div className="book-loader-spine" />
          <div className="book-loader-cover book-loader-cover-right" />

          <div className="book-loader-page book-loader-page-1" />
          <div className="book-loader-page book-loader-page-2" />
          <div className="book-loader-page book-loader-page-3" />
          <div className="book-loader-page book-loader-page-4" />
        </div>
        <div className="book-loader-shadow" />
      </div>

      <p className="book-loader-label">{label}</p>
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default BookLoader
