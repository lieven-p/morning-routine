import { ringDash, RING_RADIUS } from './ring.ts'

interface RingTimerProps {
  /** Time still to go, 1 (full) to 0. */
  fractionLeft: number
  /** Not started: the ring is full and pale. */
  idle: boolean
}

/** The ring around a timed stone: a gold arc emptying clockwise from 12 o'clock over a white track (DESIGN.md, ring-timer). */
export function RingTimer({ fractionLeft, idle }: RingTimerProps) {
  const dash = ringDash(fractionLeft)
  return (
    <svg className={idle ? 'kids-ring idle' : 'kids-ring'} viewBox="0 0 128 128" aria-hidden="true">
      <circle className="kids-ring-track" cx="64" cy="64" r={RING_RADIUS} />
      <circle
        className="kids-ring-arc"
        cx="64"
        cy="64"
        r={RING_RADIUS}
        strokeDasharray={dash.dasharray}
        strokeDashoffset={dash.dashoffset}
      />
    </svg>
  )
}
