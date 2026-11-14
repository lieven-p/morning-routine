import { deriveSession } from '../domain/derive-session.ts'
import { buildSnapshot } from '../domain/build-snapshot.ts'
import { localDateString } from '../domain/dates.ts'
import { isCompanionId } from './companions.ts'
import { startablePlan } from './kids-screen.ts'
import { loadKidsData } from './load-kids-data.ts'
import type { Clock, Repository } from './ports.ts'

/** The only writes KidsShell may issue (AD-10). Each drops silently when it does not apply (AD-15). */
export interface SessionCommands {
  startSession(companionId: string): Promise<void>
  tickStone(stoneId: string): Promise<void>
  untickStone(stoneId: string): Promise<void>
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

  const changeStone = async (stoneId: string, kind: 'taskTicked' | 'taskUnticked'): Promise<void> => {
    const now = clock.now()
    const date = localDateString(now)
    const snapshot = await repository.getSnapshot(date)
    if (!snapshot) return
    const view = deriveSession(snapshot, await repository.listEvents(date), now)
    if (view.phase !== 'running' && view.phase !== 'departure') return
    const state = [...view.children.flatMap((lane) => lane.stones), ...view.departureStones].find(
      (candidate) => candidate.stone.stoneId === stoneId,
    )
    if (!state) return
    const isDone = state.status === 'done'
    if (kind === 'taskTicked' ? isDone : !isDone) return
    await repository.appendEvent({ kind, date, at: now, stoneId })
  }

  return {
    startSession: (companionId) => serial(() => startSession(companionId)),
    tickStone: (stoneId) => serial(() => changeStone(stoneId, 'taskTicked')),
    untickStone: (stoneId) => serial(() => changeStone(stoneId, 'taskUnticked')),
  }
}
