import type { DateString, TimeString, Weekday } from './types.ts'

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

export interface DateParts {
  year: number
  month: number
  day: number
}

/** Parses a strict `YYYY-MM-DD` string that names a real calendar date. Throws `RangeError` otherwise. */
export function parseDate(date: DateString): DateParts {
  const match = typeof date === 'string' ? DATE_PATTERN.exec(date) : null
  if (!match) throw new RangeError(`Invalid date, expected YYYY-MM-DD: ${String(date)}`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Invalid calendar date: ${date}`)
  }
  return { year, month, day }
}

const TIME_PATTERN = /^(\d{2}):(\d{2})$/

/** Epoch ms of a local calendar date at a strict `HH:mm` time in the device's time zone. Throws `RangeError` otherwise. */
export function localTimeMs(date: DateString, time: TimeString): number {
  const { year, month, day } = parseDate(date)
  const match = typeof time === 'string' ? TIME_PATTERN.exec(time) : null
  if (!match) throw new RangeError(`Invalid time, expected HH:mm: ${String(time)}`)
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) throw new RangeError(`Invalid time of day: ${time}`)
  return new Date(year, month - 1, day, hour, minute).getTime()
}

/** Days since 1970-01-01 in the proleptic Gregorian calendar; pure arithmetic, no time zone. */
function daysSinceEpoch({ year, month, day }: DateParts): number {
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor(y / 400)
  const yearOfEra = y - era * 400
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra - 719468
}

/** ISO weekday of a local calendar date, Monday = 1 to Sunday = 7. */
export function weekdayOf(date: DateString): Weekday {
  const days = daysSinceEpoch(parseDate(date))
  // 1970-01-01 was a Thursday (4).
  return ((((days + 3) % 7) + 7) % 7 + 1) as Weekday
}
