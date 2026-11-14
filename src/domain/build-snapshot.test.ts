import { describe, expect, it } from 'vitest'
import { buildSnapshot } from './build-snapshot.ts'
import { resolveDay } from './resolve-day.ts'
import type { Child, DayPlan, Routine, Task } from './types.ts'

const zoon: Child = { id: 'zoon', name: 'Zoon', avatar: { kind: 'illustration', key: 'kid-1' } }
const dochter: Child = { id: 'dochter', name: 'Dochter' }

const own = (id: string, childId: string, extra: Partial<Task> = {}): Task => ({
  id,
  name: id,
  owner: { kind: 'child', childId },
  locked: false,
  ...extra,
})
const shared = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  name: id,
  owner: { kind: 'departure' },
  locked: true,
  ...extra,
})

const plan = (tasks: Task[], extra: Partial<DayPlan> = {}): DayPlan => ({
  kind: 'session',
  date: '2026-11-16',
  routineId: 'r1',
  routineName: 'Normaal',
  start: '07:15',
  departure: '08:05',
  soundOn: true,
  tasks,
  ...extra,
})

describe('buildSnapshot', () => {
  it('makes one stone per task in plan order, with the task id as stone id', () => {
    const tasks = [
      own('plassen', 'zoon'),
      own('ontbijt-d', 'dochter', { guideMinutes: 10, picture: { kind: 'illustration', key: 'ontbijt' } }),
      shared('schoenen', { guideMinutes: 2 }),
      own('tanden', 'zoon', { guideMinutes: 2, voiceMediaId: 'voice-1' }),
    ]
    const snapshot = buildSnapshot(plan(tasks), [zoon, dochter])
    expect(snapshot.stones.map((stone) => stone.stoneId)).toEqual(['plassen', 'ontbijt-d', 'schoenen', 'tanden'])
    expect(snapshot.stones[1]).toEqual({
      stoneId: 'ontbijt-d',
      owner: { kind: 'child', childId: 'dochter' },
      name: 'ontbijt-d',
      guideMinutes: 10,
      picture: { kind: 'illustration', key: 'ontbijt' },
    })
    expect(snapshot.stones[2].owner).toEqual({ kind: 'departure' })
    expect(snapshot.stones[3].voiceMediaId).toBe('voice-1')
  })

  it('keeps every child in order and takes the plan times and sound flag', () => {
    const snapshot = buildSnapshot(plan([], { start: '07:00', departure: '08:30', soundOn: false }), [dochter, zoon])
    expect(snapshot.date).toBe('2026-11-16')
    expect(snapshot.start).toBe('07:00')
    expect(snapshot.departure).toBe('08:30')
    expect(snapshot.soundOn).toBe(false)
    expect(snapshot.children).toEqual([
      { id: 'dochter', name: 'Dochter' },
      { id: 'zoon', name: 'Zoon', avatar: { kind: 'illustration', key: 'kid-1' } },
    ])
  })

  it('drops the tasks of a child that does not exist and keeps departure tasks', () => {
    const tasks = [own('a', 'zoon'), own('weg', 'gone'), shared('jas')]
    const snapshot = buildSnapshot(plan(tasks), [zoon])
    expect(snapshot.stones.map((stone) => stone.stoneId)).toEqual(['a', 'jas'])
  })

  it('keeps the first stone of a repeated task id', () => {
    const snapshot = buildSnapshot(plan([own('a', 'zoon'), own('a', 'dochter')]), [zoon, dochter])
    expect(snapshot.stones).toHaveLength(1)
    expect(snapshot.stones[0].owner).toEqual({ kind: 'child', childId: 'zoon' })
  })

  it('applies a day override through the resolved plan', () => {
    const routine: Routine = {
      id: 'r1',
      name: 'Normaal',
      start: '07:15',
      departure: '08:05',
      soundOn: true,
      tasks: [own('a', 'zoon'), own('b', 'zoon'), shared('jas', { guideMinutes: 3 })],
    }
    const resolved = resolveDay(
      '2026-11-16',
      { defaultRoutineId: 'r1' },
      [],
      [routine],
      [{ date: '2026-11-16', removedTaskIds: ['b'], addedTasks: [own('extra', 'dochter')], departure: '08:20' }],
    )
    if (resolved.kind !== 'session') throw new Error('expected a session day')
    const snapshot = buildSnapshot(resolved, [zoon, dochter])
    expect(snapshot.stones.map((stone) => stone.stoneId)).toEqual(['a', 'jas', 'extra'])
    expect(snapshot.departure).toBe('08:20')
  })

  it('does not mutate its inputs and does not share nested objects', () => {
    const tasks = [own('a', 'zoon', { picture: { kind: 'illustration', key: 'x' } })]
    const input = plan(tasks)
    const children = [zoon]
    const before = JSON.stringify([input, children])
    const snapshot = buildSnapshot(input, children)
    expect(JSON.stringify([input, children])).toBe(before)
    expect(snapshot.stones[0].owner).not.toBe(tasks[0].owner)
    expect(snapshot.stones[0].picture).not.toBe(tasks[0].picture)
    expect(snapshot.children[0].avatar).not.toBe(zoon.avatar)
  })
})
