import { describe, expect, it } from 'vitest'
import { resolveDay } from './resolve-day.ts'
import type { CalendarEntry, DayOverride, Routine, Settings, Task } from './types.ts'

const MON = '2026-11-16'
const TUE = '2026-11-17'
const WED = '2026-11-18'
const SAT = '2026-11-21'
const SUN = '2026-11-22'

function task(id: string, extra: Partial<Task> = {}): Task {
  return { id, name: id, owner: { kind: 'child', childId: 'c1' }, locked: false, ...extra }
}

function routine(id: string, tasks: Task[], extra: Partial<Routine> = {}): Routine {
  return { id, name: `Routine ${id}`, tasks, start: '07:00', departure: '08:15', soundOn: true, ...extra }
}

const settings = (defaultRoutineId: string | null): Settings => ({
  defaultRoutineId,
  lastChangedAt: null,
  lastBackupAt: null,
})

const planned = (date: string, routineId: string): CalendarEntry => ({
  date,
  plan: { kind: 'routine', routineId },
})

const override = (date: string, extra: Partial<DayOverride> = {}): DayOverride => ({
  date,
  removedTaskIds: [],
  addedTasks: [],
  ...extra,
})

const A = routine('A', [task('a1'), task('a2')])
const B = routine('B', [task('b1')], { start: '09:00', departure: '10:00', soundOn: false })

function ids(result: ReturnType<typeof resolveDay>): string[] {
  if (result.kind !== 'session') throw new Error(`expected a session, got ${result.reason}`)
  return result.tasks.map((t) => t.id)
}

