import { describe, expect, it } from 'vitest'
import { parseDate, weekdayOf } from './dates.ts'

describe('weekdayOf', () => {
  it('returns ISO weekdays for a known week (2026-11-16 is a Monday)', () => {
    const days = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']
    expect(days.map(weekdayOf)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('handles the date boundaries', () => {
    expect(weekdayOf('2028-02-29')).toBe(2)
    expect(weekdayOf('2026-12-31')).toBe(4)
    expect(weekdayOf('2027-01-01')).toBe(5)
  })

  it('handles century leap rules and the epoch', () => {
    expect(weekdayOf('1970-01-01')).toBe(4)
    expect(weekdayOf('2000-02-29')).toBe(2)
    expect(weekdayOf('1969-12-31')).toBe(3)
  })
})

describe('parseDate', () => {
  it('parses a real date', () => {
    expect(parseDate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 })
  })

  it.each(['2026-13-40', '16-11-2026', '2026-02-30', '2027-02-29', '1900-02-29', '2026-00-10', '2026-04-31', '2026-06-31', '2026-09-31', '2026-11-31'])(
    'throws RangeError for %s',
    (date) => {
      expect(() => parseDate(date)).toThrow(RangeError)
      expect(() => weekdayOf(date)).toThrow(RangeError)
    },
  )

  it.each(['', '2026-1-1', '2026-11-16 ', ' 2026-11-16', '2026-11-16T00:00', '2026/11/16', '+2026-11-16'])(
    'throws RangeError for malformed %j',
    (date) => {
      expect(() => parseDate(date)).toThrow(RangeError)
    },
  )
})
