import { describe, expect, it } from 'vitest'
import { localDateString, localTimeMs, parseDate, weekdayOf } from './dates.ts'

describe('localDateString', () => {
  it('gives the local date, zero-padded', () => {
    expect(localDateString(new Date(2026, 0, 5, 12).getTime())).toBe('2026-01-05')
    expect(localDateString(new Date(2026, 10, 14, 21, 40).getTime())).toBe('2026-11-14')
  })

  it('switches exactly at local midnight', () => {
    expect(localDateString(new Date(2026, 10, 14, 23, 59, 59, 999).getTime())).toBe('2026-11-14')
    expect(localDateString(new Date(2026, 10, 15, 0, 0, 0, 0).getTime())).toBe('2026-11-15')
    expect(localDateString(new Date(2026, 11, 31, 23, 59).getTime())).toBe('2026-12-31')
    expect(localDateString(new Date(2027, 0, 1, 0, 0).getTime())).toBe('2027-01-01')
  })

  it('round-trips with localTimeMs', () => {
    expect(localDateString(localTimeMs('2026-11-16', '00:00'))).toBe('2026-11-16')
    expect(localDateString(localTimeMs('2026-11-16', '23:59'))).toBe('2026-11-16')
  })
})

describe('localTimeMs', () => {
  it('builds epoch ms from local date and time', () => {
    expect(localTimeMs('2026-11-16', '08:05')).toBe(new Date(2026, 10, 16, 8, 5).getTime())
    expect(localTimeMs('2026-11-16', '00:00')).toBe(new Date(2026, 10, 16).getTime())
    expect(localTimeMs('2026-11-16', '23:59')).toBe(new Date(2026, 10, 16, 23, 59).getTime())
  })

  it('is one minute per minute within a day', () => {
    expect(localTimeMs('2026-11-16', '08:05') - localTimeMs('2026-11-16', '08:00')).toBe(5 * 60_000)
  })

  it.each(['8:05', '08:5', '24:00', '12:60', '08:05:00', ' 08:05', '', '0805', '-1:00'])('throws RangeError for time %j', (time) => {
    expect(() => localTimeMs('2026-11-16', time)).toThrow(RangeError)
  })

  it.each(['2026-02-30', '16-11-2026', ''])('throws RangeError for date %j', (date) => {
    expect(() => localTimeMs(date, '08:00')).toThrow(RangeError)
  })
})

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
