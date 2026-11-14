import type { Clock } from '../../app/ports.ts'

/** The device clock. `Date.now()` is read on every call so a faked page clock (tests) is honoured. */
export const systemClock: Clock = { now: () => Date.now() }
