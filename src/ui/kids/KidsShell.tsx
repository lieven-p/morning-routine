import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { chooseKidsScreen } from '../../app/kids-screen.ts'
import { loadKidsData } from '../../app/load-kids-data.ts'
import { createSessionCommands } from '../../app/session-commands.ts'
import { localDateString } from '../../domain/dates.ts'
import { useAppServices } from '../app-context.ts'
import { CalmScreen } from './CalmScreen.tsx'
import { ScaledCanvas } from './ScaledCanvas.tsx'
import { SessionScreen } from './SessionScreen.tsx'
import { StartScreen } from './StartScreen.tsx'
import { useNow } from './use-now.ts'
import './kids.css'

// KidsShell never shows an error state: a command that fails changes nothing on screen. It is logged for diagnosis.
const ignoreFailure = (command: Promise<void>): void => {
  command.catch((error: unknown) => console.error('Session command failed', error))
}

/** The children's side: start, session path and calm screen. It reads live data and only issues session commands (AD-10). */
export function KidsShell() {
  const { repository, clock } = useAppServices()
  const now = useNow(clock)
  const date = localDateString(now)
  const data = useLiveQuery(() => loadKidsData(repository, date), [repository, date])
  const commands = useMemo(() => createSessionCommands(repository, clock), [repository, clock])

  const screen = data && data.date === date ? chooseKidsScreen(data, now) : null

  return (
    <ScaledCanvas>
      {screen?.kind === 'start' && (
        <StartScreen plan={screen.plan} kids={data!.children} onStart={(companionId) => ignoreFailure(commands.startSession(companionId))} />
      )}
      {screen?.kind === 'session' && (
        <SessionScreen
          snapshot={screen.snapshot}
          view={screen.view}
          now={now}
          onTick={(stoneId) => ignoreFailure(commands.tickStone(stoneId))}
          onUntick={(stoneId) => ignoreFailure(commands.untickStone(stoneId))}
        />
      )}
      {screen?.kind === 'calm' && <CalmScreen companionId={screen.companionId} />}
    </ScaledCanvas>
  )
}
