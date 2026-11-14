import type { Clock } from '../../app/ports.ts'
import { localTimeMs } from '../../domain/dates.ts'

/** The device clock. `Date.now()` is read on every call so a faked page clock (tests) is honoured. */
export const systemClock: Clock = { now: () => Date.now() }

export const MIN_DEV_SPEED = 1
export const MAX_DEV_SPEED = 60

/** What the development URL parameters ask for: a start time, a speed and whether to wipe the dev database first. */
export interface DevSettings {
  /** Epoch ms of `devNow`. */
  startMs: number
  speed: number
  reset: boolean
}

const DEV_NOW_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/
const NUMBER_PATTERN = /^\d+(\.\d+)?$/

function parseDevNow(value: string | null): number | null {
  const match = value === null ? null : DEV_NOW_PATTERN.exec(value)
  if (!match) return null
  try {
    return localTimeMs(match[1], match[2])
  } catch {
    return null
  }
}

function parseDevSpeed(value: string | null): number {
  if (value === null || !NUMBER_PATTERN.test(value)) return MIN_DEV_SPEED
  const speed = Number(value)
  return speed >= MIN_DEV_SPEED && speed <= MAX_DEV_SPEED ? speed : MIN_DEV_SPEED
}

/**
 * Reads `devNow` (local `YYYY-MM-DDTHH:mm`), `devSpeed` (1 to 60) and `devReset` from a URL search string. Returns null
 * unless `devNow` is valid: bad values are ignored, so the app keeps the real clock and the real database. A bad or
 * missing `devSpeed` means 1; `devReset` counts when present.
 */
export function parseDevSettings(search: string): DevSettings | null {
  const params = new URLSearchParams(search)
  const startMs = parseDevNow(params.get('devNow'))
  if (startMs === null) return null
  return { startMs, speed: parseDevSpeed(params.get('devSpeed')), reset: params.has('devReset') }
}

/** A clock that reads `startMs` now and then runs `speed` times faster than `realNow`. */
export function createDevClock(startMs: number, speed: number, realNow: () => number = () => Date.now()): Clock {
  const realStart = realNow()
  return { now: () => startMs + (realNow() - realStart) * speed }
}
