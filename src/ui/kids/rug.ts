import type { SessionView } from '../../domain/types.ts'

const MINUTE_MS = 60_000

export interface RugChild {
  childId: string
  /** The speeltijd sun: `remainingMs / earnedMs`, 1 to 0. */
  fractionLeft: number
  /** Minutes left for the parents' small print, rounded up; children never see it. */
  minutesLeft: number
}

export interface RugState {
  /** From the nudge on the rug fades (35 % opacity, 70 % greyscale). */
  faded: boolean
  /** The children on the rug, in lane order. */
  children: RugChild[]
}

/** Who is on the rug and how it looks, from the derived view only. */
export function rugState(view: Pick<SessionView, 'phase' | 'children'>): RugState {
  return {
    faded: view.phase === 'departure',
    children: view.children
      .filter((lane) => lane.speeltijd.onRug)
      .map((lane) => {
        const { earnedMs, remainingMs } = lane.speeltijd
        return {
          childId: lane.childId,
          fractionLeft: earnedMs > 0 ? Math.min(1, Math.max(0, remainingMs / earnedMs)) : 0,
          minutesLeft: Math.max(1, Math.ceil(remainingMs / MINUTE_MS)),
        }
      }),
  }
}

/** CSS background of the speeltijd sun: a gold pie that empties clockwise from 12 o'clock, like the ring. */
export function sunBackground(fractionLeft: number): string {
  const fraction = Number.isFinite(fractionLeft) ? Math.min(1, Math.max(0, fractionLeft)) : 0
  const goneAt = ((1 - fraction) * 100).toFixed(1)
  return `conic-gradient(rgb(255 255 255 / 60%) 0 ${goneAt}%, var(--sun-gold) ${goneAt}% 100%)`
}
