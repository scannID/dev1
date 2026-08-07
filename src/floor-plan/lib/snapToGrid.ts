/** Snap a value to the nearest grid line */
export function snapValue(value: number, gridSize: number): number {
  if (gridSize <= 0) return value
  return Math.round(value / gridSize) * gridSize
}

/** Snap both x and y coordinates */
export function snapPosition(
  x: number,
  y: number,
  gridSize: number
): { x: number; y: number } {
  return {
    x: snapValue(x, gridSize),
    y: snapValue(y, gridSize),
  }
}

/** Snap dimensions to grid multiples */
export function snapSize(
  width: number,
  height: number,
  gridSize: number
): { width: number; height: number } {
  return {
    width: Math.max(gridSize, snapValue(width, gridSize)),
    height: Math.max(gridSize, snapValue(height, gridSize)),
  }
}
