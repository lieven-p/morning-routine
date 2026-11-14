import type { CSSProperties } from 'react'
import type { DaySnapshot, SessionView } from '../../domain/types.ts'
import { copy } from '../copy.nl-BE.ts'
import { BridgeDeck } from './BridgeScene.tsx'
import { avatarPicture, CAR, companionPicture, FLOWER, NUDGE_FLAG, WAVE } from './pictures.ts'

interface DepartureScreenProps {
  snapshot: DaySnapshot
  view: SessionView
  onDeparted: () => void
}

/** A fixed few flowers along the path: decoration, never a score. */
const FLOWERS = [
  { left: 90, top: 520 },
  { left: 520, top: 566 },
  { left: 860, top: 510 },
]

const STRIP = { left: 352, top: 450, width: 320, height: 84 }
const DECK = { left: 372, top: 461, width: 280, height: 62, maxSlotWidth: 22 }

/**
 * The departure screen (EXPERIENCE.md, Ended): "Jas aan, we vertrekken!" whatever happened, the big car, the companion
 * waving, both children, a bridge strip with the collected planks and neutral grey fillers in the gaps, and the
 * parent-only "We zijn vertrokken" in small dull grey text. No red, nothing missing, no failure wording.
 */
export function DepartureScreen({ snapshot, view, onDeparted }: DepartureScreenProps) {
  return (
    <div className="kids-departure-screen">
      <svg className="kids-paths faint" viewBox="0 0 1024 640">
        <path className="kids-lane" d="M60 560 C260 520 420 600 620 560 S820 520 1000 540" />
      </svg>

      <div className="kids-banner">
        <span>{NUDGE_FLAG}</span>
        {copy.session.departure}
      </div>

      <span className="kids-big-car">{CAR}</span>
      <span className="kids-departure-companion">{companionPicture(view.companionId ?? '')}</span>
      <span className="kids-wave">{WAVE}</span>

      {snapshot.children.map((child, index) => (
        <span
          key={child.id}
          className="kids-avatar large"
          style={{ left: 270 - index * 80, top: 380 - (index % 2) * 10 } as CSSProperties}
        >
          {avatarPicture(child.avatar)}
        </span>
      ))}

      <span className="kids-strip" style={STRIP} />
      <BridgeDeck bridge={view.bridge} {...DECK} />

      {FLOWERS.map((flower) => (
        <span key={flower.left} className="kids-decor-flower" style={flower}>
          {FLOWER}
        </span>
      ))}

      <button type="button" className="kids-parent-departed" onClick={onDeparted}>
        {copy.parent.departed}
      </button>
    </div>
  )
}
