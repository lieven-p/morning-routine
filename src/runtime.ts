import { DATABASE_NAME, DEV_DATABASE_NAME } from './adapters/db/index.ts'
import { parseDevSettings, type DevSettings } from './adapters/device/clock.ts'

export interface Runtime {
  /** The IndexedDB name: the separate development database when the dev clock is on, else the real one. */
  databaseName: string
  /** True only for a valid dev clock with `devReset`: the dev database is deleted before it opens. Never the real one. */
  reset: boolean
  /** The dev clock settings, or null for the real clock. */
  dev: DevSettings | null
}

/** Which clock and database the app runs on, from the URL search string. Bad parameters mean the real ones. */
export function resolveRuntime(search: string): Runtime {
  const dev = parseDevSettings(search)
  return { dev, databaseName: dev ? DEV_DATABASE_NAME : DATABASE_NAME, reset: dev?.reset ?? false }
}

/** The search string without `devReset`, so a reload after the reset keeps the stored morning. */
export function withoutDevReset(search: string): string {
  const parts = search
    .replace(/^\?/, '')
    .split('&')
    .filter((part) => part !== '' && part.split('=')[0] !== 'devReset')
  return parts.length === 0 ? '' : `?${parts.join('&')}`
}
