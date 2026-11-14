import type { CSSProperties } from 'react'
import { companionPicture, CAR, NUDGE_FLAG, SLEEPING } from './pictures.ts'
import { trailPath, trailPoint, type Point } from './trail.ts'

/** Sand trail with white dots across the top, ending at the car; optionally the gold departure segment. */
export function TrailPaths({ departureFrom }: { departureFrom?: number }) {
  const full = trailPath(0, 1)
  return (
    <>
      <path className="kids-trail" d={full} />
      <path className="kids-trail-dots" d={full} />
      {departureFrom !== undefined && departureFrom < 1 && <path className="kids-trail-departure" d={trailPath(departureFrom, 1)} />}
    </>
  )
}

export function Car() {
  return <span className="kids-car">{CAR}</span>
}

export function NudgeFlag({ fraction }: { fraction: number }) {
  const point = trailPoint(fraction)
  return (
    <span className="kids-flag" style={{ left: point.x, top: Math.max(0, point.y - 58) }}>
      {NUDGE_FLAG}
    </span>
  )
}

/**
 * The companion standing on the trail; `asleep` lays it down with a sleeping mark. With `crossing` it skips in from
 * `from` (an offset from where it stands) to its place at the car, after `delay` seconds, once.
 */
export function Companion({
  companionId,
  fraction,
  asleep,
  crossing,
}: {
  companionId: string
  fraction: number
  asleep?: boolean
  crossing?: { from: Point; delay: number }
}) {
  const point = trailPoint(fraction)
  const className = ['kids-walker', asleep ? 'asleep' : '', crossing ? 'crossing' : ''].filter(Boolean).join(' ')
  const style = {
    left: point.x,
    top: point.y - 48,
    ...(crossing ? { '--from-x': `${crossing.from.x}px`, '--from-y': `${crossing.from.y}px`, '--delay': `${crossing.delay}s` } : {}),
  } as CSSProperties
  return (
    <span className={className} style={style}>
      <span className="kids-walker-animal">{companionPicture(companionId)}</span>
      {asleep && <span className="kids-sleep">{SLEEPING}</span>}
    </span>
  )
}
