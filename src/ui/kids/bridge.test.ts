import { describe, expect, it } from 'vitest'
import { bridgeSlots, deckLayout, deckWidthOf } from './bridge.ts'

describe('bridgeSlots', () => {
  it('puts a plank in a slot for each done stone and an outline for the rest', () => {
    expect(bridgeSlots({ planks: 5, total: 7, fillers: 0 })).toEqual(['plank', 'plank', 'plank', 'plank', 'plank', 'empty', 'empty'])
    expect(bridgeSlots({ planks: 0, total: 3, fillers: 0 })).toEqual(['empty', 'empty', 'empty'])
  })

  it('shows a complete bridge as planks only', () => {
    expect(bridgeSlots({ planks: 4, total: 4, fillers: 0 })).toEqual(['plank', 'plank', 'plank', 'plank'])
  })

  it('keeps the collected planks and closes the gaps with grey fillers when the morning ended', () => {
    expect(bridgeSlots({ planks: 5, total: 7, fillers: 2 })).toEqual(['plank', 'plank', 'plank', 'plank', 'plank', 'filler', 'filler'])
    expect(bridgeSlots({ planks: 0, total: 2, fillers: 2 })).toEqual(['filler', 'filler'])
  })

  it('counts one slot per stone of the family, never more than the total', () => {
    expect(bridgeSlots({ planks: 9, total: 4, fillers: 3 })).toEqual(['plank', 'plank', 'plank', 'plank'])
    expect(bridgeSlots({ planks: 1, total: 4, fillers: 9 })).toEqual(['plank', 'filler', 'filler', 'filler'])
    expect(bridgeSlots({ planks: 0, total: 0, fillers: 0 })).toEqual([])
    expect(bridgeSlots({ planks: -1, total: -2, fillers: -3 })).toEqual([])
  })
})

describe('deckLayout', () => {
  it('uses the mockup width of 8 px with seven planks on a 72 px deck', () => {
    const layout = deckLayout(7, 72, 10)
    expect(layout.slotWidth).toBe(8)
    expect(deckWidthOf(7, layout)).toBeLessThanOrEqual(72)
  })

  it('never exceeds the deck width or the maximum slot width, and never gets thinner than 2 px', () => {
    for (const total of [1, 2, 5, 8, 9, 12, 13, 20, 40]) {
      const layout = deckLayout(total, 72, 10)
      expect(layout.slotWidth).toBeGreaterThanOrEqual(2)
      expect(layout.slotWidth).toBeLessThanOrEqual(10)
      if (total <= 20) expect(deckWidthOf(total, layout)).toBeLessThanOrEqual(72)
    }
  })

  it('gives the wide departure strip chunkier planks', () => {
    expect(deckLayout(8, 280, 22).slotWidth).toBeGreaterThan(deckLayout(8, 72, 10).slotWidth)
  })

  it('handles an empty bridge', () => {
    expect(deckWidthOf(0, deckLayout(0, 72, 10))).toBe(0)
  })
})
