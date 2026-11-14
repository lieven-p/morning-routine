import { deriveSession } from '../domain/derive-session.ts'
import { localTimeMs } from '../domain/dates.ts'
import { resolveDay } from '../domain/resolve-day.ts'
import type { DayPlan, DaySnapshot, SessionView } from '../domain/types.ts'
import { DEFAULT_COMPANION_ID } from './companions.ts'
import type { KidsData } from './load-kids-data.ts'

export type KidsScreen =
  | { kind: 'start'; plan: DayPlan }
  | { kind: 'session'; snapshot: DaySnapshot; view: SessionView }
  | { kind: 'calm'; companionId: string }

/**
 * The plan of `data.date` when a session may be started at `now`: no snapshot yet, a plan exists and `now` is from
 * its start up to, not including, its departure (override times included). Otherwise null.
 */
export function startablePlan(data: KidsData, now: number): DayPlan | null {
  if (data.snapshot) return null
  const day = resolveDay(data.date, data.settings, data.calendar, data.routines, data.overrides)
  if (day.kind !== 'session') return null
  try {
    return now >= localTimeMs(day.date, day.start) && now < localTimeMs(day.date, day.departure) ? day : null
  } catch {
    return null
  }
}

/**
 * Which children's screen to show (CAP-5). A stored snapshot wins over later routine edits (AD-5): the session path
 * while it runs, the calm screen once it ended. Without one, the start screen inside the window, else calm.
 * Pure; unreadable stored times fall back to the calm screen, never an error.
 */
export function chooseKidsScreen(data: KidsData, now: number): KidsScreen {
  if (data.snapshot) {
    try {
      const view = deriveSession(data.snapshot, data.events, now)
      if (view.phase === 'running' || view.phase === 'departure') return { kind: 'session', snapshot: data.snapshot, view }
      return { kind: 'calm', companionId: view.companionId ?? DEFAULT_COMPANION_ID }
    } catch {
      return { kind: 'calm', companionId: DEFAULT_COMPANION_ID }
    }
  }
  const plan = startablePlan(data, now)
  return plan ? { kind: 'start', plan } : { kind: 'calm', companionId: DEFAULT_COMPANION_ID }
}
