import { useState } from 'react'
import type { SessionView } from '../../domain/types.ts'
import { useAppServices } from '../app-context.ts'
import { latestTeamGoal, nextCelebration, type CelebrationDecision } from './celebration.ts'

/**
 * Whether the bridge celebration should animate now. It does once per completion, when the `teamGoal` cue is fresh
 * the first time the screen sees it. A reload or a later render shows the finished bridge without replay; completing
 * the bridge again after an undo is a new cue and celebrates again. The decision is kept, so the page staying open
 * never replays it and a fast development clock never makes the cue look old between two renders.
 */
export function useCelebration(view: Pick<SessionView, 'bridge' | 'cues'>): boolean {
  const { clock } = useAppServices()
  const goal = view.bridge.complete ? latestTeamGoal(view.cues) : undefined
  const [decision, setDecision] = useState<CelebrationDecision | null>(null)

  const next = nextCelebration(decision, goal, clock.now())
  if (next !== decision) setDecision(next)
  return next?.animate ?? false
}
