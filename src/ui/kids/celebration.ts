import type { Cue } from '../../domain/types.ts'
import { trailPoint, type Point } from './trail.ts'

/** The team-goal celebration animates only when its cue is younger than this (AD-16 rule, applied to the picture). */
export const CELEBRATION_FRESH_MS = 6000

/** True for a cue that became due at `cueAt`, less than six seconds before `now`; a cue from the future is not fresh. */
export function isCelebrationFresh(cueAt: number, now: number): boolean {
  const age = now - cueAt
  return age >= 0 && age < CELEBRATION_FRESH_MS
}

/** The most recent `teamGoal` cue; each time the bridge is completed again it has a new id. */
export function latestTeamGoal(cues: readonly Cue[]): Cue | undefined {
  return cues.filter((cue) => cue.kind === 'teamGoal').at(-1)
}

export interface CelebrationDecision {
  id: string
  animate: boolean
}

/**
 * The celebration decision for the current team-goal cue: none without a goal; kept while the cue id stays the same
 * (a later render never replays it); decided afresh for a new id, which animates only when that cue is fresh.
 */
export function nextCelebration(
  previous: CelebrationDecision | null,
  goal: Pick<Cue, 'id' | 'at'> | undefined,
  now: number,
): CelebrationDecision | null {
  if (!goal) return null
  if (previous?.id === goal.id) return previous
  return { id: goal.id, animate: isCelebrationFresh(goal.at, now) }
}

export interface Crosser {
  /** Where the crosser stands once it has crossed: at the car. */
  to: Point
  /** Offset from `to` where it starts, by the departure stones. */
  from: Point
  /** Seconds before it starts, so they skip across one after another. */
  delay: number
}

const START = { x: 800, y: 385 }
const CHILD_ROW = { left: 922, top: 398, gap: 54 }
const DELAY_STEP = 0.45

/** The companion and each child, in the order they cross: the companion stands at the end of the trail, children below the car. */
export function crossers(childCount: number): { companion: Crosser; children: Crosser[] } {
  const end = trailPoint(1)
  const companionTo = { x: end.x, y: end.y - 48 }
  const offset = (to: Point): Point => ({ x: START.x - to.x, y: START.y - to.y })
  const children = Array.from({ length: childCount }, (_unused, index): Crosser => {
    const to = { x: CHILD_ROW.left + index * CHILD_ROW.gap, y: CHILD_ROW.top }
    return { to, from: offset(to), delay: (index + 1) * DELAY_STEP }
  })
  return { companion: { to: companionTo, from: offset(companionTo), delay: 0 }, children }
}
