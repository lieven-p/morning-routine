import { deriveSession } from '../domain/derive-session.ts'
import { localTimeMs } from '../domain/dates.ts'
import { resolveDay } from '../domain/resolve-day.ts'
import type { DayPlan, DaySnapshot, SessionEvent, SessionView } from '../domain/types.ts'
import { DEFAULT_COMPANION_ID } from './companions.ts'
import type { KidsData } from './load-kids-data.ts'

export type KidsScreen =
  | { kind: 'start'; plan: DayPlan }
  | { kind: 'session'; snapshot: DaySnapshot; view: SessionView }
  | { kind: 'departure'; snapshot: DaySnapshot; view: SessionView }
  | { kind: 'calm'; companionId: string }

/** How long the departure screen stays after the cutoff before the calm screen takes over. */
export const DEPARTURE_SCREEN_MS = 5 * 60_000

/** True when a "We zijn vertrokken" tap is stored for the date. */
export function hasDepartedTap(events: readonly SessionEvent[]): boolean {
  return events.some((event) => event.kind === 'departedTapped')
}

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
 * while it runs; once it ended, the departure screen for 5 minutes after the cutoff unless a parent tapped "We zijn
 * vertrokken" (a stored tap, early or late), then the calm screen. Without a snapshot, the start screen inside the
 * window, else calm. Pure; unreadable stored times fall back to the calm screen, never an error.
 */
export function chooseKidsScreen(data: KidsData, now: number): KidsScreen {
  if (data.snapshot) {
    try {
      const view = deriveSession(data.snapshot, data.events, now)
      if (view.phase === 'running' || view.phase === 'departure') return { kind: 'session', snapshot: data.snapshot, view }
      if (view.phase === 'ended' && !hasDepartedTap(data.events) && now < view.timeline.cutoffAt + DEPARTURE_SCREEN_MS) {
        return { kind: 'departure', snapshot: data.snapshot, view }
      }
      return { kind: 'calm', companionId: view.companionId ?? DEFAULT_COMPANION_ID }
    } catch {
      return { kind: 'calm', companionId: DEFAULT_COMPANION_ID }
    }
  }
  const plan = startablePlan(data, now)
  return plan ? { kind: 'start', plan } : { kind: 'calm', companionId: DEFAULT_COMPANION_ID }
}
