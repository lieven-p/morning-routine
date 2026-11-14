import { useState, type CSSProperties } from 'react'
import { COMPANION_IDS, type CompanionId } from '../../app/companions.ts'
import type { Child, DayPlan } from '../../domain/types.ts'
import { copy } from '../copy.nl-BE.ts'
import { avatarPicture, CAR, companionPicture, SPARKLES } from './pictures.ts'

interface StartScreenProps {
  plan: DayPlan
  kids: readonly Child[]
  onStart: (companionId: CompanionId) => void
}

const TILE_LEFT = 42
const TILE_TOP = 120
const TILE_WIDTH = 140
const TILE_HEIGHT = 180
const TILE_GAP = 20
const PAD_CENTER = { x: 158, y: 518 }
const STEPPING_STONES = [
  { left: 300, top: 522 },
  { left: 420, top: 510 },
  { left: 540, top: 502 },
  { left: 660, top: 512 },
]

/** Morning start (EXPERIENCE.md, Companion tile): pick one companion together, then the big play button appears. */
export function StartScreen({ plan, kids, onStart }: StartScreenProps) {
  const [picked, setPicked] = useState<CompanionId | null>(null)
  const pickedIndex = picked === null ? -1 : COMPANION_IDS.indexOf(picked)
  const hopFrom = {
    x: TILE_LEFT + pickedIndex * (TILE_WIDTH + TILE_GAP) + TILE_WIDTH / 2 - PAD_CENTER.x,
    y: TILE_TOP + TILE_HEIGHT / 2 - PAD_CENTER.y,
  }

  return (
    <>
      <svg className="kids-paths" viewBox="0 0 1024 640">
        <path className="kids-lane faint" d="M158 518 C330 560 520 490 700 530 S820 560 870 520" />
      </svg>

      <div className="kids-plank centred">
        {kids.map((child) => (
          <span key={child.id} className="kids-avatar">
            {avatarPicture(child.avatar)}
          </span>
        ))}
      </div>

      <div className="kids-tiles">
        {COMPANION_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={picked === null ? 'kids-tile' : id === picked ? 'kids-tile selected' : 'kids-tile dimmed'}
            onClick={() => setPicked(id)}
          >
            <span className="kids-tile-animal">{companionPicture(id)}</span>
            <span className="kids-tile-label">{copy.kids.companions[id]}</span>
          </button>
        ))}
      </div>

      <span className={picked === null ? 'kids-pad' : 'kids-pad on'} />
      {STEPPING_STONES.map((position) => (
        <span key={position.left} className="kids-mini" style={position} />
      ))}
      {picked !== null && (
        <>
          <span
            key={picked}
            className="kids-hop"
            style={{ left: PAD_CENTER.x, top: PAD_CENTER.y, '--hop-x': `${hopFrom.x}px`, '--hop-y': `${hopFrom.y}px` } as CSSProperties}
          >
            {companionPicture(picked)}
          </span>
          <span key={`${picked}-a`} className="kids-sparkle" style={{ left: 96, top: 450 }}>
            {SPARKLES}
          </span>
          <span key={`${picked}-b`} className="kids-sparkle" style={{ left: 200, top: 540 }}>
            {SPARKLES}
          </span>
        </>
      )}

      <span className="kids-car faint">{CAR}</span>
      <span className="kids-departure-time">{plan.departure}</span>

      {picked !== null && <button type="button" className="kids-play-big" onClick={() => onStart(picked)} />}
    </>
  )
}
