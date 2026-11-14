import { describe, expect, it } from 'vitest'
import type { Cue } from '../../domain/types.ts'
import { CELEBRATION_FRESH_MS, crossers, isCelebrationFresh, latestTeamGoal, nextCelebration } from './celebration.ts'
import { trailPoint } from './trail.ts'

describe('nextCelebration', () => {
  const goal = { id: 'teamGoal:7', at: 100_000 }

  it('animates a fresh cue the first time it is seen', () => {
    expect(nextCelebration(null, goal, 101_000)).toEqual({ id: 'teamGoal:7', animate: true })
  })

  it('shows a stale cue without animation, as after a reload', () => {
    expect(nextCelebration(null, goal, 100_000 + CELEBRATION_FRESH_MS)).toEqual({ id: 'teamGoal:7', animate: false })
  })

  it('keeps the first decision for the same cue, however much later it renders', () => {
    const first = nextCelebration(null, goal, 101_000)
    expect(nextCelebration(first, goal, 200_000)).toBe(first)
    const stale = nextCelebration(null, goal, 200_000)
    expect(nextCelebration(stale, goal, 100_500)).toBe(stale)
  })

  it('decides afresh for a new cue id, as after an undo and a second completion', () => {
    const first = nextCelebration(null, goal, 101_000)
    expect(nextCelebration(first, { id: 'teamGoal:9', at: 150_000 }, 151_000)).toEqual({ id: 'teamGoal:9', animate: true })
  })

  it('has no decision without a goal', () => {
    expect(nextCelebration({ id: 'teamGoal:7', animate: true }, undefined, 101_000)).toBeNull()
  })
})

describe('isCelebrationFresh', () => {
  it('is fresh under six seconds and stale from six seconds on', () => {
    expect(CELEBRATION_FRESH_MS).toBe(6000)
    expect(isCelebrationFresh(10_000, 10_000)).toBe(true)
    expect(isCelebrationFresh(10_000, 15_999)).toBe(true)
    expect(isCelebrationFresh(10_000, 16_000)).toBe(false)
    expect(isCelebrationFresh(10_000, 3_600_000)).toBe(false)
  })

  it('is not fresh for a cue from the future', () => {
    expect(isCelebrationFresh(20_000, 10_000)).toBe(false)
  })
})

describe('latestTeamGoal', () => {
  const cue = (id: string, kind: Cue['kind'], at: number): Cue => ({ id, kind, at })

  it('returns the last teamGoal cue', () => {
    const cues = [cue('tick:1', 'tick', 1), cue('teamGoal:2', 'teamGoal', 2), cue('tick:3', 'tick', 3), cue('teamGoal:4', 'teamGoal', 4)]
    expect(latestTeamGoal(cues)?.id).toBe('teamGoal:4')
  })

  it('returns nothing without one', () => {
    expect(latestTeamGoal([cue('nudge', 'nudge', 1)])).toBeUndefined()
    expect(latestTeamGoal([])).toBeUndefined()
  })
})

describe('crossers', () => {
  it('lets the companion end at the end of the trail and each child end below the car', () => {
    const { companion, children } = crossers(2)
    const end = trailPoint(1)
    expect(companion.to).toEqual({ x: end.x, y: end.y - 48 })
    expect(children).toHaveLength(2)
    expect(children[1].to.x).toBeGreaterThan(children[0].to.x)
    expect(children.every((child) => child.to.y > 385)).toBe(true)
  })

  it('starts everyone by the departure stones, west of the stream, and lets them go one after another', () => {
    const { companion, children } = crossers(2)
    for (const crosser of [companion, ...children]) {
      expect(crosser.to.x + crosser.from.x).toBeLessThan(868)
    }
    expect(companion.delay).toBe(0)
    expect(children[0].delay).toBeGreaterThan(companion.delay)
    expect(children[1].delay).toBeGreaterThan(children[0].delay)
  })

  it('has no child crossers for no children', () => {
    expect(crossers(0).children).toEqual([])
  })
})
