import { localTimeMs } from './dates.ts'
import type {
  Bridge,
  ChildLane,
  Cue,
  DaySnapshot,
  SessionEvent,
  SessionPhase,
  SessionView,
  Speeltijd,
  Stone,
  StoneState,
} from './types.ts'

const MINUTE_MS = 60_000

interface StoneProgress {
  doneAt: number | null
  timerStartedAt: number | null
}

/** True when a stone has a usable guide time: finite and above zero. The one rule for task timers (UI, commands, derivation). */
export function hasGuideTime(stone: Pick<Stone, 'guideMinutes'>): boolean {
  const minutes = stone.guideMinutes
  return minutes !== undefined && Number.isFinite(minutes) && minutes > 0
}

function guideMs(stone: Stone): number {
  return hasGuideTime(stone) ? stone.guideMinutes! * MINUTE_MS : 0
}

function stoneState(stone: Stone, progress: StoneProgress, now: number): StoneState {
  if (progress.doneAt !== null) {
    return { stone, status: 'done', doneAt: progress.doneAt, timerStartedAt: null, remainingMs: null, fractionLeft: null }
  }
  const total = guideMs(stone)
  if (progress.timerStartedAt === null || total === 0) {
    return { stone, status: 'notStarted', doneAt: null, timerStartedAt: null, remainingMs: null, fractionLeft: null }
  }
  const elapsed = Math.max(0, now - progress.timerStartedAt)
  const remainingMs = Math.max(0, total - elapsed)
  return {
    stone,
    status: remainingMs > 0 ? 'running' : 'timeReached',
    doneAt: null,
    timerStartedAt: progress.timerStartedAt,
    remainingMs,
    fractionLeft: remainingMs / total,
  }
}

/**
 * Derives where the morning is from the frozen snapshot and the session events (AD-3, AD-4, AD-15, AD-16).
 * Pure: the clock comes in as `now` and nothing is mutated or stored.
 */
