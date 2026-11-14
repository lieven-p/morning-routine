import { describe, expect, it } from 'vitest'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  companionFraction,
  laneLayout,
  lanePath,
  laneStoneScale,
  MAX_LANE_STONES,
  nudgeFraction,
  rugEntry,
  RUG,
  trailPath,
  trailPoint,
} from './trail.ts'

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

  it('ends the lane on the rug when given its entry', () => {
    const layout = laneLayout(2, 0, 2)
    const entry = rugEntry(2, 0)
    expect(lanePath(layout, entry).endsWith(`L${entry.x} ${entry.y}`)).toBe(true)
  })
})

describe('lane capacity', () => {
  const RUG_LEFT = RUG.left

  it('keeps full-size stones up to five and shrinks above', () => {
    for (const count of [0, 1, 2, 3, 4, 5]) expect(laneStoneScale(count)).toBe(1)
    expect(laneStoneScale(6)).toBeLessThan(1)
    for (let count = 6; count <= MAX_LANE_STONES; count++) {
      expect(laneStoneScale(count + 1)).toBeLessThan(laneStoneScale(count))
    }
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('fits %i stones left of the rug without overlap', (count) => {
    for (const laneIndex of [0, 1]) {
      const layout = laneLayout(2, laneIndex, count)
      const size = 104 * layout.scale
      expect(layout.stones).toHaveLength(count)
      for (const stone of layout.stones) {
        expect(stone.left).toBeGreaterThanOrEqual(43)
        expect(stone.left + size).toBeLessThan(RUG_LEFT)
      }
      for (let index = 1; index < count; index++) {
        const a = layout.stones[index - 1]
        const b = layout.stones[index]
        expect(Math.hypot(b.left - a.left, b.top - a.top)).toBeGreaterThanOrEqual(size - 1)
      }
    }
  })

  it('keeps every stone of two lanes of eight inside the canvas and the lanes apart', () => {
    const first = laneLayout(2, 0, MAX_LANE_STONES)
    const second = laneLayout(2, 1, MAX_LANE_STONES)
    const size = 104 * first.scale
    const lowestFirst = Math.max(...first.stones.map((stone) => stone.top + size))
    const highestSecond = Math.min(...second.stones.map((stone) => stone.top))
    expect(lowestFirst).toBeLessThan(highestSecond)
    expect(Math.max(...second.stones.map((stone) => stone.top + size))).toBeLessThan(CANVAS_HEIGHT)
  })

  it('keeps hit areas at 48 CSS px: the smallest stone is not below 48 px at the 800 x 600 scale', () => {
    const scale = 800 / CANVAS_WIDTH
    expect(104 * laneStoneScale(MAX_LANE_STONES) * scale).toBeGreaterThanOrEqual(48)
  })

  it('shrinks the stones about the same centre line as full-size ones', () => {
    const full = laneLayout(2, 0, 5)
    const small = laneLayout(2, 0, 8)
    const centreY = (layout: typeof full, index: number) => layout.stones[index].top + (104 * layout.scale) / 2
    expect(Math.abs(centreY(small, 0) - centreY(full, 0))).toBeLessThanOrEqual(1)
  })
})

describe('rugEntry', () => {
  it('lets each lane run into the left edge of the rug at its own height', () => {
    const first = rugEntry(2, 0)
    const second = rugEntry(2, 1)
    expect(first.x).toBeGreaterThan(RUG.left)
    expect(first.y).toBeGreaterThan(RUG.top)
    expect(second.y).toBeGreaterThan(first.y)
    expect(second.y).toBeLessThan(RUG.top + RUG.size)
  })
})
