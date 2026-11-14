import Dexie, { type Table } from 'dexie'
import type {
  CalendarEntry,
  Child,
  DayOverride,
  DaySnapshot,
  MediaRecord,
  NewSessionEvent,
  Routine,
  SessionEvent,
  Settings,
} from '../../domain/types.ts'

export const DATABASE_NAME = 'morning-routine'

/** Equals the Dexie version and the backup `schemaVersion` (AD-8, AD-9). */
export const SCHEMA_VERSION = 1

export const SETTINGS_KEY = 'settings'

export type SettingsRow = Settings & { id: typeof SETTINGS_KEY }

export type MorningRoutineDatabase = Dexie & {
  settings: Table<SettingsRow, string>
  children: Table<Child, string>
  routines: Table<Routine, string>
  calendar: Table<CalendarEntry, string>
  dayOverrides: Table<DayOverride, string>
  snapshots: Table<DaySnapshot, string>
  events: Table<SessionEvent, number, NewSessionEvent>
  media: Table<MediaRecord, string>
}

export function createDatabase(name: string = DATABASE_NAME): MorningRoutineDatabase {
  const db = new Dexie(name) as MorningRoutineDatabase
  // Never edit an existing version; schema changes add a new one (AD-9).
  db.version(SCHEMA_VERSION).stores({
    settings: 'id',
    children: 'id',
    routines: 'id',
    calendar: 'date',
    dayOverrides: 'date',
    snapshots: 'date',
    events: '++seq, date',
    media: 'id',
  })
  return db
}
