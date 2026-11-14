import { describe, expect, it } from 'vitest'
import { companionFraction, laneLayout, lanePath, nudgeFraction, trailPath, trailPoint } from './trail.ts'

const MINUTE = 60_000
const timeline = { startAt: 1_000_000, departureAt: 1_000_000 + 50 * MINUTE, cutoffAt: 1_000_000 + 50 * MINUTE }

describe('trailPoint', () => {
  it('starts at the left end and finishes at the car end', () => {
    expect(trailPoint(0)).toEqual({ x: 40, y: 62 })
    const end = trailPoint(1)
    expect(end.x).toBeCloseTo(970, 5)
    expect(end.y).toBeCloseTo(318, 5)
  })

  it('moves forward along the trail and clamps outside 0 to 1', () => {
    const xs = [0, 0.25, 0.5, 0.75, 0.9].map((fraction) => trailPoint(fraction).x)
    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
    expect(trailPoint(-1)).toEqual(trailPoint(0))
    expect(trailPoint(2)).toEqual(trailPoint(1))
    expect(trailPoint(Number.NaN)).toEqual(trailPoint(0))
  })
})

describe('trailPath', () => {
  it('is a polyline between the two fractions', () => {
    const path = trailPath(0.9, 1)
    expect(path.startsWith('M')).toBe(true)
    expect(path).toContain('L')
    expect(trailPath(0.5, 0.5).split('L')).toHaveLength(2)
  })
})

describe('companionFraction', () => {
  it('steps once a minute, rounded down to the whole minute', () => {
    expect(companionFraction(timeline, timeline.startAt)).toBe(0)
    expect(companionFraction(timeline, timeline.startAt + 59_999)).toBe(0)
    expect(companionFraction(timeline, timeline.startAt + MINUTE)).toBeCloseTo(1 / 50)
    expect(companionFraction(timeline, timeline.startAt + 25 * MINUTE + 30_000)).toBeCloseTo(0.5)
  })

  it('stays at the start before it and at the car from the departure on', () => {
    expect(companionFraction(timeline, timeline.startAt - 10 * MINUTE)).toBe(0)
    expect(companionFraction(timeline, timeline.departureAt)).toBe(1)
    expect(companionFraction(timeline, timeline.departureAt + 10 * MINUTE)).toBe(1)
  })

  it('stops at an early cutoff', () => {
    const early = { ...timeline, cutoffAt: timeline.startAt + 10 * MINUTE }
    expect(companionFraction(early, timeline.startAt + 30 * MINUTE)).toBeCloseTo(10 / 50)
  })
})

describe('nudgeFraction', () => {
  it('places the nudge between start and departure', () => {
    expect(nudgeFraction({ ...timeline, nudgeAt: timeline.startAt + 45 * MINUTE })).toBeCloseTo(0.9)
    expect(nudgeFraction({ ...timeline, nudgeAt: timeline.startAt })).toBe(0)
    expect(nudgeFraction({ ...timeline, nudgeAt: timeline.departureAt })).toBe(1)
  })
})

describe('laneLayout', () => {
  it('stacks two lanes and zig-zags the stones in order', () => {
    const first = laneLayout(2, 0, 4)
    const second = laneLayout(2, 1, 2)
    expect(second.plank.top).toBeGreaterThan(first.plank.top)
    expect(first.stones.map((stone) => stone.left)).toEqual([43, 168, 293, 418])
    expect(first.stones[1].top - first.stones[0].top).toBe(30)
    expect(first.stones[2].top).toBe(first.stones[0].top)
  })

  it('keeps stones from overlapping with five on a lane', () => {
    const { stones } = laneLayout(2, 0, 5)
    for (let index = 1; index < stones.length; index++) {
      const distance = Math.hypot(stones[index].left - stones[index - 1].left, stones[index].top - stones[index - 1].top)
      expect(distance).toBeGreaterThanOrEqual(104)
    }
  })

  it('handles no stones and one lane', () => {
    expect(laneLayout(1, 0, 0).stones).toEqual([])
    expect(laneLayout(1, 0, 1).stones).toHaveLength(1)
  })

  it('draws the lane through the stone centres', () => {
    const layout = laneLayout(2, 0, 2)
    expect(lanePath(layout)).toBe(
      `M40 ${layout.plank.top + 54} L${layout.stones[0].left + 52} ${layout.stones[0].top + 52} L${layout.stones[1].left + 52} ${layout.stones[1].top + 52}`,
    )
  })
})
