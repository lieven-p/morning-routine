import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { createRepository, deleteDatabase } from './adapters/db/index.ts'
import { createDevClock, systemClock } from './adapters/device/clock.ts'
import { requestPersistentStorage } from './adapters/device/persistent-storage.ts'
import { seedSampleFamily } from './app/sample-data.ts'
import { resolveRuntime, withoutDevReset } from './runtime.ts'

// Development clock: `?devNow=...` shifts time and switches to a separate database, so real data is never touched.
// Without valid parameters the real clock and the real database are used.
const { dev, databaseName, reset } = resolveRuntime(window.location.search)
const clock = dev ? createDevClock(dev.startMs, dev.speed) : systemClock

const startDatabase = async () => {
  try {
    if (reset) {
      await deleteDatabase(databaseName)
      // Drop `devReset` from the address so a reload keeps the stored morning instead of wiping it again.
      window.history.replaceState(null, '', `${window.location.pathname}${withoutDevReset(window.location.search)}${window.location.hash}`)
    }
  } catch (error: unknown) {
    console.error('Resetting the development database failed', error)
  }
  const repository = createRepository(databaseName, clock.now)
  try {
    // Opening the database creates it at the current schema version; the stand-in family is written only into an empty one.
    await repository.open()
    await seedSampleFamily(repository)
  } catch (error: unknown) {
    // The shell reads stored data, so a storage failure leaves the meadow without a screen; log it for diagnosis.
    console.error('Database start-up failed', error)
  }
  return repository
}

void requestPersistentStorage()

// Prompt mode: a waiting update is not applied here; story 8 applies it when no session runs.
registerSW()

void startDatabase().then((repository) =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App repository={repository} clock={clock} />
    </StrictMode>,
  ),
)
