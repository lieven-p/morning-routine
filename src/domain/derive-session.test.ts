import { describe, expect, it } from 'vitest'
import { localTimeMs } from './dates.ts'
import { deriveSession, hasGuideTime } from './derive-session.ts'
import type { DaySnapshot, SessionEvent, SessionView, Stone } from './types.ts'

const DATE = '2026-11-16'
const MIN = 60_000

const at = (time: string): number => localTimeMs(DATE, time)

const stone = (stoneId: string, owner: Stone['owner'], guideMinutes?: number): Stone => ({
  stoneId,
  owner,
  name: stoneId,
  ...(guideMinutes === undefined ? {} : { guideMinutes }),
})

function makeSnapshot(overrides: Partial<DaySnapshot> = {}): DaySnapshot {
  return {
    date: DATE,
    start: '07:00',
    departure: '08:05',
    soundOn: true,
    children: [
      { id: 'a', name: 'Anna' },
      { id: 'b', name: 'Bram' },
    ],
    stones: [
      stone('a1', { kind: 'child', childId: 'a' }),
      stone('a2', { kind: 'child', childId: 'a' }, 2),
      stone('b1', { kind: 'child', childId: 'b' }),
      stone('d1', { kind: 'departure' }, 2),
      stone('d2', { kind: 'departure' }, 3),
    ],
    ...overrides,
  }
}

let seqCounter = 0

type Draft =
  | { kind: 'sessionStarted'; companionId: string }
  | { kind: 'timerStarted'; stoneId: string }
  | { kind: 'taskTicked'; stoneId: string }
  | { kind: 'taskUnticked'; stoneId: string }
  | { kind: 'departedTapped' }

function ev(draft: Draft, time: string | number, seq?: number, date = DATE): SessionEvent {
  seqCounter += 1
  return { ...draft, date, at: typeof time === 'number' ? time : at(time), seq: seq ?? seqCounter } as SessionEvent
}

const started = (time = '07:00') => ev({ kind: 'sessionStarted', companionId: 'fox' }, time)
const tick = (stoneId: string, time: string | number) => ev({ kind: 'taskTicked', stoneId }, time)
const untick = (stoneId: string, time: string | number) => ev({ kind: 'taskUnticked', stoneId }, time)
const timer = (stoneId: string, time: string | number) => ev({ kind: 'timerStarted', stoneId }, time)
const departed = (time: string | number) => ev({ kind: 'departedTapped' }, time)

const statusOf = (view: SessionView, stoneId: string) =>
  [...view.children.flatMap((child) => child.stones), ...view.departureStones].find((state) => state.stone.stoneId === stoneId)

const cueIds = (view: SessionView) => view.cues.map((cue) => cue.id)
const lane = (view: SessionView, childId: string) => view.children.find((child) => child.childId === childId)!

