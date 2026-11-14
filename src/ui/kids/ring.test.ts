import { describe, expect, it } from 'vitest'
import { RING_CIRCUMFERENCE, ringDash } from './ring.ts'

const length = (fraction: number) => Number(ringDash(fraction).dasharray.split(' ')[0])

describe('ringDash', () => {
  it('shows the full ring at fraction 1 and nothing at 0', () => {
    expect(length(1)).toBeCloseTo(RING_CIRCUMFERENCE, 1)
    expect(ringDash(1).dashoffset).toBe(0)
    expect(length(0)).toBe(0)
  })

  it('keeps the arc proportional to the time left', () => {
    expect(length(0.5)).toBeCloseTo(RING_CIRCUMFERENCE / 2, 1)
    expect(length(0.25)).toBeCloseTo(RING_CIRCUMFERENCE / 4, 1)
  })

  it('removes the passed time from 12 o clock clockwise, so the arc left always ends at 12 o clock', () => {
    for (const fraction of [1, 0.75, 0.5, 0.1]) {
      const { dashoffset } = ringDash(fraction)
      // The arc covers path positions [start, start + length) with start = -dashoffset; it ends at the full circle.
      expect(-dashoffset + length(fraction)).toBeCloseTo(RING_CIRCUMFERENCE, 1)
    }
  })

  it('shrinks as time passes', () => {
    expect(length(0.4)).toBeLessThan(length(0.6))
    expect(-ringDash(0.4).dashoffset).toBeGreaterThan(-ringDash(0.6).dashoffset)
  })

  it('clamps and tolerates bad input', () => {
    expect(length(2)).toBeCloseTo(RING_CIRCUMFERENCE, 1)
    expect(length(-1)).toBe(0)
    expect(length(Number.NaN)).toBe(0)
  })
})
