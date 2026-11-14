import { weekdayOf } from './dates.ts'
import type {
  CalendarEntry,
  DateString,
  DayOverride,
  ResolvedDay,
  Routine,
  Settings,
  Task,
} from './types.ts'

/** Decides which routine a date runs and what its task list is (AD-5). Pure; never mutates its inputs. */
export function resolveDay(
  date: DateString,
  settings: Pick<Settings, 'defaultRoutineId'>,
  calendar: readonly CalendarEntry[],
  routines: readonly Routine[],
  overrides: readonly DayOverride[],
): ResolvedDay {
  const weekday = weekdayOf(date)
  const entry = calendar.find((candidate) => candidate.date === date)

  let routineId: string
  if (entry) {
    if (entry.plan.kind === 'noSchool') return { kind: 'none', date, reason: 'noSchool' }
    if (entry.plan.kind === 'noSession') return { kind: 'none', date, reason: 'noSession' }
    routineId = entry.plan.routineId
  } else if (weekday <= 5 && settings.defaultRoutineId !== null) {
    routineId = settings.defaultRoutineId
  } else {
    return { kind: 'none', date, reason: 'noPlan' }
  }

  const routine = routines.find((candidate) => candidate.id === routineId)
  if (!routine) return { kind: 'none', date, reason: 'routineMissing' }

  const override = overrides.find((candidate) => candidate.date === date)
  const removed = new Set(override?.removedTaskIds ?? [])
  const tasks: Task[] = routine.tasks
    .filter((task) => !task.weekdays || task.weekdays.length === 0 || task.weekdays.includes(weekday))
    .filter((task) => !removed.has(task.id))
  if (override) tasks.push(...override.addedTasks)

  return {
    kind: 'session',
    date,
    routineId: routine.id,
    routineName: routine.name,
    start: override?.start ?? routine.start,
    departure: override?.departure ?? routine.departure,
    soundOn: routine.soundOn,
    tasks,
  }
}
