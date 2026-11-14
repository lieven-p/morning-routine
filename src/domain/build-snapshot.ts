import type { Child, DayPlan, DaySnapshot, SnapshotChild, Stone, Task } from './types.ts'

function toStone(task: Task): Stone {
  const stone: Stone = { stoneId: task.id, owner: { ...task.owner }, name: task.name }
  if (task.guideMinutes !== undefined) stone.guideMinutes = task.guideMinutes
  if (task.picture !== undefined) stone.picture = { ...task.picture }
  if (task.voiceMediaId !== undefined) stone.voiceMediaId = task.voiceMediaId
  return stone
}

/**
 * Freezes a day plan into the snapshot a session runs on (AD-5): every child in order, one stone per task in plan
 * order (stone id = task id). Tasks of a child that no longer exists are dropped, so no stone is left without a
 * lane; a repeated task id keeps its first stone. Pure; never mutates its inputs.
 */
export function buildSnapshot(plan: DayPlan, children: readonly Child[]): DaySnapshot {
  const childIds = new Set(children.map((child) => child.id))
  const seen = new Set<string>()
  const stones: Stone[] = []
  for (const task of plan.tasks) {
    if (task.owner.kind === 'child' && !childIds.has(task.owner.childId)) continue
    if (seen.has(task.id)) continue
    seen.add(task.id)
    stones.push(toStone(task))
  }
  return {
    date: plan.date,
    start: plan.start,
    departure: plan.departure,
    soundOn: plan.soundOn,
    children: children.map((child): SnapshotChild => {
      const snapshotChild: SnapshotChild = { id: child.id, name: child.name }
      if (child.avatar !== undefined) snapshotChild.avatar = { ...child.avatar }
      return snapshotChild
    }),
    stones,
  }
}
