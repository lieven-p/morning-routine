import { useEffect, useState } from 'react'
import type { Clock } from '../../app/ports.ts'

/** The current time in epoch ms, re-read every second and again when the page becomes visible. */
export function useNow(clock: Clock): number {
  const [now, setNow] = useState(() => clock.now())

  useEffect(() => {
    const refresh = () => setNow(clock.now())
    refresh()
    const interval = setInterval(refresh, 1000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [clock])

  return now
}