describe('resolveDay', () => {
  it('runs the default routine on every school day, Monday to Friday', () => {
    for (const date of [MON, TUE, WED, '2026-11-19', '2026-11-20']) {
      expect(resolveDay(date, settings('A'), [], [A, B], [])).toMatchObject({ kind: 'session', routineId: 'A' })
    }
  })

  it('runs the default routine on a school day', () => {
    expect(resolveDay(WED, settings('A'), [], [A, B], [])).toEqual({
      kind: 'session',
      date: WED,
      routineId: 'A',
      routineName: 'Routine A',
      start: '07:00',
      departure: '08:15',
      soundOn: true,
      tasks: A.tasks,
    })
  })

  it('prefers the planned routine over the default', () => {
    const result = resolveDay(WED, settings('A'), [planned(WED, 'B')], [A, B], [])
    expect(result).toMatchObject({ kind: 'session', routineId: 'B', soundOn: false, start: '09:00' })
  })

  it('runs a planned routine on a weekend', () => {
    expect(resolveDay(SAT, settings('A'), [planned(SAT, 'B')], [A, B], [])).toMatchObject({
      kind: 'session',
      routineId: 'B',
    })
    expect(resolveDay(SUN, settings('A'), [planned(SUN, 'B')], [A, B], [])).toMatchObject({ routineId: 'B' })
  })

  it('never runs the default routine on a weekend', () => {
    for (const date of [SAT, SUN]) {
      expect(resolveDay(date, settings('A'), [], [A, B], [])).toEqual({ kind: 'none', date, reason: 'noPlan' })
    }
  })

  it('has no session without a default routine', () => {
    expect(resolveDay(MON, settings(null), [], [A, B], [])).toEqual({ kind: 'none', date: MON, reason: 'noPlan' })
  })

  it.each([
    ['noSchool', { kind: 'noSchool' }],
    ['noSession', { kind: 'noSession' }],
  ] as const)('%s wins over everything, including an override', (reason, plan) => {
    const result = resolveDay(
      WED,
      settings('A'),
      [{ date: WED, plan }],
      [A, B],
      [override(WED, { addedTasks: [task('x')], departure: '09:00' })],
    )
    expect(result).toEqual({ kind: 'none', date: WED, reason })
  })

  it('reports a missing planned routine without falling back to the default', () => {
    expect(resolveDay(WED, settings('A'), [planned(WED, 'gone')], [A, B], [])).toEqual({
      kind: 'none',
      date: WED,
      reason: 'routineMissing',
    })
  })

  it('reports a missing default routine', () => {
    expect(resolveDay(WED, settings('gone'), [], [A, B], [])).toEqual({
      kind: 'none',
      date: WED,
      reason: 'routineMissing',
    })
  })

  it('limits a task to its weekdays', () => {
    const r = routine('R', [task('always'), task('tue', { weekdays: [2] })])
    expect(ids(resolveDay(TUE, settings('R'), [], [r], []))).toEqual(['always', 'tue'])
    expect(ids(resolveDay(WED, settings('R'), [], [r], []))).toEqual(['always'])
  })

  it('treats empty or absent weekdays as every day', () => {
    const r = routine('R', [task('empty', { weekdays: [] }), task('absent')])
    expect(ids(resolveDay(MON, settings('R'), [], [r], []))).toEqual(['empty', 'absent'])
    expect(ids(resolveDay(SAT, settings(null), [planned(SAT, 'R')], [r], []))).toEqual(['empty', 'absent'])
  })

  it('limits a weekend task to the weekend', () => {
    const r = routine('R', [task('sat', { weekdays: [6] }), task('any')])
    const calendar = [planned(SAT, 'R'), planned(MON, 'R')]
    expect(ids(resolveDay(SAT, settings(null), calendar, [r], []))).toEqual(['sat', 'any'])
    expect(ids(resolveDay(MON, settings(null), calendar, [r], []))).toEqual(['any'])
  })

  it('applies a one-day override to that date only', () => {
    const stored = JSON.stringify(A)
    const ov = override(WED, { removedTaskIds: ['a1'], addedTasks: [task('x')], departure: '08:00', start: '06:45' })
    const day = resolveDay(WED, settings('A'), [], [A], [ov])
    expect(ids(day)).toEqual(['a2', 'x'])
    expect(day).toMatchObject({ start: '06:45', departure: '08:00' })
    const next = resolveDay('2026-11-19', settings('A'), [], [A], [ov])
    expect(ids(next)).toEqual(['a1', 'a2'])
    expect(next).toMatchObject({ start: '07:00', departure: '08:15' })
    expect(JSON.stringify(A)).toBe(stored)
  })

  it('keeps the routine times when the override gives none', () => {
    const day = resolveDay(WED, settings('A'), [], [A], [override(WED, { removedTaskIds: ['a1'] })])
    expect(day).toMatchObject({ start: '07:00', departure: '08:15' })
  })

  it('ignores an override for another date', () => {
    const ov = override('2026-11-19', { removedTaskIds: ['a1'], departure: '09:00' })
    const day = resolveDay(WED, settings('A'), [], [A], [ov])
    expect(ids(day)).toEqual(['a1', 'a2'])
    expect(day).toMatchObject({ departure: '08:15' })
  })

  it('includes an added task whatever its weekdays', () => {
    const ov = override(TUE, { addedTasks: [task('x', { weekdays: [3] })] })
    expect(ids(resolveDay(TUE, settings('A'), [], [A], [ov]))).toEqual(['a1', 'a2', 'x'])
  })

  it('removes a locked task when the override says so', () => {
    const r = routine('R', [task('shoes', { locked: true }), task('b')])
    const ov = override(WED, { removedTaskIds: ['shoes'] })
    expect(ids(resolveDay(WED, settings('R'), [], [r], [ov]))).toEqual(['b'])
  })

  it('applies the override to a planned weekend routine', () => {
    const ov = override(SAT, { addedTasks: [task('x')] })
    expect(ids(resolveDay(SAT, settings(null), [planned(SAT, 'B')], [B], [ov]))).toEqual(['b1', 'x'])
  })

  it.each(['2026-13-40', '16-11-2026', '2026-02-30'])('throws RangeError for %s', (date) => {
    expect(() => resolveDay(date, settings('A'), [], [A], [])).toThrow(RangeError)
  })

  it('does not mutate frozen inputs', () => {
    const deepFreeze = <T>(value: T): T => {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(deepFreeze)
        Object.freeze(value)
      }
      return value
    }
    const r = deepFreeze(routine('R', [task('a', { weekdays: [3] }), task('b')]))
    const s = deepFreeze(settings('R'))
    const cal = deepFreeze([planned(SAT, 'R')])
    const ov = deepFreeze([override(WED, { removedTaskIds: ['b'], addedTasks: [task('x')] })])
    const rs = deepFreeze([r])
    expect(ids(resolveDay(WED, s, cal, rs, ov))).toEqual(['a', 'x'])
    expect(ids(resolveDay(SAT, s, cal, rs, ov))).toEqual(['b'])
  })

  it('returns a new task array, not the routine\'s own', () => {
    const day = resolveDay(WED, settings('A'), [], [A], [])
    if (day.kind !== 'session') throw new Error('expected a session')
    expect(day.tasks).not.toBe(A.tasks)
  })
})
