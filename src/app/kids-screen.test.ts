import { describe, expect, it } from 'vitest'
import { localTimeMs } from '../domain/dates.ts'
import type { DaySnapshot, Routine, SessionEvent } from '../domain/types.ts'
import { chooseKidsScreen, startablePlan } from './kids-screen.ts'
import type { KidsData } from './load-kids-data.ts'

const MONDAY = '2026-11-16'
const SATURDAY = '2026-11-21'
const at = (date: string, time: string) => localTimeMs(date, time)

const routine: Routine = {
  id: 'r1',
  name: 'Normaal',
  start: '07:15',
  departure: '08:05',
  soundOn: true,
  tasks: [
    { id: 'plassen', name: 'Plassen', owner: { kind: 'child', childId: 'zoon' }, locked: false },
    { id: 'jas', name: 'Jas aan', owner: { kind: 'departure' }, locked: true, guideMinutes: 3 },
  ],
}

const data = (date: string, extra: Partial<KidsData> = {}): KidsData => ({
  date,
  settings: { defaultRoutineId: 'r1', lastChangedAt: null, lastBackupAt: null },
  calendar: [],
  routines: [routine],
  overrides: [],
  children: [{ id: 'zoon', name: 'Zoon' }],
  snapshot: undefined,
  events: [],
  ...extra,
})

const snapshot = (date: string, extra: Partial<DaySnapshot> = {}): DaySnapshot => ({
  date,
  start: '07:15',
  departure: '08:05',
  soundOn: true,
  children: [{ id: 'zoon', name: 'Zoon' }],
  stones: [
    { stoneId: 'plassen', owner: { kind: 'child', childId: 'zoon' }, name: 'Plassen' },
    { stoneId: 'jas', owner: { kind: 'departure' }, name: 'Jas aan', guideMinutes: 3 },
  ],
  ...extra,
})

const started = (date: string, companionId = 'konijn'): SessionEvent[] => [
  { kind: 'sessionStarted', date, at: at(date, '07:16'), seq: 1, companionId },
]

describe('chooseKidsScreen without a snapshot', () => {
  it('shows calm on a day without a session', () => {
    expect(chooseKidsScreen(data(SATURDAY), at(SATURDAY, '07:30')).kind).toBe('calm')
    const noSchool = data(MONDAY, { calendar: [{ date: MONDAY, plan: { kind: 'noSchool' } }] })
    expect(chooseKidsScreen(noSchool, at(MONDAY, '07:30')).kind).toBe('calm')
  })

  it('shows calm before the window', () => {
    expect(chooseKidsScreen(data(MONDAY), at(MONDAY, '07:00')).kind).toBe('calm')
    expect(chooseKidsScreen(data(MONDAY), at(MONDAY, '07:14') + 59_999).kind).toBe('calm')
  })

  it('shows the start screen from the start up to, not including, the departure', () => {
    expect(chooseKidsScreen(data(MONDAY), at(MONDAY, '07:15')).kind).toBe('start')
    expect(chooseKidsScreen(data(MONDAY), at(MONDAY, '07:20')).kind).toBe('start')
    expect(chooseKidsScreen(data(MONDAY), at(MONDAY, '08:05') - 1).kind).toBe('start')
  })

  it('shows calm at and after the departure when never started', () => {
    expect(chooseKidsScreen(data(MONDAY), at(MONDAY, '08:05')).kind).toBe('calm')
    expect(chooseKidsScreen(data(MONDAY), at(MONDAY, '09:00')).kind).toBe('calm')
  })

  it('moves the window with an override', () => {
    const overrides = [{ date: MONDAY, removedTaskIds: [], addedTasks: [], start: '07:30', departure: '07:50' }]
    expect(chooseKidsScreen(data(MONDAY, { overrides }), at(MONDAY, '07:20')).kind).toBe('calm')
    expect(chooseKidsScreen(data(MONDAY, { overrides }), at(MONDAY, '07:30')).kind).toBe('start')
    expect(chooseKidsScreen(data(MONDAY, { overrides }), at(MONDAY, '07:50')).kind).toBe('calm')
  })

  it('uses the egel on the calm screen', () => {
    expect(chooseKidsScreen(data(SATURDAY), at(SATURDAY, '07:30'))).toEqual({ kind: 'calm', companionId: 'egel' })
  })

  it('falls back to calm when a stored routine time is unreadable', () => {
    const broken = data(MONDAY, { routines: [{ ...routine, start: 'ochtend' }] })
    expect(chooseKidsScreen(broken, at(MONDAY, '07:30')).kind).toBe('calm')
  })
})

describe('chooseKidsScreen with a snapshot', () => {
  it('shows the session path while running', () => {
    const screen = chooseKidsScreen(data(MONDAY, { snapshot: snapshot(MONDAY), events: started(MONDAY) }), at(MONDAY, '07:30'))
    expect(screen.kind).toBe('session')
    if (screen.kind === 'session') expect(screen.view.companionId).toBe('konijn')
  })

  it('keeps the session path in the departure phase', () => {
    const screen = chooseKidsScreen(data(MONDAY, { snapshot: snapshot(MONDAY), events: started(MONDAY) }), at(MONDAY, '08:02'))
    expect(screen.kind === 'session' && screen.view.phase).toBe('departure')
  })

  it('shows calm with the picked companion once ended', () => {
    const screen = chooseKidsScreen(data(MONDAY, { snapshot: snapshot(MONDAY), events: started(MONDAY, 'uil') }), at(MONDAY, '08:05'))
    expect(screen).toEqual({ kind: 'calm', companionId: 'uil' })
  })

  it('shows calm after a parent tapped departed early', () => {
    const events: SessionEvent[] = [
      ...started(MONDAY),
      { kind: 'departedTapped', date: MONDAY, at: at(MONDAY, '08:00'), seq: 2 },
    ]
    expect(chooseKidsScreen(data(MONDAY, { snapshot: snapshot(MONDAY), events }), at(MONDAY, '08:01')).kind).toBe('calm')
  })

  it('lets the snapshot win over a later routine edit and over the window', () => {
    const edited = data(MONDAY, {
      snapshot: snapshot(MONDAY),
      events: started(MONDAY),
      routines: [{ ...routine, start: '09:00', departure: '09:30', tasks: [] }],
    })
    expect(chooseKidsScreen(edited, at(MONDAY, '07:30')).kind).toBe('session')
    const noSession = data(MONDAY, {
      snapshot: snapshot(MONDAY),
      events: started(MONDAY),
      calendar: [{ date: MONDAY, plan: { kind: 'noSession' } }],
    })
    expect(chooseKidsScreen(noSession, at(MONDAY, '07:30')).kind).toBe('session')
  })

  it('never offers the start screen again once a snapshot exists', () => {
    expect(chooseKidsScreen(data(MONDAY, { snapshot: snapshot(MONDAY) }), at(MONDAY, '07:30')).kind).toBe('calm')
  })
})

describe('startablePlan', () => {
  it('returns the plan inside the window only', () => {
    expect(startablePlan(data(MONDAY), at(MONDAY, '07:20'))?.routineId).toBe('r1')
    expect(startablePlan(data(MONDAY), at(MONDAY, '07:00'))).toBeNull()
    expect(startablePlan(data(MONDAY), at(MONDAY, '08:05'))).toBeNull()
    expect(startablePlan(data(MONDAY, { snapshot: snapshot(MONDAY) }), at(MONDAY, '07:20'))).toBeNull()
  })
})
