import type { Clock, Repository } from './app/ports.ts'
import { AppContext } from './ui/app-context.ts'
import { KidsShell } from './ui/kids/KidsShell.tsx'

export default function App({ repository, clock }: { repository: Repository; clock: Clock }) {
  return (
    <AppContext.Provider value={{ repository, clock }}>
      <KidsShell />
    </AppContext.Provider>
  )
}
