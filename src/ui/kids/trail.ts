import type { SessionTimeline } from '../../domain/types.ts'

export interface Point {
  x: number
  y: number
}

export const CANVAS_WIDTH = 1024
export const CANVAS_HEIGHT = 640

const MINUTE_MS = 60_000

type Bezier = readonly [Point, Point, Point, Point]

// The timeline trail of children-session.html: M40 62 C200 40 330 82 480 58 S720 40 800 56 C920 72 970 150 970 318,
// with the smooth segment's first control point mirrored.
const SEGMENTS: readonly Bezier[] = [
  [{ x: 40, y: 62 }, { x: 200, y: 40 }, { x: 330, y: 82 }, { x: 480, y: 58 }],
  [{ x: 480, y: 58 }, { x: 630, y: 34 }, { x: 720, y: 40 }, { x: 800, y: 56 }],
  [{ x: 800, y: 56 }, { x: 920, y: 72 }, { x: 970, y: 150 }, { x: 970, y: 318 }],
]

const STEPS_PER_SEGMENT = 80

function bezierAt([p0, p1, p2, p3]: Bezier, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

interface Sample extends Point {
  /** Distance along the trail from its start. */
  length: number
}

const SAMPLES: readonly Sample[] = (() => {
  const samples: Sample[] = []
  for (const segment of SEGMENTS) {
    for (let step = samples.length === 0 ? 0 : 1; step <= STEPS_PER_SEGMENT; step++) {
      const point = bezierAt(segment, step / STEPS_PER_SEGMENT)
      const previous = samples.at(-1)
      const length = previous ? previous.length + Math.hypot(point.x - previous.x, point.y - previous.y) : 0
      samples.push({ ...point, length })
    }
  }
  return samples
})()

const TOTAL_LENGTH = SAMPLES.at(-1)!.length

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)

/** The point `fraction` (0 to 1) of the way along the trail, by distance. */
export function trailPoint(fraction: number): Point {
  const target = clamp01(fraction) * TOTAL_LENGTH
  let upper = SAMPLES.findIndex((sample) => sample.length >= target)
  if (upper <= 0) upper = 1
  const a = SAMPLES[upper - 1]
  const b = SAMPLES[upper]
  const span = b.length - a.length
  const t = span > 0 ? (target - a.length) / span : 0
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** SVG path data of the trail between two fractions. */
export function trailPath(from: number, to: number): string {
  const start = clamp01(from)
  const end = clamp01(to)
  const points = [trailPoint(start)]
  for (const sample of SAMPLES) {
    const fraction = sample.length / TOTAL_LENGTH
    if (fraction > start && fraction < end) points.push(sample)
  }
  points.push(trailPoint(end))
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
}

/** Fraction of the trail where the nudge flag stands: the nudge time between session start and departure. */
export function nudgeFraction(timeline: Pick<SessionTimeline, 'startAt' | 'nudgeAt' | 'departureAt'>): number {
  const span = timeline.departureAt - timeline.startAt
  return span > 0 ? clamp01((timeline.nudgeAt - timeline.startAt) / span) : 1
}

/** Fraction of the trail the companion has walked: distance left = time left, in whole minutes since the start. */
export function companionFraction(timeline: Pick<SessionTimeline, 'startAt' | 'departureAt' | 'cutoffAt'>, now: number): number {
  const span = timeline.departureAt - timeline.startAt
  if (span <= 0) return 1
  const elapsed = Math.max(0, Math.min(now, timeline.cutoffAt) - timeline.startAt)
  return clamp01((Math.floor(elapsed / MINUTE_MS) * MINUTE_MS) / span)
}

export interface LaneLayout {
  plank: { left: number; top: number }
  /** Size of every stone on the lane as a share of 104 px. */
  scale: number
  /** Top-left of each stone, in snapshot order. */
  stones: { left: number; top: number }[]
}

const STONE_SIZE = 104
const LANE_HEIGHT = 252
const FIRST_PLANK_TOP = 120
const FIRST_STONE_LEFT = 43
const LAST_COMFORTABLE_LEFT = 450
const MIN_STEP = 100
const MAX_STEP = 125
const ZIG = 30
const STONE_CENTRE_OFFSET = 88 + STONE_SIZE / 2

/** The speeltijd rug (DESIGN.md, speeltijd-rug): 150 px square, between the lanes and the departure stones. */
export const RUG = { left: 560, top: 285, size: 150 } as const

/** The right-most x a lane stone may reach: the lane never touches the rug. */
const LANE_RIGHT_LIMIT = 550
/** Stones per lane that fit at full size; above that they shrink. */
export const FULL_SIZE_STONES = 5
/** Stones per lane the layout is made for (two children). Longer lists are not supported until the routine editor caps them. */
export const MAX_LANE_STONES = 8
/** Distance between stone centres along a shrunken lane, as a share of the stone size. */
const SHRUNK_STEP_RATIO = 0.96

/** The size of the lane stones as a share of 104 px: 1 up to five stones, smaller above so the lane stays left of the rug. */
export function laneStoneScale(stoneCount: number): number {
  if (stoneCount <= FULL_SIZE_STONES) return 1
  const room = LANE_RIGHT_LIMIT - FIRST_STONE_LEFT
  return Math.min(1, room / (STONE_SIZE * ((stoneCount - 1) * SHRUNK_STEP_RATIO + 1)))
}

/** Where one child's plank and stones stand: lanes stacked, stones zig-zagging along the lane in order. */
export function laneLayout(laneCount: number, laneIndex: number, stoneCount: number): LaneLayout {
  const height = laneCount <= 2 ? LANE_HEIGHT : Math.floor((CANVAS_HEIGHT - FIRST_PLANK_TOP - 20) / laneCount)
  const plankTop = FIRST_PLANK_TOP + (laneCount === 1 ? 60 : 0) + laneIndex * height
  const scale = laneStoneScale(stoneCount)
  const size = STONE_SIZE * scale
  const step =
    scale < 1
      ? size * SHRUNK_STEP_RATIO
      : stoneCount <= 1
        ? MAX_STEP
        : Math.min(MAX_STEP, Math.max(MIN_STEP, (LAST_COMFORTABLE_LEFT - FIRST_STONE_LEFT) / (stoneCount - 1)))
  return {
    plank: { left: 20, top: plankTop },
    scale,
    stones: Array.from({ length: stoneCount }, (_unused, index) => ({
      left: Math.round(FIRST_STONE_LEFT + index * step),
      // Stone centres stay on the same zig-zag line whatever the size.
      top: Math.round(plankTop + STONE_CENTRE_OFFSET - size / 2 + (index % 2) * ZIG * scale),
    })),
  }
}

/** Where a lane runs into the rug: on its left edge, the lanes spread over the rug's height. */
export function rugEntry(laneCount: number, laneIndex: number): Point {
  return { x: RUG.left + 15, y: RUG.top + (RUG.size * (laneIndex + 1)) / (laneCount + 1) }
}

/** SVG path data through the stone centres of one lane, starting under its plank and ending at `end` (the rug) when given. */
export function lanePath(layout: LaneLayout, end?: Point): string {
  const half = (STONE_SIZE * layout.scale) / 2
  const points: Point[] = [{ x: 40, y: layout.plank.top + 54 }]
  for (const stone of layout.stones) points.push({ x: stone.left + half, y: stone.top + half })
  if (end) points.push(end)
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
}

