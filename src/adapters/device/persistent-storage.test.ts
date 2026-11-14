import { describe, expect, it } from 'vitest'
import { requestPersistentStorage } from './persistent-storage.ts'

describe('requestPersistentStorage', () => {
  it('returns true when persist resolves true', async () => {
    expect(await requestPersistentStorage({ storage: { persist: async () => true } })).toBe(true)
  })

  it('returns false when persist resolves false', async () => {
    expect(await requestPersistentStorage({ storage: { persist: async () => false } })).toBe(false)
  })

  it('returns false when persist rejects', async () => {
    const host = { storage: { persist: () => Promise.reject(new Error('denied')) } }
    expect(await requestPersistentStorage(host)).toBe(false)
  })

  it('returns false when persist throws synchronously', async () => {
    const host = {
      storage: {
        persist: () => {
          throw new Error('denied')
        },
      },
    }
    expect(await requestPersistentStorage(host)).toBe(false)
  })

  it('returns false when the API is missing', async () => {
    expect(await requestPersistentStorage({})).toBe(false)
    expect(await requestPersistentStorage({ storage: {} })).toBe(false)
  })
})
