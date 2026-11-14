/** The shared departure stone (DESIGN.md, departure-stone): a wide pill, 132 × 108 px. */
export const DEPARTURE_STONE = { width: 132, height: 108 } as const

/** At the nudge a stone grows to this size and glows. */
export const NUDGE_GROWTH = 1.4

const ZONE = { centreX: 788, centreY: 375, height: 450 }
/** A cell never gets taller than this, so one or two stones stay close together around the lane to the car. */
const MAX_CELL = 225
/** A grown stone needs room for itself, the label 32 px under it and the faces 16 px above it, all growing together. */
const GROWN_CELL_NEED = (DEPARTURE_STONE.height + 32 + 16) * NUDGE_GROWTH

export interface DepartureSlot {
  centreX: number
  centreY: number
  /** Resting size as a share of the full stone: 1 up to two stones, smaller above so they still fit the column. */
  scale: number
}

/** One column of departure stones between the rug and the stream, each in an equal cell; shrinks above two stones. */
export function departureLayout(count: number): DepartureSlot[] {
  if (count <= 0) return []
  const cell = Math.min(MAX_CELL, ZONE.height / count)
  const top = ZONE.centreY - (cell * count) / 2
  // The grown stone and its label must stay inside its own cell, so neighbours never cover each other's label.
  const scale = Math.min(1, cell / GROWN_CELL_NEED)
  return Array.from({ length: count }, (_unused, index) => ({
    centreX: ZONE.centreX,
    centreY: Math.round(top + cell * (index + 0.5)),
    scale,
  }))
}
