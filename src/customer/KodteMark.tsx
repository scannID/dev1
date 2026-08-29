export function KodteMark({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/kodte-icon.svg"
      alt="Koddly"
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
