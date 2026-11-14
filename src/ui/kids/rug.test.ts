import { describe, expect, it } from 'vitest'
import type { ChildLane, SessionPhase } from '../../domain/types.ts'
import { rugState, sunBackground } from './rug.ts'

const MINUTE = 60_000

const lane = (childId: string, onRug: boolean, earnedMs = 0, remainingMs = 0): ChildLane => ({
  childId,
  name: childId,
  stones: [],
  currentStoneId: null,
  finishedAt: onRug ? 1 : null,
  speeltijd: { onRug, earnedMs, remainingMs },
})

const view = (phase: SessionPhase, children: ChildLane[]) => ({ phase, children })

describe('rugState', () => {
  it('is empty and not faded when nobody finished', () => {
    expect(rugState(view('running', [lane('a', false), lane('b', false)]))).toEqual({ faded: false, children: [] })
  })

  it('puts a finished child on the rug with the sun fraction and the minutes left', () => {
    const state = rugState(view('running', [lane('a', true, 12 * MINUTE, 3 * MINUTE), lane('b', false)]))
    expect(state.children).toEqual([{ childId: 'a', fractionLeft: 0.25, minutesLeft: 3 }])
  })

  it('allows both children on the rug in lane order', () => {
    const state = rugState(view('running', [lane('a', true, 10 * MINUTE, 10 * MINUTE), lane('b', true, 4 * MINUTE, 1 * MINUTE)]))
    expect(state.children.map((child) => child.childId)).toEqual(['a', 'b'])
    expect(state.children[0].fractionLeft).toBe(1)
  })

  it('rounds the parents minutes up and never shows 0 while the child is on the rug', () => {
    expect(rugState(view('running', [lane('a', true, 10 * MINUTE, 90_000)])).children[0].minutesLeft).toBe(2)
    expect(rugState(view('running', [lane('a', true, 10 * MINUTE, 1_000)])).children[0].minutesLeft).toBe(1)
  })

  it('fades from the nudge on and not before', () => {
    expect(rugState(view('running', [])).faded).toBe(false)
    expect(rugState(view('departure', [])).faded).toBe(true)
  })

  it('does not place a child who finished too late: the derived view has them off the rug', () => {
    expect(rugState(view('departure', [lane('a', false, 0, 0)])).children).toEqual([])
  })

  it('guards against a zero earned time and clamps the fraction', () => {
    expect(rugState(view('running', [lane('a', true, 0, 5 * MINUTE)])).children[0].fractionLeft).toBe(0)
    expect(rugState(view('running', [lane('a', true, MINUTE, 5 * MINUTE)])).children[0].fractionLeft).toBe(1)
  })
})

describe('sunBackground', () => {
  it('keeps the gold slice at the end of the circle, so it empties clockwise from 12 o clock', () => {
    expect(sunBackground(1)).toBe('conic-gradient(rgb(255 255 255 / 60%) 0 0.0%, var(--sun-gold) 0.0% 100%)')
    expect(sunBackground(0.6)).toContain('0 40.0%, var(--sun-gold) 40.0% 100%')
    expect(sunBackground(0)).toContain('0 100.0%, var(--sun-gold) 100.0% 100%')
  })

  it('clamps bad input', () => {
    expect(sunBackground(5)).toBe(sunBackground(1))
    expect(sunBackground(-5)).toBe(sunBackground(0))
    expect(sunBackground(Number.NaN)).toBe(sunBackground(0))
  })
})
