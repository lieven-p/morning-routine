import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { createRepository, DATABASE_NAME } from './adapters/db/index.ts'
import { requestPersistentStorage } from './adapters/device/persistent-storage.ts'

// Open the database at startup so it exists at the current schema version. The
// repository is wired into the app by the first story that reads data.
createRepository(DATABASE_NAME)
  .open()
  .catch(() => undefined)
void requestPersistentStorage()

// Prompt mode: a waiting update is not applied here; story 8 applies it when no session runs.
registerSW()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
