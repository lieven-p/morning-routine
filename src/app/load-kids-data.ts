import type {
  CalendarEntry,
  Child,
  DateString,
  DayOverride,
  DaySnapshot,
  Routine,
  SessionEvent,
  Settings,
} from '../domain/types.ts'
import type { Repository } from './ports.ts'

/** Everything KidsShell needs to choose a screen for one date, read in one go. */
export interface KidsData {
  date: DateString
  settings: Settings
  calendar: CalendarEntry[]
  routines: Routine[]
  overrides: DayOverride[]
  children: Child[]
  snapshot: DaySnapshot | undefined
  /** Events of `date`, ordered by `seq`. */
  events: SessionEvent[]
}

/** One read of settings, calendar, routines, overrides, children and the date's snapshot and events (AD-2). */
export async function loadKidsData(repository: Repository, date: DateString): Promise<KidsData> {
  const [settings, calendar, routines, overrides, children, snapshot, events] = await Promise.all([
    repository.getSettings(),
    repository.listCalendarEntries(),
    repository.listRoutines(),
    repository.listDayOverrides(),
    repository.listChildren(),
    repository.getSnapshot(date),
    repository.listEvents(date),
  ])
  return { date, settings, calendar, routines, overrides, children, snapshot, events }
}