describe('hasGuideTime', () => {
  it.each([
    [undefined, false],
    [0, false],
    [-1, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
    [0.5, true],
    [2, true],
  ])('guideMinutes %s gives %s, in step with the timer derivation', (guideMinutes, expected) => {
    const stoneWith = { ...stone('t1', { kind: 'child', childId: 'a' }), ...(guideMinutes === undefined ? {} : { guideMinutes }) }
    expect(hasGuideTime(stoneWith)).toBe(expected)
    const view = deriveSession(makeSnapshot({ stones: [stoneWith] }), [started(), timer('t1', '07:10')], at('07:11'))
    expect(statusOf(view, 't1')?.status !== 'notStarted').toBe(expected)
  })
})

describe('deriveSession', () => {
  it('not started: no events', () => {
    const view = deriveSession(makeSnapshot(), [], at('07:30'))
    expect(view.phase).toBe('notStarted')
    expect(view.companionId).toBeNull()
    for (const id of ['a1', 'a2', 'b1', 'd1', 'd2']) expect(statusOf(view, id)?.status).toBe('notStarted')
    expect(view.cues).toEqual([])
    expect(view.bridge).toEqual({ planks: 0, total: 5, complete: false, fillers: 0 })
    expect(view.onTime).toBe(false)
  })

  it('reports the companion and the timeline', () => {
    const view = deriveSession(makeSnapshot(), [started()], at('07:32'))
    expect(view.companionId).toBe('fox')
    expect(view.timeline).toMatchObject({
      startAt: at('07:00'),
      nudgeAt: at('08:00'),
      departureAt: at('08:05'),
      cutoffAt: at('08:05'),
      departedAt: null,
      remainingMs: 33 * MIN,
    })
    expect(view.timeline.progress).toBeCloseTo(32 / 65)
  })

  it('running in any order: current stone is the first not-done, bridge planks match', () => {
    const events = [started(), tick('a2', '07:10'), tick('d1', '07:12'), tick('b1', '07:13')]
    const view = deriveSession(makeSnapshot(), events, at('07:20'))
    expect(view.phase).toBe('running')
    expect(lane(view, 'a').currentStoneId).toBe('a1')
    expect(lane(view, 'b').currentStoneId).toBeNull()
    expect(view.bridge).toMatchObject({ planks: 3, total: 5, complete: false, fillers: 0 })
  })

  it('undo: tick then untick returns the stone, drops the plank and keeps the tick cue', () => {
    const events = [started(), tick('a1', '07:10'), untick('a1', '07:11')]
    const view = deriveSession(makeSnapshot(), events, at('07:20'))
    expect(statusOf(view, 'a1')?.status).toBe('notStarted')
    expect(view.bridge.planks).toBe(0)
    expect(cueIds(view)).toEqual([`tick:${events[1]!.seq}`])
  })

  it('timed stone: running with remaining and fraction, then timeReached while still open', () => {
    const events = [started(), timer('a2', '07:10')]
    const running = statusOf(deriveSession(makeSnapshot(), events, at('07:10') + 30_000), 'a2')!
    expect(running.status).toBe('running')
    expect(running.remainingMs).toBe(90_000)
    expect(running.fractionLeft).toBeCloseTo(0.75)

    const reached = deriveSession(makeSnapshot(), events, at('07:12'))
    expect(statusOf(reached, 'a2')).toMatchObject({ status: 'timeReached', remainingMs: 0, fractionLeft: 0 })
    expect(lane(reached, 'a').currentStoneId).toBe('a1')
    expect(reached.cues).toEqual([])
  })

  it('a timeReached stone stays open until ticked', () => {
    const events = [started(), tick('a1', '07:05'), timer('a2', '07:10')]
    const view = deriveSession(makeSnapshot(), events, at('07:50'))
    expect(lane(view, 'a').currentStoneId).toBe('a2')
    expect(lane(view, 'a').finishedAt).toBeNull()
  })

  it('tick without start: a timed stone is done', () => {
    const view = deriveSession(makeSnapshot(), [started(), tick('a2', '07:10')], at('07:11'))
    expect(statusOf(view, 'a2')).toMatchObject({ status: 'done', remainingMs: null, fractionLeft: null })
  })

  it('timer reset: start, tick, untick leaves no timer', () => {
    const events = [started(), timer('a2', '07:10'), tick('a2', '07:11'), untick('a2', '07:12')]
    const view = deriveSession(makeSnapshot(), events, at('07:30'))
    expect(statusOf(view, 'a2')).toMatchObject({ status: 'notStarted', timerStartedAt: null, remainingMs: null })
  })

  it('timer ignored: no guide time, repeated start, start after tick', () => {
    const noGuide = deriveSession(makeSnapshot(), [started(), timer('a1', '07:10')], at('07:20'))
    expect(statusOf(noGuide, 'a1')).toMatchObject({ status: 'notStarted', timerStartedAt: null })

    const repeated = deriveSession(makeSnapshot(), [started(), timer('a2', '07:10'), timer('a2', '07:11')], at('07:11'))
    expect(statusOf(repeated, 'a2')?.timerStartedAt).toBe(at('07:10'))

    const afterTick = deriveSession(makeSnapshot(), [started(), tick('a2', '07:10'), timer('a2', '07:11')], at('07:20'))
    expect(statusOf(afterTick, 'a2')?.status).toBe('done')
  })

  it('child finishes 12 minutes before the nudge: on the rug, counting down, with a childDone cue', () => {
    const events = [started(), tick('b1', '07:48')]
    const view = deriveSession(makeSnapshot(), events, at('07:50'))
    expect(lane(view, 'b')).toMatchObject({
      finishedAt: at('07:48'),
      currentStoneId: null,
      speeltijd: { onRug: true, earnedMs: 12 * MIN, remainingMs: 10 * MIN },
    })
    expect(cueIds(view)).toContain(`childDone:b:${events[1]!.seq}`)
    expect(lane(view, 'a').speeltijd).toEqual({ onRug: false, earnedMs: 0, remainingMs: 0 })
  })

  it('speeltijd ends at the nudge but the earned time stays', () => {
    const view = deriveSession(makeSnapshot(), [started(), tick('b1', '07:48')], at('08:01'))
    expect(lane(view, 'b').speeltijd).toEqual({ onRug: false, earnedMs: 12 * MIN, remainingMs: 0 })
  })

  it('finish then undo: off the rug, finishedAt cleared; finishing again restarts speeltijd', () => {
    const events = [started(), tick('b1', '07:40'), untick('b1', '07:42')]
    const undone = deriveSession(makeSnapshot(), events, at('07:43'))
    expect(lane(undone, 'b')).toMatchObject({ finishedAt: null, currentStoneId: 'b1' })
    expect(lane(undone, 'b').speeltijd.onRug).toBe(false)

    const again = deriveSession(makeSnapshot(), [...events, tick('b1', '07:45')], at('07:46'))
    expect(lane(again, 'b')).toMatchObject({
      finishedAt: at('07:45'),
      speeltijd: { onRug: true, earnedMs: 15 * MIN, remainingMs: 14 * MIN },
    })
  })

  it('finish after the nudge: not on the rug, earns nothing, no childDone cue', () => {
    const events = [started(), tick('b1', '08:01')]
    const view = deriveSession(makeSnapshot(), events, at('08:02'))
    expect(lane(view, 'b')).toMatchObject({
      finishedAt: at('08:01'),
      speeltijd: { onRug: false, earnedMs: 0, remainingMs: 0 },
    })
    expect(cueIds(view).some((id) => id.startsWith('childDone'))).toBe(false)
  })

  it('a child without own stones never finishes', () => {
    const snapshot = makeSnapshot({ stones: [stone('d1', { kind: 'departure' }, 2)] })
    const view = deriveSession(snapshot, [started(), tick('d1', '07:10')], at('07:20'))
    expect(lane(view, 'a')).toMatchObject({ finishedAt: null, currentStoneId: null, stones: [] })
    expect(lane(view, 'a').speeltijd.onRug).toBe(false)
    expect(cueIds(view).some((id) => id.startsWith('childDone'))).toBe(false)
  })

  it('nudge: departure stones 2 + 3 minutes before 08:05 gives 08:00', () => {
    expect(deriveSession(makeSnapshot(), [started()], at('07:10')).timeline.nudgeAt).toBe(at('08:00'))
  })

  it('nudge is clamped to the session start when the guide times exceed the window', () => {
    const snapshot = makeSnapshot({
      start: '08:00',
      stones: [stone('d1', { kind: 'departure' }, 30), stone('a1', { kind: 'child', childId: 'a' })],
    })
    const view = deriveSession(snapshot, [started('08:00')], at('08:01'))
    expect(view.timeline.nudgeAt).toBe(at('08:00'))
    expect(view.phase).toBe('departure')
  })

  it('phases: running before the nudge, departure from the nudge, ended at departure', () => {
    const events = [started()]
    expect(deriveSession(makeSnapshot(), events, at('07:59')).phase).toBe('running')
    expect(deriveSession(makeSnapshot(), events, at('08:00')).phase).toBe('departure')
    expect(deriveSession(makeSnapshot(), events, at('08:04')).phase).toBe('departure')
    expect(deriveSession(makeSnapshot(), events, at('08:05')).phase).toBe('ended')
  })

  it('bridge complete: last stone before departure gives teamGoal and onTime once ended', () => {
    const events = [
      started(),
      tick('a1', '07:10'),
      tick('a2', '07:11'),
      tick('b1', '07:12'),
      tick('d1', '07:13'),
      tick('d2', '07:14'),
    ]
    const live = deriveSession(makeSnapshot(), events, at('07:30'))
    expect(live.bridge).toEqual({ planks: 5, total: 5, complete: true, fillers: 0 })
    expect(live.onTime).toBe(false)
    expect(cueIds(live)).toContain(`teamGoal:${events[5]!.seq}`)

    const ended = deriveSession(makeSnapshot(), events, at('08:05'))
    expect(ended.onTime).toBe(true)
    expect(ended.bridge.fillers).toBe(0)
  })

  it('departure first: ended, not complete, fillers for the open stones, planks kept, no cue for it', () => {
    const events = [started(), tick('a1', '07:10'), tick('d1', '07:11')]
    const view = deriveSession(makeSnapshot(), events, at('08:30'))
    expect(view.phase).toBe('ended')
    expect(view.bridge).toEqual({ planks: 2, total: 5, complete: false, fillers: 3 })
    expect(view.onTime).toBe(false)
    expect(cueIds(view).some((id) => id.startsWith('teamGoal'))).toBe(false)
  })

  it('early departed tap: cutoff at the tap, ended from then, later events ignored', () => {
    const events = [started(), tick('a1', '07:10'), departed('08:04'), tick('b1', at('08:04') + 30_000)]
    const view = deriveSession(makeSnapshot(), events, at('08:04') + 10_000)
    expect(view.phase).toBe('ended')
    expect(view.timeline).toMatchObject({ cutoffAt: at('08:04'), departedAt: at('08:04') })
    expect(view.bridge).toMatchObject({ planks: 1, fillers: 4 })
    expect(view.onTime).toBe(false)
  })

  it('early departed tap with a complete bridge is on time', () => {
    const events = [
      started(),
      tick('a1', '07:10'),
      tick('a2', '07:11'),
      tick('b1', '07:12'),
      tick('d1', '07:13'),
      tick('d2', '07:14'),
      departed('07:50'),
    ]
    const view = deriveSession(makeSnapshot(), events, at('09:00'))
    expect(view.onTime).toBe(true)
    expect(view.phase).toBe('ended')
  })

  it('early departed tap stops speeltijd at the tap', () => {
    const events = [started(), tick('b1', '07:30'), departed('07:50')]
    const live = deriveSession(makeSnapshot(), [started(), tick('b1', '07:30')], at('07:40'))
    expect(lane(live, 'b').speeltijd).toEqual({ onRug: true, earnedMs: 30 * MIN, remainingMs: 20 * MIN })
    const after = deriveSession(makeSnapshot(), events, at('09:00'))
    expect(lane(after, 'b').speeltijd).toEqual({ onRug: false, earnedMs: 20 * MIN, remainingMs: 0 })
  })

  it('events at the cutoff are ignored', () => {
    const events = [started(), tick('a1', '08:05'), tick('b1', '07:50'), departed('07:55'), tick('a2', '07:55')]
    const view = deriveSession(makeSnapshot(), events, at('08:10'))
    expect(statusOf(view, 'a1')?.status).toBe('notStarted')
    expect(statusOf(view, 'b1')?.status).toBe('done')
    expect(statusOf(view, 'a2')?.status).toBe('notStarted')
    const atDeparture = deriveSession(makeSnapshot(), [started(), tick('a1', '08:05')], at('08:10'))
    expect(atDeparture.bridge.planks).toBe(0)
  })

  it('tap after departure: cutoff stays at departure, departedAt is null', () => {
    const events = [started(), tick('a1', '07:10'), departed('08:07')]
    const view = deriveSession(makeSnapshot(), events, at('08:10'))
    expect(view.timeline).toMatchObject({ cutoffAt: at('08:05'), departedAt: null })
    expect(view.phase).toBe('ended')
  })

  it('orders by seq, not by at', () => {
    const events = [
      ev({ kind: 'sessionStarted', companionId: 'fox' }, '07:00', 1),
      ev({ kind: 'taskTicked', stoneId: 'a1' }, '07:30', 2),
      ev({ kind: 'taskUnticked', stoneId: 'a1' }, '07:10', 3),
    ]
    const view = deriveSession(makeSnapshot(), events, at('07:40'))
    expect(statusOf(view, 'a1')?.status).toBe('notStarted')
    const reversed = deriveSession(makeSnapshot(), [...events].reverse(), at('07:40'))
    expect(reversed).toEqual(view)
  })

  it('ignores events of another date and unknown stones', () => {
    const events = [
      started(),
      ev({ kind: 'taskTicked', stoneId: 'a1' }, '07:10', undefined, '2026-11-15'),
      ev({ kind: 'departedTapped' }, '07:10', undefined, '2026-11-15'),
      tick('ghost', '07:11'),
      timer('ghost', '07:11'),
    ]
    const view = deriveSession(makeSnapshot(), events, at('07:20'))
    expect(view.bridge.planks).toBe(0)
    expect(view.phase).toBe('running')
    expect(view.timeline.departedAt).toBeNull()
    expect(view.cues).toEqual([])
  })

  it('cues: due only after their time, stable ids, no duplicates', () => {
    const events = [started()]
    const snapshot = makeSnapshot()
    expect(cueIds(deriveSession(snapshot, events, at('07:54')))).toEqual([])
    expect(cueIds(deriveSession(snapshot, events, at('07:55')))).toEqual(['warn10'])
    expect(cueIds(deriveSession(snapshot, events, at('07:59')))).toEqual(['warn10'])
    expect(cueIds(deriveSession(snapshot, events, at('08:00')))).toEqual(['warn10', 'nudge', 'warn5'])
    expect(cueIds(deriveSession(snapshot, events, at('08:00') + 1))).toEqual(['warn10', 'nudge', 'warn5'])
    expect(cueIds(deriveSession(snapshot, events, at('08:00') + 1))).toEqual(cueIds(deriveSession(snapshot, events, at('08:02'))))

    const all = deriveSession(snapshot, events, at('08:05'))
    expect(all.cues.map((cue) => [cue.id, cue.at])).toEqual([
      ['warn10', at('07:55')],
      ['nudge', at('08:00')],
      ['warn5', at('08:00')],
      ['departure', at('08:05')],
    ])
    expect(new Set(cueIds(all)).size).toBe(all.cues.length)
  })

  it('tick cue ids use the event seq and do not depend on now', () => {
    const events = [started(), tick('a1', '07:10')]
    const early = deriveSession(makeSnapshot(), events, at('07:11'))
    const late = deriveSession(makeSnapshot(), events, at('07:40'))
    expect(early.cues).toEqual([{ id: `tick:${events[1]!.seq}`, kind: 'tick', at: at('07:10'), stoneId: 'a1' }])
    expect(late.cues).toEqual(early.cues)
  })

  it('a repeated tick on a done stone makes no cue; an untick makes none', () => {
    const events = [started(), tick('a1', '07:10'), tick('a1', '07:11'), untick('a1', '07:12'), untick('b1', '07:13')]
    expect(cueIds(deriveSession(makeSnapshot(), events, at('07:20')))).toEqual([`tick:${events[1]!.seq}`])
  })

  it('frozen history: deriving long after departure equals deriving at the cutoff', () => {
    const events = [started(), tick('a1', '07:10'), tick('b1', '07:30'), departed('08:02')]
    const atCutoff = deriveSession(makeSnapshot(), events, at('08:02'))
    expect(deriveSession(makeSnapshot(), events, at('08:02') + 5 * 24 * 60 * MIN)).toEqual(atCutoff)

    const natural = [started(), tick('a1', '07:10'), tick('b1', '07:30')]
    expect(deriveSession(makeSnapshot(), natural, at('08:05') + 7 * 24 * 60 * MIN)).toEqual(
      deriveSession(makeSnapshot(), natural, at('08:05')),
    )
  })

  it('frozen history keeps an open timer and adds no cue after an early tap', () => {
    const events = [started(), timer('a2', '07:40'), departed('07:41')]
    const atCutoff = deriveSession(makeSnapshot(), events, at('07:41'))
    const later = deriveSession(makeSnapshot(), events, at('09:00'))
    expect(later).toEqual(atCutoff)
    expect(statusOf(later, 'a2')).toMatchObject({ status: 'running', remainingMs: MIN })
    expect(cueIds(later)).toEqual([])
  })

  it('purity: frozen inputs are not mutated', () => {
    const snapshot = makeSnapshot()
    const events = [started(), tick('b1', '07:30'), departed('08:00'), untick('b1', '07:31')]
    const deepFreeze = <T,>(value: T): T => {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(deepFreeze)
        Object.freeze(value)
      }
      return value
    }
    deepFreeze(snapshot)
    deepFreeze(events)
    const copy = JSON.stringify([snapshot, events])
    const first = deriveSession(snapshot, events, at('08:30'))
    expect(deriveSession(snapshot, events, at('08:30'))).toEqual(first)
    expect(JSON.stringify([snapshot, events])).toBe(copy)
  })

  it('throws RangeError for invalid snapshot dates or times', () => {
    expect(() => deriveSession(makeSnapshot({ start: '7:00' }), [], 0)).toThrow(RangeError)
    expect(() => deriveSession(makeSnapshot({ departure: '25:00' }), [], 0)).toThrow(RangeError)
    expect(() => deriveSession(makeSnapshot({ date: '2026-02-30' }), [], 0)).toThrow(RangeError)
  })

  it('shuffling events never changes the view', () => {
    const events = [
      started(),
      timer('a2', '07:05'),
      tick('a1', '07:10'),
      tick('a2', '07:20'),
      tick('b1', '07:25'),
      untick('b1', '07:26'),
      tick('b1', '07:40'),
      tick('d1', '07:45'),
      tick('ghost', '07:46'),
      departed('08:02'),
      tick('d2', '08:03'),
    ]
    const snapshot = makeSnapshot()
    const expected = deriveSession(snapshot, events, at('08:10'))

    let state = 12345
    const random = () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return state / 4294967296
    }
    for (let round = 0; round < 50; round += 1) {
      const shuffled = [...events]
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
      }
      expect(deriveSession(snapshot, shuffled, at('08:10'))).toEqual(expected)
    }
  })
})
