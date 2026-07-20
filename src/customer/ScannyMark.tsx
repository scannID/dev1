export function ScannyMark({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/qrcode1.png"
      alt="Scanny"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.25),
        objectFit: 'cover',
        display: 'block',
        flexShrink: 0,
      }}
    />
  )
}
