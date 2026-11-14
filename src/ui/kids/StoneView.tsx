import type { StoneState } from '../../domain/types.ts'
import { FLOWER, taskPicture } from './pictures.ts'

interface StoneViewProps {
  state: StoneState
  left: number
  top: number
  /** The owner's avatar when this is their current stone. */
  marker?: string
  onTick: (stoneId: string) => void
  onUntick: (stoneId: string) => void
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * A task stone. Not done: the stone body does nothing yet and the green square button ticks it. Done: green with a
 * flower; the whole stone is the one-tap undo.
 */
export function StoneView({ state, left, top, marker, onTick, onUntick }: StoneViewProps) {
  const { stone } = state
  const picture = <span className="kids-stone-picture">{taskPicture(stone.picture)}</span>
  const label = <span className="kids-stone-label">{stone.name}</span>

  if (state.status === 'done') {
    return (
      <button type="button" className="kids-stone done" style={{ left, top }} onClick={() => onUntick(stone.stoneId)}>
        {picture}
        {label}
        <span className="kids-flower">{FLOWER}</span>
      </button>
    )
  }

  return (
    <div className="kids-stone" style={{ left, top }}>
      {picture}
      {label}
      {marker !== undefined && <span className="kids-marker">{marker}</span>}
      <button type="button" className="kids-done-button" aria-label={stone.name} onClick={() => onTick(stone.stoneId)}>
        <span className="kids-done-face">
          <CheckIcon />
        </span>
      </button>
    </div>
  )
}
