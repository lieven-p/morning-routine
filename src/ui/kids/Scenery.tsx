import { companionPicture, CAR, NUDGE_FLAG, SLEEPING } from './pictures.ts'
import { trailPath, trailPoint } from './trail.ts'

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

/** The companion standing on the trail; `asleep` lays it down with a sleeping mark. */
export function Companion({ companionId, fraction, asleep }: { companionId: string; fraction: number; asleep?: boolean }) {
  const point = trailPoint(fraction)
  return (
    <span className={asleep ? 'kids-walker asleep' : 'kids-walker'} style={{ left: point.x, top: point.y - 48 }}>
      <span className="kids-walker-animal">{companionPicture(companionId)}</span>
      {asleep && <span className="kids-sleep">{SLEEPING}</span>}
    </span>
  )
}
