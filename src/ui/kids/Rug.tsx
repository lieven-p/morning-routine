import type { CSSProperties } from 'react'
import { copy } from '../copy.nl-BE.ts'
import { TOYS_BOTTOM, TOYS_TOP } from './pictures.ts'
import { sunBackground, type RugState } from './rug.ts'
import { RUG } from './trail.ts'

interface RugProps {
  state: RugState
  /** Avatar picture per child id. */
  avatars: ReadonlyMap<string, string>
}

/**
 * The indoor speeltijd rug (DESIGN.md, speeltijd-rug). Empty: toys and the "speeltijd" plank. With children on it:
 * their avatars, "Klaar! Nu mag je spelen" and a sun each that empties towards the nudge; the minutes are small print
 * for the parents. From the nudge on the whole rug fades.
 */
export function Rug({ state, avatars }: RugProps) {
  const style: CSSProperties = { left: RUG.left, top: RUG.top, width: RUG.size, height: RUG.size }
  return (
    <div className={state.faded ? 'kids-rug faded' : 'kids-rug'} style={style}>
      {state.children.length === 0 ? (
        <>
          <span className="kids-rug-toys">
            {TOYS_TOP}
            <br />
            {TOYS_BOTTOM}
          </span>
          <span className="kids-rug-plank">{copy.session.playtimeLabel}</span>
        </>
      ) : (
        <>
          <span className="kids-rug-kids">
            {state.children.map((child) => (
              <span key={child.childId} className="kids-rug-kid">
                <span className="kids-avatar small">{avatars.get(child.childId)}</span>
                <span className="kids-sun" style={{ background: sunBackground(child.fractionLeft) }} />
                <span className="kids-rug-minutes">{copy.kids.playtimeLeft(child.minutesLeft)}</span>
              </span>
            ))}
          </span>
          <span className="kids-rug-text">{copy.session.childDone}</span>
        </>
      )}
    </div>
  )
}