export function deriveSession(snapshot: DaySnapshot, events: readonly SessionEvent[], now: number): SessionView {
  const startAt = localTimeMs(snapshot.date, snapshot.start)
  const departureAt = localTimeMs(snapshot.date, snapshot.departure)

  const stonesById = new Map<string, Stone>()
  for (const stone of snapshot.stones) {
    if (!stonesById.has(stone.stoneId)) stonesById.set(stone.stoneId, stone)
  }
  const stones = [...stonesById.values()]

  const departureGuideMs = stones.reduce((sum, stone) => sum + (stone.owner.kind === 'departure' ? guideMs(stone) : 0), 0)
  const nudgeAt = Math.max(startAt, departureAt - departureGuideMs)

  const ordered = events.filter((event) => event.date === snapshot.date).sort((a, b) => a.seq - b.seq)

  const firstDeparted = ordered.find((event) => event.kind === 'departedTapped')
  const cutoffAt = firstDeparted ? Math.min(departureAt, firstDeparted.at) : departureAt
  const departedAt = firstDeparted && firstDeparted.at < departureAt ? firstDeparted.at : null
  const t = Math.min(now, cutoffAt)

  const progress = new Map<string, StoneProgress>(stones.map((stone) => [stone.stoneId, { doneAt: null, timerStartedAt: null }]))
  const childStones = new Map<string, Stone[]>(snapshot.children.map((child) => [child.id, []]))
  for (const stone of stones) {
    if (stone.owner.kind === 'child') childStones.get(stone.owner.childId)?.push(stone)
  }
  const finishedAt = new Map<string, number | null>(snapshot.children.map((child) => [child.id, null]))

  const allDone = (list: readonly Stone[]): boolean => list.every((stone) => progress.get(stone.stoneId)?.doneAt != null)

  let started = false
  let companionId: string | null = null
  const eventCues: Cue[] = []

  for (const event of ordered) {
    if (event.at >= cutoffAt) continue
    if (event.kind === 'sessionStarted') {
      if (!started) {
        started = true
        companionId = event.companionId
      }
      continue
    }
    if (event.kind === 'departedTapped') continue

    const stone = stonesById.get(event.stoneId)
    const state = progress.get(event.stoneId)
    if (!stone || !state) continue

    if (event.kind === 'timerStarted') {
      if (guideMs(stone) > 0 && state.doneAt === null && state.timerStartedAt === null) state.timerStartedAt = event.at
      continue
    }

    const ownerId = stone.owner.kind === 'child' ? stone.owner.childId : null
    const ownStones = ownerId === null ? undefined : childStones.get(ownerId)

    if (event.kind === 'taskUnticked') {
      const wasDone = state.doneAt !== null
      state.doneAt = null
      state.timerStartedAt = null
      if (wasDone && ownerId !== null && finishedAt.has(ownerId)) finishedAt.set(ownerId, null)
      continue
    }

    if (state.doneAt !== null) continue
    state.doneAt = event.at
    eventCues.push({ id: `tick:${event.seq}`, kind: 'tick', at: event.at, stoneId: stone.stoneId })
    if (ownerId !== null && ownStones && allDone(ownStones)) {
      finishedAt.set(ownerId, event.at)
      if (event.at < nudgeAt) {
        eventCues.push({ id: `childDone:${ownerId}:${event.seq}`, kind: 'childDone', at: event.at, childId: ownerId })
      }
    }
    if (stones.length > 0 && allDone(stones)) {
      eventCues.push({ id: `teamGoal:${event.seq}`, kind: 'teamGoal', at: event.at })
    }
  }

  const phase: SessionPhase = !started ? 'notStarted' : t >= cutoffAt ? 'ended' : t < nudgeAt ? 'running' : 'departure'

  const stateOf = (stone: Stone): StoneState => stoneState(stone, progress.get(stone.stoneId) ?? { doneAt: null, timerStartedAt: null }, t)

  const speeltijdLimit = Math.min(nudgeAt, cutoffAt)
  const children: ChildLane[] = snapshot.children.map((child) => {
    const own = (childStones.get(child.id) ?? []).map(stateOf)
    const finished = finishedAt.get(child.id) ?? null
    const earnedMs = finished === null ? 0 : Math.max(0, speeltijdLimit - finished)
    const onRug = finished !== null && finished < speeltijdLimit && t < speeltijdLimit
    const speeltijd: Speeltijd = {
      onRug,
      earnedMs,
      remainingMs: onRug && finished !== null ? Math.max(0, speeltijdLimit - Math.max(t, finished)) : 0,
    }
    return {
      childId: child.id,
      name: child.name,
      stones: own,
      currentStoneId: own.find((state) => state.status !== 'done')?.stone.stoneId ?? null,
      finishedAt: finished,
      speeltijd,
    }
  })

  const departureStones = stones.filter((stone) => stone.owner.kind === 'departure').map(stateOf)

  const planks = stones.filter((stone) => progress.get(stone.stoneId)?.doneAt != null).length
  const complete = stones.length > 0 && planks === stones.length
  const bridge: Bridge = {
    planks,
    total: stones.length,
    complete,
    fillers: phase === 'ended' && !complete ? stones.length - planks : 0,
  }

  const cues: Cue[] = [...eventCues]
  if (started) {
    const timeCues: Cue[] = [
      { id: 'nudge', kind: 'nudge', at: nudgeAt },
      { id: 'warn10', kind: 'warn10', at: departureAt - 10 * MINUTE_MS },
      { id: 'warn5', kind: 'warn5', at: departureAt - 5 * MINUTE_MS },
      { id: 'departure', kind: 'departure', at: departureAt },
    ]
    cues.push(...timeCues.filter((cue) => t >= cue.at))
  }
  cues.sort((a, b) => a.at - b.at)

  const span = departureAt - startAt
  return {
    date: snapshot.date,
    phase,
    companionId,
    children,
    departureStones,
    bridge,
    onTime: phase === 'ended' && complete,
    cues,
    timeline: {
      startAt,
      nudgeAt,
      departureAt,
      cutoffAt,
      departedAt,
      progress: span > 0 ? Math.min(1, Math.max(0, (t - startAt) / span)) : t >= departureAt ? 1 : 0,
      remainingMs: Math.max(0, departureAt - t),
    },
  }
}
