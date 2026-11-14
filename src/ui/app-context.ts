import { createContext, useContext } from 'react'
import type { Clock, Repository } from '../app/ports.ts'

export interface AppServices {
  repository: Repository
  clock: Clock
}

export const AppContext = createContext<AppServices | null>(null)

export function useAppServices(): AppServices {
  const services = useContext(AppContext)
  if (!services) throw new Error('AppContext is missing: wrap the shell in AppContext.Provider')
  return services
}
