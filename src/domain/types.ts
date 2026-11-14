/** Local calendar date, `YYYY-MM-DD` (AD-6). */
export type DateString = string

/** Local time of day, `HH:mm` (AD-6). */
export type TimeString = string

/** ISO weekday, Monday = 1 to Sunday = 7. Weekend routines exist (CAP-7), so tasks may be limited to Saturday or Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** A bundled illustration or a photo stored in the media table (AD-7). */
export type PictureRef =
  | { kind: 'illustration'; key: string }
  | { kind: 'photo'; mediaId: string }

export type TaskOwner = { kind: 'child'; childId: string } | { kind: 'departure' }

export interface Child {
  id: string
  name: string
  avatar?: PictureRef
}

export interface Task {
  id: string
  name: string
  owner: TaskOwner
  /** True for Schoenen aan and Jas aan, added on routine creation. */
  locked: boolean
  guideMinutes?: number
  /** Absent means every school day. */
  weekdays?: Weekday[]
  picture?: PictureRef
  voiceMediaId?: string
}

export interface Routine {
  id: string
  name: string
  tasks: Task[]
  start: TimeString
  departure: TimeString
  soundOn: boolean
}

export interface Settings {
  defaultRoutineId: string | null
  /** Epoch ms of the last configuration write (AD-17). */
  lastChangedAt: number | null
  /** Epoch ms of the last completed backup. */
  lastBackupAt: number | null
}

export type CalendarPlan =
  | { kind: 'routine'; routineId: string }
  | { kind: 'noSchool' }
  | { kind: 'noSession' }

export interface CalendarEntry {
  date: DateString
  plan: CalendarPlan
}

/** A one-day diff against the planned routine (AD-14). */
export interface DayOverride {
  date: DateString
  removedTaskIds: string[]
  addedTasks: Task[]
  start?: TimeString
  departure?: TimeString
}

export interface Stone {
  /** Unique within its snapshot. */
  stoneId: string
  owner: TaskOwner
  name: string
  guideMinutes?: number
  picture?: PictureRef
  voiceMediaId?: string
}

export interface SnapshotChild {
  id: string
  name: string
  avatar?: PictureRef
}

/** Day plan frozen at session start (AD-5). */
export interface DaySnapshot {
  date: DateString
  start: TimeString
  departure: TimeString
  soundOn: boolean
  children: SnapshotChild[]
  stones: Stone[]
}

interface EventBase {
  date: DateString
  /** Epoch ms. */
  at: number
  /** Assigned by the database; order follows `seq`, never `at` (AD-4). */
  seq: number
}

export type SessionEvent =
  | (EventBase & { kind: 'sessionStarted'; companionId: string })
  | (EventBase & { kind: 'timerStarted'; stoneId: string })
  | (EventBase & { kind: 'taskTicked'; stoneId: string })
  | (EventBase & { kind: 'taskUnticked'; stoneId: string })
  | (EventBase & { kind: 'departedTapped' })

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** An event before the database assigns its `seq`. */
export type NewSessionEvent = DistributiveOmit<SessionEvent, 'seq'>

/** Events appended after the session started; `sessionStarted` only comes from `startSession`. */
export type AppendableEvent = Exclude<NewSessionEvent, { kind: 'sessionStarted' }>

export interface MediaRecord {
  id: string
  blob: Blob
  mimeType: string
}
