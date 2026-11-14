import type { CSSProperties } from 'react'
import { hasGuideTime } from '../../app/guide-time.ts'
import type { StoneState } from '../../domain/types.ts'
import { FLOWER, SPARKLES, taskPicture } from './pictures.ts'
import { RingTimer } from './RingTimer.tsx'

interface StoneViewProps {
  state: StoneState
  left: number
  top: number
  /** Size of the stone as a share of 104 px (lanes with more than five stones shrink). */
  scale: number
  /** The owner's avatar when this is their current stone. */
  marker?: string
  onTick: (stoneId: string) => void
  onUntick: (stoneId: string) => void
  onStartTimer: (stoneId: string) => void
}

/** Buttons shrink with the stone but never below this share of their full size; their hit area still grows to 48 CSS px. */
export const MIN_BUTTON_SCALE = 0.75

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * A child's task stone (EXPERIENCE.md, State Patterns).
 * Not started: plain stone; with a guide time also a pale full ring and the round gold start button. Running: gold
 * glow and an emptying ring. Time reached: ring gone, glow, sparkles and a done button with a gold halo; the stone
 * stays open. Every open stone has the green square done button. Done: green with a flower; the whole stone is the
 * one-tap undo.
 */
export function StoneView({ state, left, top, scale, marker, onTick, onUntick, onStartTimer }: StoneViewProps) {
  const { stone, status } = state
  const slotStyle = { left, top, '--s': scale, '--btn': Math.max(scale, MIN_BUTTON_SCALE) } as CSSProperties
  const picture = <span className="kids-stone-picture">{taskPicture(stone.picture)}</span>
  const label = <span className="kids-stone-label">{stone.name}</span>

  if (status === 'done') {
    return (
      <div className="kids-slot" style={slotStyle}>
        <button type="button" className="kids-stone done" onClick={() => onUntick(stone.stoneId)}>
          {picture}
          {label}
          <span className="kids-flower">{FLOWER}</span>
        </button>
      </div>
    )
  }

  const timed = hasGuideTime(stone)
  const reached = status === 'timeReached'
  const stoneClass = reached ? 'kids-stone reached' : status === 'running' ? 'kids-stone running' : 'kids-stone'

  return (
    <div className="kids-slot" style={slotStyle}>
      <div className={stoneClass}>
        {picture}
        {label}
        {timed && !reached && <RingTimer fractionLeft={state.fractionLeft ?? 1} idle={status === 'notStarted'} />}
        {reached && (
          <>
            <span className="kids-spark" style={{ left: -16, top: -8 }}>
              {SPARKLES}
            </span>
            <span className="kids-spark late" style={{ left: 84, top: 78 }}>
              {SPARKLES}
            </span>
          </>
        )}
        {marker !== undefined && <span className="kids-marker">{marker}</span>}
      </div>
      {timed && status === 'notStarted' && (
        <button type="button" className="kids-start-button" onClick={() => onStartTimer(stone.stoneId)}>
          <span className="kids-start-face" />
        </button>
      )}
      <button type="button" className="kids-done-button" aria-label={stone.name} onClick={() => onTick(stone.stoneId)}>
        <span className={reached ? 'kids-done-face halo' : 'kids-done-face'}>
          <CheckIcon />
        </span>
      </button>
    </div>
  )
}
