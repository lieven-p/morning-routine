import { deriveSession } from '../domain/derive-session.ts'
import { buildSnapshot } from '../domain/build-snapshot.ts'
import { localDateString } from '../domain/dates.ts'
import { isCompanionId } from './companions.ts'
import { hasGuideTime } from './guide-time.ts'
import { hasDepartedTap, startablePlan } from './kids-screen.ts'
import { loadKidsData } from './load-kids-data.ts'
import type { Clock, Repository } from './ports.ts'

/** The only writes KidsShell may issue (AD-10). Each drops silently when it does not apply (AD-15). */
export interface SessionCommands {
  startSession(companionId: string): Promise<void>
  tickStone(stoneId: string): Promise<void>
  untickStone(stoneId: string): Promise<void>
  /** Starts the ring timer of a not-done stone that has a guide time and no timer yet. */
  startTimer(stoneId: string): Promise<void>
  /** Stores the parent's "We zijn vertrokken", once per date, also after the cutoff. */
  departed(): Promise<void>
}

export function createSessionCommands(repository: Repository, clock: Clock): SessionCommands {
  // Commands read, decide and write; running them one after another keeps a double tap from writing twice.
  let queue: Promise<void> = Promise.resolve()
  const serial = (command: () => Promise<void>): Promise<void> => {
    const result = queue.then(command)
    queue = result.catch(() => undefined)
    return result
  }

  const startSession = async (companionId: string): Promise<void> => {
    if (!isCompanionId(companionId)) return
    const now = clock.now()
    const data = await loadKidsData(repository, localDateString(now))
    const plan = startablePlan(data, now)
    if (!plan) return
    await repository.startSession(buildSnapshot(plan, data.children), companionId, now)
  }

  // The stone's state in a running session today, or null when there is no session, the cutoff has passed or the stone is unknown.
  const runningStone = async (stoneId: string) => {
    const now = clock.now()
    const date = localDateString(now)
    const snapshot = await repository.getSnapshot(date)
    if (!snapshot) return null
    const view = deriveSession(snapshot, await repository.listEvents(date), now)
    if (view.phase !== 'running' && view.phase !== 'departure') return null
    const state = [...view.children.flatMap((lane) => lane.stones), ...view.departureStones].find(
      (candidate) => candidate.stone.stoneId === stoneId,
    )
    return state ? { state, date, now } : null
  }

  const changeStone = async (stoneId: string, kind: 'taskTicked' | 'taskUnticked'): Promise<void> => {
    const found = await runningStone(stoneId)
    if (!found) return
    const isDone = found.state.status === 'done'
    if (kind === 'taskTicked' ? isDone : !isDone) return
    await repository.appendEvent({ kind, date: found.date, at: found.now, stoneId })
  }

  const startTimer = async (stoneId: string): Promise<void> => {
    const found = await runningStone(stoneId)
    if (!found) return
    // `notStarted` on a stone that has a guide time means: not done and no timer yet. Departure stones have no ring.
    const { stone, status } = found.state
    if (status !== 'notStarted' || stone.owner.kind === 'departure' || !hasGuideTime(stone)) return
    await repository.appendEvent({ kind: 'timerStarted', date: found.date, at: found.now, stoneId })
  }

  // No cutoff check: a tap after the departure is stored too, the derived view ignores it (AD-15).
  const departed = async (): Promise<void> => {
    const now = clock.now()
    const date = localDateString(now)
    if (!(await repository.getSnapshot(date))) return
    const events = await repository.listEvents(date)
    if (hasDepartedTap(events)) return
    await repository.appendEvent({ kind: 'departedTapped', date, at: now })
  }

  return {
    startSession: (companionId) => serial(() => startSession(companionId)),
    tickStone: (stoneId) => serial(() => changeStone(stoneId, 'taskTicked')),
    untickStone: (stoneId) => serial(() => changeStone(stoneId, 'taskUnticked')),
    startTimer: (stoneId) => serial(() => startTimer(stoneId)),
    departed: () => serial(departed),
  }
}
