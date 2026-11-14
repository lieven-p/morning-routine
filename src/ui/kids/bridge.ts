import type { Bridge } from '../../domain/types.ts'

/** A wooden plank for a done stone, a dashed outline while still to come, a grey filler stone once the morning ended without it. */
export type BridgeSlotKind = 'plank' | 'empty' | 'filler'

/**
 * One slot per stone of the family, never per child: collected planks first, then the gaps. A gap is an `empty`
 * outline during the morning and a neutral `filler` once the session ended without a complete bridge.
 */
export function bridgeSlots(bridge: Pick<Bridge, 'planks' | 'total' | 'fillers'>): BridgeSlotKind[] {
  const total = Math.max(0, bridge.total)
  const planks = Math.min(total, Math.max(0, bridge.planks))
  const fillers = Math.min(total - planks, Math.max(0, bridge.fillers))
  return [
    ...Array<BridgeSlotKind>(planks).fill('plank'),
    ...Array<BridgeSlotKind>(fillers).fill('filler'),
    ...Array<BridgeSlotKind>(total - planks - fillers).fill('empty'),
  ]
}

export interface DeckLayout {
  slotWidth: number
  gap: number
}

const MIN_SLOT_WIDTH = 2

/** Slot width and gap so that `total` slots fit a deck of `deckWidth` px, each at most `maxSlotWidth` wide. */
export function deckLayout(total: number, deckWidth: number, maxSlotWidth: number): DeckLayout {
  const gap = total > 12 ? 1 : 2
  if (total <= 0) return { slotWidth: maxSlotWidth, gap }
  const fitted = Math.floor((deckWidth - gap * (total - 1)) / total)
  return { slotWidth: Math.min(maxSlotWidth, Math.max(MIN_SLOT_WIDTH, fitted)), gap }
}

/** Width a deck of `total` slots takes with that layout. */
export function deckWidthOf(total: number, layout: DeckLayout): number {
  return total <= 0 ? 0 : total * layout.slotWidth + (total - 1) * layout.gap
}
