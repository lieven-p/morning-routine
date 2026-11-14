interface PersistentStorageHost {
  storage?: { persist?: () => Promise<boolean> }
}

/** Never throws: a missing API or a rejection both mean "not persistent" (AD-11). */
export async function requestPersistentStorage(
  host: PersistentStorageHost = globalThis.navigator,
): Promise<boolean> {
  try {
    return (await host?.storage?.persist?.()) === true
  } catch {
    return false
  }
}
