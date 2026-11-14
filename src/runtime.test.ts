import { describe, expect, it } from 'vitest'
import { DATABASE_NAME, DEV_DATABASE_NAME } from './adapters/db/index.ts'
import { resolveRuntime, withoutDevReset } from './runtime.ts'

describe('resolveRuntime', () => {
  it('uses the real clock and the real database without parameters', () => {
    expect(resolveRuntime('')).toEqual({ dev: null, databaseName: DATABASE_NAME, reset: false })
  })

  it('uses the dev clock and the dev database for a valid devNow', () => {
    const runtime = resolveRuntime('?devNow=2026-11-16T07:15&devSpeed=20')
    expect(runtime.dev).toMatchObject({ speed: 20, reset: false })
    expect(runtime.databaseName).toBe(DEV_DATABASE_NAME)
    expect(runtime.reset).toBe(false)
  })

  it('resets only the dev database, and only with devNow', () => {
    const runtime = resolveRuntime('?devNow=2026-11-16T07:15&devReset')
    expect(runtime).toMatchObject({ databaseName: DEV_DATABASE_NAME, reset: true })
    expect(resolveRuntime('?devReset')).toEqual({ dev: null, databaseName: DATABASE_NAME, reset: false })
  })

  it.each(['?devNow=nonsense', '?devNow=2026-13-40T07:15', '?devNow=2026-11-16', '?devSpeed=20'])(
    'ignores %s and keeps the real clock and database, even with devReset',
    (search) => {
      expect(resolveRuntime(`${search}&devReset`)).toEqual({ dev: null, databaseName: DATABASE_NAME, reset: false })
    },
  )
})

describe('withoutDevReset', () => {
  it('drops devReset and keeps the other parameters', () => {
    expect(withoutDevReset('?devNow=2026-11-16T07:15&devReset&devSpeed=20')).toBe('?devNow=2026-11-16T07:15&devSpeed=20')
    expect(withoutDevReset('?devReset=1&devNow=2026-11-16T07:15')).toBe('?devNow=2026-11-16T07:15')
    expect(withoutDevReset('?devReset')).toBe('')
    expect(withoutDevReset('')).toBe('')
  })
})
