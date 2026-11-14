import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { createRepository } from './adapters/db/index.ts'
import { systemClock } from './adapters/device/clock.ts'
import { requestPersistentStorage } from './adapters/device/persistent-storage.ts'
import { seedSampleFamily } from './app/sample-data.ts'

// Opening the database creates it at the current schema version; the stand-in family is written only into an empty one.
const repository = createRepository()
void requestPersistentStorage()

// Prompt mode: a waiting update is not applied here; story 8 applies it when no session runs.
registerSW()

const render = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App repository={repository} clock={systemClock} />
    </StrictMode>,
  )

// The shell reads stored data, so a storage failure leaves the meadow without a screen; log it for diagnosis.
repository
  .open()
  .then(() => seedSampleFamily(repository))
  .catch((error: unknown) => console.error('Database start-up failed', error))
  .then(render)
