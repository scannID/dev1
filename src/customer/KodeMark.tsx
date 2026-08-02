export function KodeMark({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/kode-icon.svg"
      alt="Kode"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
      }}
    />
  )
}
