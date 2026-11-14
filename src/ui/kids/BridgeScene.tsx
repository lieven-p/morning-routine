import type { CSSProperties } from 'react'
import type { Bridge } from '../../domain/types.ts'
import { bridgeSlots, deckLayout } from './bridge.ts'

interface BridgeDeckProps {
  bridge: Pick<Bridge, 'planks' | 'total' | 'fillers'>
  /** Top-left of the deck on the canvas. */
  left: number
  top: number
  width: number
  height: number
  maxSlotWidth: number
}

/**
 * The planks of the bridge, one slot per stone of the family: wooden plank for a done stone, a dashed outline for a
 * stone still to do, a grey filler stone once the morning ended without it. Never per child.
 */
export function BridgeDeck({ bridge, left, top, width, height, maxSlotWidth }: BridgeDeckProps) {
  const slots = bridgeSlots(bridge)
  const layout = deckLayout(slots.length, width, maxSlotWidth)
  const style: CSSProperties = { left, top, width, height, gap: layout.gap }
  return (
    <div className="kids-bridge" style={style}>
      {slots.map((kind, index) => (
        <i key={index} className={`kids-deck-${kind}`} style={{ width: layout.slotWidth }} />
      ))}
    </div>
  )
}

/** The rainbow over the bridge; it grows once when the celebration is fresh, otherwise it simply stands there. */
export function Rainbow({ animate }: { animate: boolean }) {
  return <div className={animate ? 'kids-rainbow grow' : 'kids-rainbow'} />
}
