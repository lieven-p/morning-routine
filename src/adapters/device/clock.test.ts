import { describe, expect, it } from 'vitest'
import { localTimeMs } from '../../domain/dates.ts'
import { createDevClock, parseDevSettings, systemClock } from './clock.ts'

const MONDAY_0715 = localTimeMs('2026-11-16', '07:15')

describe('parseDevSettings', () => {
  it('reads a local start time, a speed and the reset flag', () => {
    expect(parseDevSettings('?devNow=2026-11-16T07:15&devSpeed=20&devReset')).toEqual({ startMs: MONDAY_0715, speed: 20, reset: true })
  })

  it('accepts a percent-encoded colon and defaults to speed 1 without a reset', () => {
    expect(parseDevSettings('?devNow=2026-11-16T07%3A15')).toEqual({ startMs: MONDAY_0715, speed: 1, reset: false })
  })

  it('accepts the speed limits and decimals in between', () => {
    expect(parseDevSettings('?devNow=2026-11-16T07:15&devSpeed=1')?.speed).toBe(1)
    expect(parseDevSettings('?devNow=2026-11-16T07:15&devSpeed=60')?.speed).toBe(60)
    expect(parseDevSettings('?devNow=2026-11-16T07:15&devSpeed=7.5')?.speed).toBe(7.5)
  })

  it.each(['0', '0.5', '61', '-5', 'fast', '', '1e1', 'NaN', 'Infinity'])('ignores devSpeed %j and keeps speed 1', (speed) => {
    expect(parseDevSettings(`?devNow=2026-11-16T07:15&devSpeed=${speed}`)?.speed).toBe(1)
  })

  it.each(['', '?', '?devSpeed=20', '?devReset', '?devNow=', '?devNow=soon', '?devNow=2026-11-16', '?devNow=2026-11-16T07:15:30'])(
    'returns null for %j, so the real clock and database stay',
    (search) => {
      expect(parseDevSettings(search)).toBeNull()
    },
  )

  it.each(['2026-13-16T07:15', '2026-02-30T07:15', '2026-11-16T24:00', '2026-11-16T07:60', '2026-11-16 07:15', '26-11-16T07:15'])(
    'rejects the impossible start time %s',
    (value) => {
      expect(parseDevSettings(`?devNow=${value}`)).toBeNull()
    },
  )
})

describe('createDevClock', () => {
  it('starts at the given time and runs faster than the real clock', () => {
    let real = 5_000_000
    const clock = createDevClock(MONDAY_0715, 20, () => real)
    expect(clock.now()).toBe(MONDAY_0715)
    real += 6_000
    expect(clock.now()).toBe(MONDAY_0715 + 120_000)
    real += 1_500
    expect(clock.now()).toBe(MONDAY_0715 + 150_000)
  })

  it('runs in real time at speed 1', () => {
    let real = 0
    const clock = createDevClock(MONDAY_0715, 1, () => real)
    real = 90_000
    expect(clock.now()).toBe(MONDAY_0715 + 90_000)
  })
})

describe('systemClock', () => {
  it('reads Date.now() on every call', () => {
    const before = Date.now()
    const value = systemClock.now()
    expect(value).toBeGreaterThanOrEqual(before)
    expect(value).toBeLessThanOrEqual(Date.now())
  })
})
