import type { Table } from 'dexie'
import type { Repository } from '../../app/ports.ts'
import type { SessionEvent, Settings } from '../../domain/types.ts'
import { createDatabase, DATABASE_NAME, SETTINGS_KEY, type SettingsRow } from './database.ts'

export interface DexieRepository extends Repository {
  /** Opens the database; queries open it lazily otherwise. */
  open(): Promise<void>
  close(): void
}

const DEFAULT_SETTINGS: Settings = {
  defaultRoutineId: null,
  lastChangedAt: null,
  lastBackupAt: null,
}

const toSettings = (row: SettingsRow | undefined): Settings => ({
  defaultRoutineId: row?.defaultRoutineId ?? DEFAULT_SETTINGS.defaultRoutineId,
  lastChangedAt: row?.lastChangedAt ?? DEFAULT_SETTINGS.lastChangedAt,
  lastBackupAt: row?.lastBackupAt ?? DEFAULT_SETTINGS.lastBackupAt,
})

export function createRepository(
  databaseName: string = DATABASE_NAME,
  now: () => number = () => Date.now(),
): DexieRepository {
  const db = createDatabase(databaseName)

  const readSettings = async (): Promise<Settings> => toSettings(await db.settings.get(SETTINGS_KEY))

  const patchSettings = async (patch: Partial<Settings>): Promise<void> => {
    await db.settings.put({ ...(await readSettings()), ...patch, id: SETTINGS_KEY })
  }

  // Every configuration write goes through here so `lastChangedAt` moves in the
  // same transaction (AD-17); a failure rolls back the write and the stamp together.
  const configWrite = (tables: Table[], write: () => Promise<unknown>): Promise<void> =>
    db.transaction('rw', [...tables, db.settings], async () => {
      await write()
      await patchSettings({ lastChangedAt: now() })
    })

  return {
    open: async () => {
      await db.open()
    },
    close: () => db.close(),

    getSettings: readSettings,
    setDefaultRoutineId: (routineId) =>
      db.transaction('rw', db.settings, () => patchSettings({ defaultRoutineId: routineId, lastChangedAt: now() })),
    markBackupDone: () => db.transaction('rw', db.settings, () => patchSettings({ lastBackupAt: now() })),

    listChildren: () => db.children.toArray(),
    putChild: (child) => configWrite([db.children], () => db.children.put(child)),
    deleteChild: (id) => configWrite([db.children], () => db.children.delete(id)),

    listRoutines: () => db.routines.toArray(),
    getRoutine: (id) => db.routines.get(id),
    putRoutine: (routine) => configWrite([db.routines], () => db.routines.put(routine)),
    deleteRoutine: (id) => configWrite([db.routines], () => db.routines.delete(id)),

    listCalendarEntries: () => db.calendar.toArray(),
    getCalendarEntry: (date) => db.calendar.get(date),
    putCalendarEntry: (entry) => configWrite([db.calendar], () => db.calendar.put(entry)),
    deleteCalendarEntry: (date) => configWrite([db.calendar], () => db.calendar.delete(date)),

    listDayOverrides: () => db.dayOverrides.toArray(),
    getDayOverride: (date) => db.dayOverrides.get(date),
    putDayOverride: (override) => configWrite([db.dayOverrides], () => db.dayOverrides.put(override)),
    deleteDayOverride: (date) => configWrite([db.dayOverrides], () => db.dayOverrides.delete(date)),

    listSnapshots: () => db.snapshots.toArray(),
    getSnapshot: (date) => db.snapshots.get(date),

    listEvents: (date) => db.events.where('date').equals(date).sortBy('seq'),
    startSession: (snapshot, companionId, at) =>
      db.transaction('rw', db.snapshots, db.events, async () => {
        if (await db.snapshots.get(snapshot.date)) return false
        await db.snapshots.add(snapshot)
        await db.events.add({ kind: 'sessionStarted', date: snapshot.date, at, companionId })
        return true
      }),
    appendEvent: async (event) => {
      const seq = await db.events.add(event)
      return { ...event, seq } as SessionEvent
    },

    listMediaIds: async () => (await db.media.toCollection().primaryKeys()) as string[],
    getMedia: (id) => db.media.get(id),
    putMedia: (record) => configWrite([db.media], () => db.media.put(record)),
    deleteMedia: (id) => configWrite([db.media], () => db.media.delete(id)),
  }
}
