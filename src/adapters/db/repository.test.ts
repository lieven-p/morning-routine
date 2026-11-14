import 'fake-indexeddb/auto'
import Dexie, { liveQuery } from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import type { DaySnapshot, Routine, Task } from '../../domain/types.ts'
import { DATABASE_NAME, DEV_DATABASE_NAME, deleteDatabase, SCHEMA_VERSION } from './database.ts'
import { createRepository, type DexieRepository } from './repository.ts'

let counter = 0
let clock = 1_000
const opened: DexieRepository[] = []

function setup(now: () => number = () => clock) {
  clock = 1_000
  const repository = createRepository(`test-db-${++counter}`, now)
  opened.push(repository)
  return repository
}

afterEach(() => {
  for (const repository of opened.splice(0)) repository.close()
})

const task = (id: string): Task => ({ id, name: id, owner: { kind: 'departure' }, locked: false })

const routine = (id: string): Routine => ({
  id,
  name: id,
  tasks: [task('t1')],
  start: '07:00',
  departure: '08:00',
  soundOn: true,
})

const snapshot = (date: string): DaySnapshot => ({
  date,
  start: '07:00',
  departure: '08:00',
  soundOn: true,
  children: [{ id: 'c1', name: 'Noor' }],
  stones: [{ stoneId: 's1', owner: { kind: 'child', childId: 'c1' }, name: 'Aankleden' }],
})

describe('fresh database', () => {
  it('returns default settings and writes nothing', async () => {
    const repository = setup()
    const defaults = { defaultRoutineId: null, lastChangedAt: null, lastBackupAt: null }
    expect(await repository.getSettings()).toEqual(defaults)
    expect(await repository.listChildren()).toEqual([])
    expect(await repository.getSettings()).toEqual(defaults)
    const raw = new Dexie(`test-db-${counter}`)
    await raw.open()
    expect(await raw.table('settings').count()).toBe(0)
    raw.close()
  })
})

describe('configuration writes', () => {
  const writes: [string, (r: DexieRepository) => Promise<unknown>][] = [
    ['putChild', (r) => r.putChild({ id: 'c1', name: 'Noor' })],
    ['deleteChild', (r) => r.deleteChild('c1')],
    ['putRoutine', (r) => r.putRoutine(routine('r1'))],
    ['deleteRoutine', (r) => r.deleteRoutine('r1')],
    ['putCalendarEntry', (r) => r.putCalendarEntry({ date: '2026-11-16', plan: { kind: 'noSchool' } })],
    ['deleteCalendarEntry', (r) => r.deleteCalendarEntry('2026-11-16')],
    ['putDayOverride', (r) => r.putDayOverride({ date: '2026-11-16', removedTaskIds: [], addedTasks: [] })],
    ['deleteDayOverride', (r) => r.deleteDayOverride('2026-11-16')],
    ['putMedia', (r) => r.putMedia({ id: 'm1', blob: new Blob(['x']), mimeType: 'audio/webm' })],
    ['deleteMedia', (r) => r.deleteMedia('m1')],
    ['setDefaultRoutineId', (r) => r.setDefaultRoutineId('r1')],
  ]

  it.each(writes)('%s sets lastChangedAt and keeps other settings', async (name, write) => {
    const repository = setup()
    await repository.setDefaultRoutineId('keep-me')
    await repository.markBackupDone()
    const before = await repository.getSettings()
    clock = 5_000
    await write(repository)
    const after = await repository.getSettings()
    expect(after.lastChangedAt).toBe(5_000)
    expect(after.lastBackupAt).toBe(before.lastBackupAt)
    expect(after.defaultRoutineId).toBe(name === 'setDefaultRoutineId' ? 'r1' : 'keep-me')
  })

  it('rolls back the write when the settings stamp fails', async () => {
    const repository = setup(() => {
      throw new Error('clock failure')
    })
    await expect(repository.putChild({ id: 'c1', name: 'Noor' })).rejects.toThrow('clock failure')
    expect(await repository.listChildren()).toEqual([])
    expect((await repository.getSettings()).lastChangedAt).toBeNull()
  })
})

