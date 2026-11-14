import type {
  AppendableEvent,
  CalendarEntry,
  Child,
  DateString,
  DayOverride,
  DaySnapshot,
  MediaRecord,
  Routine,
  SessionEvent,
  Settings,
} from '../domain/types.ts'

/**
 * The one persistence port (AD-2). Query methods are plain async functions so
 * a live query can observe them. Configuration writes set `settings.lastChangedAt`
 * in the same transaction; session writes and backup bookkeeping never do (AD-17).
 */
export interface Repository {
  getSettings(): Promise<Settings>
  setDefaultRoutineId(routineId: string | null): Promise<void>
  /** Backup bookkeeping: sets `lastBackupAt` only. */
  markBackupDone(): Promise<void>

  listChildren(): Promise<Child[]>
  putChild(child: Child): Promise<void>
  deleteChild(id: string): Promise<void>

  listRoutines(): Promise<Routine[]>
  getRoutine(id: string): Promise<Routine | undefined>
  putRoutine(routine: Routine): Promise<void>
  deleteRoutine(id: string): Promise<void>

  listCalendarEntries(): Promise<CalendarEntry[]>
  getCalendarEntry(date: DateString): Promise<CalendarEntry | undefined>
  putCalendarEntry(entry: CalendarEntry): Promise<void>
  deleteCalendarEntry(date: DateString): Promise<void>

  listDayOverrides(): Promise<DayOverride[]>
  getDayOverride(date: DateString): Promise<DayOverride | undefined>
  putDayOverride(override: DayOverride): Promise<void>
  deleteDayOverride(date: DateString): Promise<void>

  listSnapshots(): Promise<DaySnapshot[]>
  getSnapshot(date: DateString): Promise<DaySnapshot | undefined>

  /** Events of one date, ordered by `seq`. */
  listEvents(date: DateString): Promise<SessionEvent[]>
  /**
   * Writes the snapshot and `sessionStarted` in one transaction. Returns false and
   * changes nothing when the date already has a snapshot.
   */
  startSession(snapshot: DaySnapshot, companionId: string, at: number): Promise<boolean>
  appendEvent(event: AppendableEvent): Promise<SessionEvent>

  listMediaIds(): Promise<string[]>
  getMedia(id: string): Promise<MediaRecord | undefined>
  putMedia(record: MediaRecord): Promise<void>
  deleteMedia(id: string): Promise<void>
}

/** The one source of time (AD-1, AD-6): epoch ms. */
export interface Clock {
  now(): number
}
