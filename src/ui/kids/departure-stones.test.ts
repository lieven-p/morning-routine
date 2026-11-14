import { describe, expect, it } from 'vitest'
import { departureLayout, DEPARTURE_STONE, NUDGE_GROWTH } from './departure-stones.ts'

describe('departureLayout', () => {
  it('has nothing for no stones', () => {
    expect(departureLayout(0)).toEqual([])
  })

  it('keeps one or two stones full size in a column between the rug and the stream', () => {
    for (const count of [1, 2]) {
      const slots = departureLayout(count)
      expect(slots).toHaveLength(count)
      for (const slot of slots) {
        expect(slot.scale).toBe(1)
        expect(slot.centreX - DEPARTURE_STONE.width / 2).toBeGreaterThan(710)
        expect(slot.centreX + DEPARTURE_STONE.width / 2).toBeLessThan(868)
      }
    }
  })

  it('stacks the stones in order and centres the group around the lane to the car', () => {
    const slots = departureLayout(2)
    expect(slots[1].centreY).toBeGreaterThan(slots[0].centreY)
    expect(Math.abs((slots[0].centreY + slots[1].centreY) / 2 - 375)).toBeLessThanOrEqual(1)
  })

  it('lets grown stones glow without covering each other', () => {
    for (const count of [1, 2, 3, 4]) {
      const slots = departureLayout(count)
      for (let index = 1; index < slots.length; index++) {
        const grownHeight = DEPARTURE_STONE.height * slots[index].scale * NUDGE_GROWTH
        expect(slots[index].centreY - slots[index - 1].centreY).toBeGreaterThanOrEqual(grownHeight - 1)
      }
    }
  })

  it('shrinks above two stones so they still fit, keeping the stone itself at 48 px at the 800 x 600 scale up to three', () => {
    expect(departureLayout(3)[0].scale).toBeLessThan(1)
    expect(departureLayout(4)[0].scale).toBeLessThan(departureLayout(3)[0].scale)
    expect(DEPARTURE_STONE.height * departureLayout(3)[0].scale * (800 / 1024)).toBeGreaterThanOrEqual(48)
  })

  it('keeps every stone with its faces and label inside the canvas, grown', () => {
    for (const count of [1, 2, 3, 4]) {
      for (const slot of departureLayout(count)) {
        const half = (DEPARTURE_STONE.height * slot.scale * NUDGE_GROWTH) / 2
        expect(slot.centreY - half - 16 * slot.scale * NUDGE_GROWTH).toBeGreaterThan(0)
        expect(slot.centreY + half + 32 * slot.scale * NUDGE_GROWTH).toBeLessThan(640)
      }
    }
  })
})
