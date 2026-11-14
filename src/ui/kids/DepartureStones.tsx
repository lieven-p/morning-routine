import type { CSSProperties } from 'react'
import type { StoneState } from '../../domain/types.ts'
import { departureLayout, NUDGE_GROWTH } from './departure-stones.ts'
import { FLOWER, taskPicture } from './pictures.ts'
import { CheckIcon, MIN_BUTTON_SCALE } from './StoneView.tsx'

interface DepartureStonesProps {
  stones: readonly StoneState[]
  /** Avatars of every child, shown on the stones: both children sit by them. */
  avatars: readonly string[]
  /** From the nudge on, open stones grow and glow. */
  nudged: boolean
  /** The bridge is complete and the children crossed, so no faces sit on the stones any more. */
  crossed: boolean
  onTick: (stoneId: string) => void
  onUntick: (stoneId: string) => void
}

/**
 * The shared departure stones (EXPERIENCE.md, Departure stones): one stone per task for the whole family, no ring,
 * one tap ticks, a tap on a done one undoes it. Each shows its own picture and name.
 */
export function DepartureStones({ stones, avatars, nudged, crossed, onTick, onUntick }: DepartureStonesProps) {
  const layout = departureLayout(stones.length)
  return (
    <>
      {stones.map((state, index) => {
        const { stone } = state
        const { centreX, centreY, scale } = layout[index]
        const done = state.status === 'done'
        const grown = nudged && !done
        const size = scale * (grown ? NUDGE_GROWTH : 1)
        const slotStyle = {
          left: centreX,
          top: centreY,
          '--s': size,
          '--btn': Math.max(size, MIN_BUTTON_SCALE),
        } as CSSProperties
        const bodyClass = ['kids-dep-stone', done ? 'done' : '', grown ? 'grown' : ''].filter(Boolean).join(' ')
        const content = (
          <>
            <span className="kids-dep-picture">{taskPicture(stone.picture)}</span>
            <span className="kids-stone-label">{stone.name}</span>
            {!crossed && (
              <span className="kids-duo">
                {avatars.map((avatar, avatarIndex) => (
                  <i key={avatarIndex} className="kids-duo-face">
                    {avatar}
                  </i>
                ))}
              </span>
            )}
            {done && <span className="kids-flower">{FLOWER}</span>}
          </>
        )
        return (
          <div key={stone.stoneId} className={grown ? 'kids-slot dep grown' : 'kids-slot dep'} style={slotStyle}>
            {done ? (
              <button type="button" className={bodyClass} onClick={() => onUntick(stone.stoneId)}>
                {content}
              </button>
            ) : (
              <div className={bodyClass}>{content}</div>
            )}
            {!done && (
              <button type="button" className="kids-done-button dep" aria-label={stone.name} onClick={() => onTick(stone.stoneId)}>
                <span className="kids-done-face">
                  <CheckIcon />
                </span>
              </button>
            )}
          </div>
        )
      })}
    </>
  )
}
