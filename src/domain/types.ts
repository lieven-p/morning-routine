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

/** A day that runs a routine, after weekday limits and the one-day override (AD-5). */
export interface DayPlan {
  kind: 'session'
  date: DateString
  routineId: string
  routineName: string
  start: TimeString
  departure: TimeString
  soundOn: boolean
  tasks: readonly Task[]
}

/**
 * Why a date has no session: "Geen school", "Geen sessie", nothing planned (unplanned weekend or no default
 * routine), or the chosen routine id does not exist.
 */
export type NoSessionReason = 'noSchool' | 'noSession' | 'noPlan' | 'routineMissing'

export interface NoSession {
  kind: 'none'
  date: DateString
  reason: NoSessionReason
}

export type ResolvedDay = DayPlan | NoSession

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

/** Where the morning is: before the session, until the nudge, from the nudge to the cutoff, after the cutoff. */
export type SessionPhase = 'notStarted' | 'running' | 'departure' | 'ended'

/** A task timer reaching zero gives `timeReached`; the stone stays open, never done and never failed. */
export type StoneStatus = 'notStarted' | 'running' | 'timeReached' | 'done'

export interface StoneState {
  stone: Stone
  status: StoneStatus
  /** Epoch ms of the tick that made the stone done; null when not done. */
  doneAt: number | null
  /** Epoch ms of the timer start; null without a running timer (also null once the stone is done). */
  timerStartedAt: number | null
  /** Time left on a `running` or `timeReached` timer (0 once reached); null otherwise. */
  remainingMs: number | null
  /** `remainingMs` as a fraction of the guide time, 1 to 0; null without a started timer. */
  fractionLeft: number | null
}

/** Speeltijd: from the moment a child finishes until the nudge. Zeros when not on the rug. */
export interface Speeltijd {
  onRug: boolean
  earnedMs: number
  remainingMs: number
}

export interface ChildLane {
  childId: string
  name: string
  stones: StoneState[]
  /** First own stone that is not done; null when all are done or the child has none. */
  currentStoneId: string | null
  /** Epoch ms of the tick that completed all own stones; null when not finished. */
  finishedAt: number | null
  speeltijd: Speeltijd
}

export interface Bridge {
  /** Done stones of both children and the departure stones. */
  planks: number
  /** All stones. */
  total: number
  complete: boolean
  /** Open stones when the session ended without a complete bridge; otherwise 0. */
  fillers: number
}

export type CueKind = 'tick' | 'childDone' | 'teamGoal' | 'nudge' | 'warn10' | 'warn5' | 'departure'

/** A sound cue with a stable id (AD-16); whether it plays is decided elsewhere. */
export interface Cue {
  id: string
  kind: CueKind
  /** Epoch ms when the cue became due. */
  at: number
  childId?: string
  stoneId?: string
}

export interface SessionTimeline {
  startAt: number
  nudgeAt: number
  departureAt: number
  /** Events at or after this moment are ignored (AD-15). */
  cutoffAt: number
  /** Epoch ms of a departure tap before the departure time; otherwise null. */
  departedAt: number | null
  /** 0 to 1 from start to departure. */
  progress: number
  remainingMs: number
}

/** Everything the screens, cues and history need to know about one morning, derived and never stored (AD-3). */
export interface SessionView {
  date: DateString
  phase: SessionPhase
  companionId: string | null
  children: ChildLane[]
  departureStones: StoneState[]
  bridge: Bridge
  onTime: boolean
  cues: Cue[]
  timeline: SessionTimeline
}

export interface MediaRecord {
  id: string
  blob: Blob
  mimeType: string
}
