/** Radius of the ring around a stone in the 128 px ring box (DESIGN.md, ring-timer: 9 px stroke, 12 px outside the stone). */
export const RING_RADIUS = 58

export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export interface RingDash {
  /** SVG `stroke-dasharray` of the gold arc. */
  dasharray: string
  /** SVG `stroke-dashoffset` of the gold arc. */
  dashoffset: number
}

/**
 * The gold arc of a ring that still has `fractionLeft` (1 to 0) to go. The ring starts at 12 o'clock and runs
 * clockwise; the time that has passed is removed from 12 o'clock clockwise, so the arc left ends at 12 o'clock.
 */
export function ringDash(fractionLeft: number): RingDash {
  const fraction = Number.isFinite(fractionLeft) ? Math.min(1, Math.max(0, fractionLeft)) : 0
  const length = fraction * RING_CIRCUMFERENCE
  return { dasharray: `${length.toFixed(2)} ${RING_CIRCUMFERENCE.toFixed(2)}`, dashoffset: length - RING_CIRCUMFERENCE }
}
