import type { DaySnapshot, SessionView } from '../../domain/types.ts'
import { copy } from '../copy.nl-BE.ts'
import { avatarPicture } from './pictures.ts'
import { Car, Companion, NudgeFlag, TrailPaths } from './Scenery.tsx'
import { StoneView } from './StoneView.tsx'
import { companionFraction, laneLayout, lanePath, nudgeFraction } from './trail.ts'

interface SessionScreenProps {
  snapshot: DaySnapshot
  view: SessionView
  now: number
  onTick: (stoneId: string) => void
  onUntick: (stoneId: string) => void
}

const MINUTE_MS = 60_000

/** The session path: countdown, trail with the companion, and one lane of stones per child. */
export function SessionScreen({ snapshot, view, now, onTick, onUntick }: SessionScreenProps) {
  const { timeline } = view
  const nudgeAt = nudgeFraction(timeline)
  const minutesLeft = Math.ceil(timeline.remainingMs / MINUTE_MS)
  const layouts = view.children.map((lane, index) => laneLayout(view.children.length, index, lane.stones.length))

  return (
    <>
      <svg className="kids-paths" viewBox="0 0 1024 640">
        <TrailPaths departureFrom={nudgeAt} />
        {layouts.map((layout, index) => (
          <path key={view.children[index].childId} className="kids-lane" d={lanePath(layout)} />
        ))}
      </svg>

      <span className="kids-sign">{copy.kids.countdown(minutesLeft)}</span>
      <NudgeFlag fraction={nudgeAt} />
      <Companion companionId={view.companionId ?? ''} fraction={companionFraction(timeline, now)} />
      <Car />

      {view.children.map((lane, laneIndex) => {
        const layout = layouts[laneIndex]
        const avatar = avatarPicture(snapshot.children.find((child) => child.id === lane.childId)?.avatar)
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
                marker={lane.currentStoneId === state.stone.stoneId ? avatar : undefined}
                onTick={onTick}
                onUntick={onUntick}
              />
            ))}
          </div>
        )
      })}
    </>
  )
}