describe('session writes', () => {
  it('startSession and appendEvent leave lastChangedAt unchanged', async () => {
    const repository = setup()
    await repository.putChild({ id: 'c1', name: 'Noor' })
    clock = 9_000
    await repository.startSession(snapshot('2026-11-16'), 'c1', 9_000)
    await repository.appendEvent({ kind: 'taskTicked', date: '2026-11-16', at: 9_001, stoneId: 's1' })
    expect((await repository.getSettings()).lastChangedAt).toBe(1_000)
  })

  it('second start for one date changes nothing', async () => {
    const repository = setup()
    expect(await repository.startSession(snapshot('2026-11-16'), 'first', 1)).toBe(true)
    expect(await repository.startSession({ ...snapshot('2026-11-16'), departure: '09:00' }, 'second', 2)).toBe(false)
    expect(await repository.listSnapshots()).toEqual([snapshot('2026-11-16')])
    const events = await repository.listEvents('2026-11-16')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'sessionStarted', companionId: 'first', at: 1 })
  })

  it('orders events by seq, strictly increasing across dates', async () => {
    const repository = setup()
    await repository.startSession(snapshot('2026-11-16'), 'c1', 500)
    await repository.startSession(snapshot('2026-11-17'), 'c1', 400)
    const a = await repository.appendEvent({ kind: 'timerStarted', date: '2026-11-16', at: 100, stoneId: 's1' })
    const b = await repository.appendEvent({ kind: 'taskTicked', date: '2026-11-17', at: 300, stoneId: 's1' })
    const c = await repository.appendEvent({ kind: 'departedTapped', date: '2026-11-16', at: 50 })
    expect(a.seq).toBeLessThan(b.seq)
    expect(b.seq).toBeLessThan(c.seq)
    const day = await repository.listEvents('2026-11-16')
    expect(day.map((e) => e.kind)).toEqual(['sessionStarted', 'timerStarted', 'departedTapped'])
    expect(day.map((e) => e.seq)).toEqual([...day.map((e) => e.seq)].sort((x, y) => x - y))
  })
})

describe('backup bookkeeping', () => {
  it('sets lastBackupAt and keeps lastChangedAt', async () => {
    const repository = setup()
    await repository.putChild({ id: 'c1', name: 'Noor' })
    clock = 7_000
    await repository.markBackupDone()
    expect(await repository.getSettings()).toEqual({
      defaultRoutineId: null,
      lastChangedAt: 1_000,
      lastBackupAt: 7_000,
    })
  })
})

describe('media', () => {
  it('round trips bytes and MIME type; unknown id is undefined', async () => {
    const repository = setup()
    const bytes = new Uint8Array([1, 2, 3, 250])
    await repository.putMedia({ id: 'm1', blob: new Blob([bytes], { type: 'audio/webm' }), mimeType: 'audio/webm' })
    const stored = await repository.getMedia('m1')
    expect(stored?.mimeType).toBe('audio/webm')
    expect(stored?.blob.type).toBe('audio/webm')
    expect(new Uint8Array(await stored!.blob.arrayBuffer())).toEqual(bytes)
    expect(await repository.listMediaIds()).toEqual(['m1'])
    expect(await repository.getMedia('unknown')).toBeUndefined()
    await repository.deleteMedia('m1')
    expect(await repository.getMedia('m1')).toBeUndefined()
  })
})

describe('live query', () => {
  it('delivers the new list after a put', async () => {
    const repository = setup()
    const lists: string[][] = []
    const subscription = liveQuery(() => repository.listChildren()).subscribe((children) =>
      lists.push(children.map((c) => c.name)),
    )
    try {
      await expect.poll(() => lists.at(-1)).toEqual([])
      await repository.putChild({ id: 'c1', name: 'Noor' })
      await expect.poll(() => lists.at(-1)).toEqual(['Noor'])
    } finally {
      subscription.unsubscribe()
    }
  })
})

describe('schema version', () => {
  it('equals the Dexie version and the IndexedDB version', async () => {
    expect(SCHEMA_VERSION).toBe(1)
    const repository = setup()
    await repository.open()
    const raw = new Dexie(`test-db-${counter}`)
    await raw.open()
    expect(raw.verno).toBe(SCHEMA_VERSION)
    expect(raw.tables.map((t) => t.name).sort()).toEqual(
      ['calendar', 'children', 'dayOverrides', 'events', 'media', 'routines', 'settings', 'snapshots'].sort(),
    )
    raw.close()
    expect(DATABASE_NAME).toBe('morning-routine')
  })
})

describe('development database', () => {
  it('has its own name and deleteDatabase removes only the named database', async () => {
    expect(DEV_DATABASE_NAME).toBe('morning-routine-dev')
    expect(DEV_DATABASE_NAME).not.toBe(DATABASE_NAME)

    const real = createRepository(`test-db-real-${++counter}`)
    const dev = createRepository(`test-db-dev-${counter}`)
    opened.push(real, dev)
    await real.putChild({ id: 'c1', name: 'Noor' })
    await dev.putChild({ id: 'c2', name: 'Lars' })
    dev.close()

    await deleteDatabase(`test-db-dev-${counter}`)

    expect((await real.listChildren()).map((child) => child.name)).toEqual(['Noor'])
    const reopened = createRepository(`test-db-dev-${counter}`)
    opened.push(reopened)
    expect(await reopened.listChildren()).toEqual([])
  })
})
