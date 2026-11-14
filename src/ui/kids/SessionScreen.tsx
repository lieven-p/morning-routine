import type { CSSProperties } from 'react'
import type { DaySnapshot, SessionView } from '../../domain/types.ts'
import { copy } from '../copy.nl-BE.ts'
import { BridgeDeck, Rainbow } from './BridgeScene.tsx'
import { crossers } from './celebration.ts'
import { DepartureStones } from './DepartureStones.tsx'
import { avatarPicture, PARTY, SPARKLES } from './pictures.ts'
import { Rug } from './Rug.tsx'
import { rugState } from './rug.ts'
import { Car, Companion, NudgeFlag, TrailPaths } from './Scenery.tsx'
import { StoneView } from './StoneView.tsx'
import { companionFraction, laneLayout, lanePath, nudgeFraction, rugEntry } from './trail.ts'
import { useCelebration } from './use-celebration.ts'

interface SessionScreenProps {
  snapshot: DaySnapshot
  view: SessionView
  now: number
  onTick: (stoneId: string) => void
  onUntick: (stoneId: string) => void
  onStartTimer: (stoneId: string) => void
}

const MINUTE_MS = 60_000

/** The bridge deck sits across the stream, between the departure stones and the car. */
const DECK = { left: 868, top: 328, width: 72, height: 62, maxSlotWidth: 10 }

/** The stream the bridge crosses (DESIGN.md, stream) and its ripples. */
const STREAM = 'M900 160 C880 260 920 320 900 400 S880 540 905 660'
const RIPPLES = 'M892 230 q8 -6 16 0 M886 470 q8 -6 16 0 M900 560 q8 -6 16 0'
const CAR_LANE = 'M700 360 L945 360'

const CONFETTI = [
  { left: 800, top: 220, picture: SPARKLES },
  { left: 990, top: 250, picture: SPARKLES },
  { left: 840, top: 500, picture: PARTY },
]

/**
 * The session path: countdown, trail with the companion, a lane of stones per child with ring timers, the speeltijd
 * rug, the shared departure stones, and the stream with the bridge to the car. Everything comes from the derived view.
 */
export function SessionScreen({ snapshot, view, now, onTick, onUntick, onStartTimer }: SessionScreenProps) {
  const { timeline, bridge } = view
  const nudgeAt = nudgeFraction(timeline)
  const minutesLeft = Math.ceil(timeline.remainingMs / MINUTE_MS)
  const laneCount = view.children.length
  const layouts = view.children.map((lane, index) => laneLayout(laneCount, index, lane.stones.length))
  const avatarById = new Map(snapshot.children.map((child) => [child.id, avatarPicture(child.avatar)]))
  const avatars = view.children.map((lane) => avatarById.get(lane.childId) ?? '')
  const celebrate = useCelebration(view)
  const crossed = bridge.complete
  const crossing = crossers(laneCount)

  return (
    <>
      <svg className="kids-paths" viewBox="0 0 1024 640">
        <TrailPaths departureFrom={nudgeAt} />
        {layouts.map((layout, index) => (
          <path key={view.children[index].childId} className="kids-lane" d={lanePath(layout, rugEntry(laneCount, index))} />
        ))}
        <path className="kids-lane" d={CAR_LANE} />
        <path className="kids-water" d={STREAM} />
        <path className="kids-ripple" d={RIPPLES} />
      </svg>

      <span className="kids-sign">{copy.kids.countdown(minutesLeft)}</span>
      <NudgeFlag fraction={nudgeAt} />
      {crossed ? (
        <Companion
          key="crossed"
          companionId={view.companionId ?? ''}
          fraction={1}
          crossing={celebrate ? crossing.companion : undefined}
        />
      ) : (
        <Companion key="walking" companionId={view.companionId ?? ''} fraction={companionFraction(timeline, now)} />
      )}
      <Car />

      {view.children.map((lane, laneIndex) => {
        const layout = layouts[laneIndex]
        const avatar = avatarById.get(lane.childId) ?? ''
        return (
          <div key={lane.childId} className="kids-lane-group">
            <div className="kids-plank" style={layout.plank}>
              <span className="kids-avatar">{avatar}</span>
              {lane.name}
            </div>
            {lane.stones.map((state, stoneIndex) => (
              <StoneView
                key={state.stone.stoneId}
                state={state}
                left={layout.stones[stoneIndex].left}
                top={layout.stones[stoneIndex].top}
                scale={layout.scale}
                marker={lane.currentStoneId === state.stone.stoneId ? avatar : undefined}
                onTick={onTick}
                onUntick={onUntick}
                onStartTimer={onStartTimer}
              />
            ))}
          </div>
        )
      })}

      <Rug state={rugState(view)} avatars={avatarById} />
      {crossed && <Rainbow animate={celebrate} />}
      <BridgeDeck bridge={bridge} {...DECK} />
      <DepartureStones
        stones={view.departureStones}
        avatars={avatars}
        nudged={view.phase === 'departure'}
        crossed={crossed}
        onTick={onTick}
        onUntick={onUntick}
      />

      {crossed &&
        avatars.map((avatar, index) => {
          const { to, from, delay } = crossing.children[index]
          const style = {
            left: to.x,
            top: to.y,
            ...(celebrate ? { '--from-x': `${from.x}px`, '--from-y': `${from.y}px`, '--delay': `${delay}s` } : {}),
          } as CSSProperties
          return (
            <span key={view.children[index].childId} className={celebrate ? 'kids-avatar kids-crosser crossing' : 'kids-avatar kids-crosser'} style={style}>
              {avatar}
            </span>
          )
        })}
      {crossed &&
        celebrate &&
        CONFETTI.map((piece) => (
          <span key={piece.left} className="kids-confetti" style={{ left: piece.left, top: piece.top }}>
            {piece.picture}
          </span>
        ))}
    </>
  )
}
