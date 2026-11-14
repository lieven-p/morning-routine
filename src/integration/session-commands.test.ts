import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createRepository, type DexieRepository } from '../adapters/db/index.ts'
import { chooseKidsScreen } from '../app/kids-screen.ts'
import { loadKidsData } from '../app/load-kids-data.ts'
import { createSessionCommands } from '../app/session-commands.ts'
import { seedSampleFamily } from '../app/sample-data.ts'
import { localTimeMs } from '../domain/dates.ts'
import { deriveSession } from '../domain/derive-session.ts'

const MONDAY = '2026-11-16'
const TUESDAY = '2026-11-17'
const SATURDAY = '2026-11-21'

let counter = 0
const opened: DexieRepository[] = []

afterEach(() => {
  for (const repository of opened.splice(0)) repository.close()
})

function freshRepository() {
  const repository = createRepository(`kids-test-db-${++counter}`)
  opened.push(repository)
  return repository
}

function sequentialIds() {
  let next = 0
  return () => `id-${++next}`
}

async function setup(time: string, date = MONDAY) {
  const repository = freshRepository()
  await seedSampleFamily(repository, sequentialIds())
  let current = localTimeMs(date, time)
  const clock = { now: () => current }
  return {
    repository,
    commands: createSessionCommands(repository, clock),
    setTime: (newTime: string, newDate = date) => {
      current = localTimeMs(newDate, newTime)
    },
  }
}

const stoneIdByName = async (repository: DexieRepository, date: string, name: string, childName?: string) => {
  const snapshot = (await repository.getSnapshot(date))!
  const childId = snapshot.children.find((child) => child.name === childName)?.id
  const stone = snapshot.stones.find(
    (candidate) =>
      candidate.name === name &&
      (childName === undefined || (candidate.owner.kind === 'child' && candidate.owner.childId === childId)),
  )
  return stone!.stoneId
}

describe('seeding', () => {
  it('writes the sample family into an empty database and sets the default', async () => {
    const repository = freshRepository()
    expect(await seedSampleFamily(repository, sequentialIds())).toBe(true)

    const children = await repository.listChildren()
    expect(children.map((child) => child.name)).toEqual(['Zoon', 'Dochter'])
    const [routine, ...others] = await repository.listRoutines()
    expect(others).toEqual([])
    expect(routine).toMatchObject({ name: 'Normaal', start: '07:15', departure: '08:05', soundOn: true })
    expect((await repository.getSettings()).defaultRoutineId).toBe(routine.id)

    const zoon = children.find((child) => child.name === 'Zoon')!
    const summary = routine.tasks.map((task) => [
      task.name,
      task.owner.kind === 'departure' ? 'departure' : task.owner.childId === zoon.id ? 'zoon' : 'dochter',
      task.guideMinutes ?? null,
      task.weekdays ?? null,
      task.locked,
    ])
    expect(summary).toEqual([
      ['Plassen', 'zoon', null, null, false],
      ['Aankleden', 'zoon', null, null, false],
      ['Ontbijten', 'zoon', null, null, false],
      ['Tanden poetsen', 'zoon', 2, null, false],
      ['Ontbijten', 'dochter', null, null, false],
      ['Tanden poetsen', 'dochter', 2, null, false],
      ['Turnzak', 'zoon', null, [2], false],
      ['Schoenen aan', 'departure', 2, null, true],
      ['Jas aan', 'departure', 3, null, true],
    ])
  })

  it('lists Zoon before Dochter whatever ids are generated', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const repository = freshRepository()
      await seedSampleFamily(repository)
      expect((await repository.listChildren()).map((child) => child.name)).toEqual(['Zoon', 'Dochter'])
    }
  })

  it('is a no-op when run again', async () => {
    const repository = freshRepository()
    await seedSampleFamily(repository)
    const read = async () => JSON.stringify([await repository.listChildren(), await repository.listRoutines(), await repository.getSettings()])
    const before = await read()
    expect(await seedSampleFamily(repository)).toBe(false)
    expect(await read()).toBe(before)
  })

  it('changes nothing when a child or a routine already exists', async () => {
    const withChild = freshRepository()
    await withChild.putChild({ id: 'c', name: 'Noor' })
    expect(await seedSampleFamily(withChild)).toBe(false)
    expect(await withChild.listRoutines()).toEqual([])
    expect((await withChild.getSettings()).defaultRoutineId).toBeNull()

    const withRoutine = freshRepository()
    await withRoutine.putRoutine({ id: 'r', name: 'Eigen', tasks: [], start: '07:00', departure: '08:00', soundOn: false })
    expect(await seedSampleFamily(withRoutine)).toBe(false)
    expect(await withRoutine.listChildren()).toEqual([])
    expect((await withRoutine.getSettings()).defaultRoutineId).toBeNull()
  })
})

describe('startSession', () => {
  it('writes the snapshot and sessionStarted once, with the plan times and one stone per task', async () => {
    const { repository, commands } = await setup('07:20')
    await commands.startSession('konijn')

    const snapshot = (await repository.getSnapshot(MONDAY))!
    expect(snapshot).toMatchObject({ date: MONDAY, start: '07:15', departure: '08:05', soundOn: true })
    expect(snapshot.children.map((child) => child.name)).toEqual(['Zoon', 'Dochter'])
    // Monday: no Turnzak.
    expect(snapshot.stones.map((stone) => stone.name)).toEqual([
      'Plassen',
      'Aankleden',
      'Ontbijten',
      'Tanden poetsen',
      'Ontbijten',
      'Tanden poetsen',
      'Schoenen aan',
      'Jas aan',
    ])
    expect(new Set(snapshot.stones.map((stone) => stone.stoneId)).size).toBe(snapshot.stones.length)
    const events = await repository.listEvents(MONDAY)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'sessionStarted', companionId: 'konijn', at: localTimeMs(MONDAY, '07:20') })
  })

  it('includes the Tuesday-only Turnzak on a Tuesday', async () => {
    const { repository, commands } = await setup('07:20', TUESDAY)
    await commands.startSession('egel')
    expect((await repository.getSnapshot(TUESDAY))!.stones.map((stone) => stone.name)).toContain('Turnzak')
  })

  it('drops a second start for the same date', async () => {
    const { repository, commands } = await setup('07:20')
    await commands.startSession('konijn')
    await commands.startSession('uil')
    const events = await repository.listEvents(MONDAY)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ companionId: 'konijn' })
    expect(await repository.listSnapshots()).toHaveLength(1)
  })

  it('drops an unknown companion', async () => {
    const { repository, commands } = await setup('07:20')
    await commands.startSession('draak')
    await commands.startSession('')
    expect(await repository.listSnapshots()).toEqual([])
    expect(await repository.listEvents(MONDAY)).toEqual([])
  })

  it.each([
    ['before the window', '07:14'],
    ['at the departure', '08:05'],
    ['after the departure', '09:00'],
  ])('drops a start %s', async (_name, time) => {
    const { repository, commands } = await setup(time)
    await commands.startSession('konijn')
    expect(await repository.listSnapshots()).toEqual([])
    expect(await repository.listEvents(MONDAY)).toEqual([])
  })

  it('drops a start on a day without a session', async () => {
    const { repository, commands } = await setup('07:30', SATURDAY)
    await commands.startSession('konijn')
    expect(await repository.listSnapshots()).toEqual([])
  })

  it('moves the window with an override', async () => {
    const { repository, commands, setTime } = await setup('07:20')
    await repository.putDayOverride({ date: MONDAY, removedTaskIds: [], addedTasks: [], start: '07:30', departure: '08:10' })
    await commands.startSession('vos')
    expect(await repository.listSnapshots()).toEqual([])
    setTime('07:31')
    await commands.startSession('vos')
    expect(await repository.getSnapshot(MONDAY)).toMatchObject({ start: '07:30', departure: '08:10' })
  })

  it('drops the tasks of a child that was deleted before the start', async () => {
    const { repository, commands } = await setup('07:20')
    const dochter = (await repository.listChildren()).find((child) => child.name === 'Dochter')!
    await repository.deleteChild(dochter.id)
    await commands.startSession('muis')
    const snapshot = (await repository.getSnapshot(MONDAY))!
    expect(snapshot.children.map((child) => child.name)).toEqual(['Zoon'])
    expect(snapshot.stones.every((stone) => stone.owner.kind === 'departure' || stone.owner.childId !== dochter.id)).toBe(true)
    expect(snapshot.stones).toHaveLength(6)
  })

  it('does not write configuration', async () => {
    const { repository, commands } = await setup('07:20')
    const before = await repository.getSettings()
    await commands.startSession('konijn')
    expect(await repository.getSettings()).toEqual(before)
  })
})

describe('tick and untick', () => {
  it('appends a tick, then an untick, for a running session', async () => {
    const { repository, commands, setTime } = await setup('07:20')
    await commands.startSession('konijn')
    const plassen = await stoneIdByName(repository, MONDAY, 'Plassen')

    setTime('07:25')
    await commands.tickStone(plassen)
    let events = await repository.listEvents(MONDAY)
    expect(events.map((event) => event.kind)).toEqual(['sessionStarted', 'taskTicked'])
    expect(events[1]).toMatchObject({ stoneId: plassen, at: localTimeMs(MONDAY, '07:25') })

    setTime('07:26')
    await commands.untickStone(plassen)
    events = await repository.listEvents(MONDAY)
    expect(events.map((event) => event.kind)).toEqual(['sessionStarted', 'taskTicked', 'taskUnticked'])
  })

  it('drops a tick on a done stone and an untick on a stone that is not done', async () => {
    const { repository, commands } = await setup('07:20')
    await commands.startSession('konijn')
    const plassen = await stoneIdByName(repository, MONDAY, 'Plassen')

    await commands.untickStone(plassen)
    await commands.tickStone(plassen)
    await commands.tickStone(plassen)
    expect(await repository.listEvents(MONDAY)).toHaveLength(2)
    await commands.untickStone(plassen)
    await commands.untickStone(plassen)
    expect(await repository.listEvents(MONDAY)).toHaveLength(3)
  })

  it('writes one event for two taps fired together', async () => {
    const { repository, commands } = await setup('07:20')
    await commands.startSession('konijn')
    const plassen = await stoneIdByName(repository, MONDAY, 'Plassen')
    await Promise.all([commands.tickStone(plassen), commands.tickStone(plassen)])
    expect(await repository.listEvents(MONDAY)).toHaveLength(2)
  })

  it('drops an unknown stone', async () => {
    const { repository, commands } = await setup('07:20')
    await commands.startSession('konijn')
    await commands.tickStone('nope')
    await commands.untickStone('nope')
    expect(await repository.listEvents(MONDAY)).toHaveLength(1)
  })

  it('drops everything when there is no session', async () => {
    const { repository, commands } = await setup('07:20')
    await commands.tickStone('x')
    await commands.untickStone('x')
    expect(await repository.listEvents(MONDAY)).toEqual([])
  })

  it('drops a tick at or after the departure cutoff', async () => {
    const { repository, commands, setTime } = await setup('07:20')
    await commands.startSession('konijn')
    const plassen = await stoneIdByName(repository, MONDAY, 'Plassen')
    setTime('08:05')
    await commands.tickStone(plassen)
    setTime('08:30')
    await commands.tickStone(plassen)
    expect(await repository.listEvents(MONDAY)).toHaveLength(1)
  })

  it('drops an untick after the cutoff', async () => {
    const { repository, commands, setTime } = await setup('07:20')
    await commands.startSession('konijn')
    const plassen = await stoneIdByName(repository, MONDAY, 'Plassen')
    await commands.tickStone(plassen)
    setTime('08:05')
    await commands.untickStone(plassen)
    expect(await repository.listEvents(MONDAY)).toHaveLength(2)
  })

  it('drops commands after an early departedTapped', async () => {
    const { repository, commands, setTime } = await setup('07:20')
    await commands.startSession('konijn')
    const plassen = await stoneIdByName(repository, MONDAY, 'Plassen')
    await repository.appendEvent({ kind: 'departedTapped', date: MONDAY, at: localTimeMs(MONDAY, '08:00') })
    setTime('08:01')
    await commands.tickStone(plassen)
    expect(await repository.listEvents(MONDAY)).toHaveLength(2)
  })

  it('uses the stored snapshot, not the edited routine', async () => {
    const { repository, commands } = await setup('07:20')
    await commands.startSession('konijn')
    const [routine] = await repository.listRoutines()
    await repository.putRoutine({ ...routine, tasks: [] })
    const plassen = await stoneIdByName(repository, MONDAY, 'Plassen')
    await commands.tickStone(plassen)
    expect(await repository.listEvents(MONDAY)).toHaveLength(2)
  })

  it('keeps the same-named task of each child apart', async () => {
    const { repository, commands } = await setup('07:20')
    await commands.startSession('konijn')
    const zoonOntbijt = await stoneIdByName(repository, MONDAY, 'Ontbijten', 'Zoon')
    const dochterOntbijt = await stoneIdByName(repository, MONDAY, 'Ontbijten', 'Dochter')
    expect(zoonOntbijt).not.toBe(dochterOntbijt)
    await commands.tickStone(dochterOntbijt)
    const events = await repository.listEvents(MONDAY)
    expect(events[1]).toMatchObject({ kind: 'taskTicked', stoneId: dochterOntbijt })
  })
})

describe('screen choice over the stored data', () => {
  it('walks calm, start, session and calm again across a morning', async () => {
    const { repository, commands, setTime } = await setup('07:00')
    const screenAt = async (time: string) => {
      setTime(time)
      return chooseKidsScreen(await loadKidsData(repository, MONDAY), localTimeMs(MONDAY, time))
    }
    expect((await screenAt('07:00')).kind).toBe('calm')
    expect((await screenAt('07:20')).kind).toBe('start')
    await commands.startSession('konijn')
    expect((await screenAt('07:20')).kind).toBe('session')
    expect(await screenAt('08:05')).toMatchObject({ kind: 'departure' })
    expect(await screenAt('08:09')).toMatchObject({ kind: 'departure' })
    expect(await screenAt('08:10')).toEqual({ kind: 'calm', companionId: 'konijn' })
  })

  it('switches from the departure screen to calm at once when the parent taps', async () => {
    const { repository, commands, setTime } = await setup('07:20')
    await commands.startSession('konijn')
    setTime('08:06')
    expect(chooseKidsScreen(await loadKidsData(repository, MONDAY), localTimeMs(MONDAY, '08:06')).kind).toBe('departure')
    await commands.departed()
    expect(chooseKidsScreen(await loadKidsData(repository, MONDAY), localTimeMs(MONDAY, '08:06'))).toEqual({
      kind: 'calm',
      companionId: 'konijn',
    })
  })
})

describe('startTimer', () => {
  const setupRunning = async (time = '07:20') => {
    const context = await setup(time)
    await context.commands.startSession('konijn')
    return context
  }

  it('appends timerStarted for a not-done timed stone of a running session', async () => {
    const { repository, commands, setTime } = await setupRunning()
    const tanden = await stoneIdByName(repository, MONDAY, 'Tanden poetsen', 'Zoon')
    setTime('07:30')
    await commands.startTimer(tanden)
    const events = await repository.listEvents(MONDAY)
    expect(events.map((event) => event.kind)).toEqual(['sessionStarted', 'timerStarted'])
    expect(events[1]).toMatchObject({ stoneId: tanden, at: localTimeMs(MONDAY, '07:30') })
  })

  it('drops a second start, also after the time is reached', async () => {
    const { repository, commands, setTime } = await setupRunning()
    const tanden = await stoneIdByName(repository, MONDAY, 'Tanden poetsen', 'Zoon')
    await commands.startTimer(tanden)
    await commands.startTimer(tanden)
    setTime('07:30')
    await commands.startTimer(tanden)
    expect(await repository.listEvents(MONDAY)).toHaveLength(2)
  })

  it('drops a stone without a guide time, a done stone and an unknown stone', async () => {
    const { repository, commands } = await setupRunning()
    const plassen = await stoneIdByName(repository, MONDAY, 'Plassen')
    const tanden = await stoneIdByName(repository, MONDAY, 'Tanden poetsen', 'Dochter')
    await commands.startTimer(plassen)
    await commands.startTimer('nope')
    await commands.tickStone(tanden)
    await commands.startTimer(tanden)
    expect((await repository.listEvents(MONDAY)).map((event) => event.kind)).toEqual(['sessionStarted', 'taskTicked'])
  })

  it('drops a departure stone even though it has a guide time', async () => {
    const { repository, commands } = await setupRunning()
    const schoenen = await stoneIdByName(repository, MONDAY, 'Schoenen aan')
    await commands.startTimer(schoenen)
    expect((await repository.listEvents(MONDAY)).map((event) => event.kind)).toEqual(['sessionStarted'])
  })

  it('allows a new start after an untick reset the timer', async () => {
    const { repository, commands } = await setupRunning()
    const tanden = await stoneIdByName(repository, MONDAY, 'Tanden poetsen', 'Zoon')
    await commands.startTimer(tanden)
    await commands.tickStone(tanden)
    await commands.untickStone(tanden)
    await commands.startTimer(tanden)
    expect((await repository.listEvents(MONDAY)).map((event) => event.kind)).toEqual([
      'sessionStarted',
      'timerStarted',
      'taskTicked',
      'taskUnticked',
      'timerStarted',
    ])
  })

  it('drops everything without a session and at or after the cutoff', async () => {
    const empty = await setup('07:20')
    await empty.commands.startTimer('x')
    expect(await empty.repository.listEvents(MONDAY)).toEqual([])

    const { repository, commands, setTime } = await setupRunning()
    const tanden = await stoneIdByName(repository, MONDAY, 'Tanden poetsen', 'Zoon')
    setTime('08:05')
    await commands.startTimer(tanden)
    expect(await repository.listEvents(MONDAY)).toHaveLength(1)
  })

  it('writes one event for two taps fired together', async () => {
    const { repository, commands } = await setupRunning()
    const tanden = await stoneIdByName(repository, MONDAY, 'Tanden poetsen', 'Zoon')
    await Promise.all([commands.startTimer(tanden), commands.startTimer(tanden)])
    expect(await repository.listEvents(MONDAY)).toHaveLength(2)
  })
})

describe('departed', () => {
  it('stores one departedTapped for today', async () => {
    const { repository, commands, setTime } = await setup('07:20')
    await commands.startSession('konijn')
    setTime('08:03')
    await commands.departed()
    await commands.departed()
    const events = await repository.listEvents(MONDAY)
    expect(events.map((event) => event.kind)).toEqual(['sessionStarted', 'departedTapped'])
    expect(events[1]).toMatchObject({ at: localTimeMs(MONDAY, '08:03') })
  })

  it('stores a late tap without changing the derived view', async () => {
    const { repository, commands, setTime } = await setup('07:20')
    await commands.startSession('konijn')
    const snapshot = (await repository.getSnapshot(MONDAY))!
    const before = deriveSession(snapshot, await repository.listEvents(MONDAY), localTimeMs(MONDAY, '08:07'))
    setTime('08:07')
    await commands.departed()
    const events = await repository.listEvents(MONDAY)
    expect(events.map((event) => event.kind)).toEqual(['sessionStarted', 'departedTapped'])
    const after = deriveSession(snapshot, events, localTimeMs(MONDAY, '08:07'))
    expect(after).toEqual(before)
    expect(after.timeline.departedAt).toBeNull()
  })

  it('does nothing without a snapshot for today', async () => {
    const { repository, commands } = await setup('07:20')
    await commands.departed()
    expect(await repository.listEvents(MONDAY)).toEqual([])
  })

  it('does nothing when a tap is already stored for the date', async () => {
    const { repository, commands, setTime } = await setup('07:20')
    await commands.startSession('konijn')
    await repository.appendEvent({ kind: 'departedTapped', date: MONDAY, at: localTimeMs(MONDAY, '08:00') })
    setTime('08:01')
    await commands.departed()
    expect(await repository.listEvents(MONDAY)).toHaveLength(2)
  })
})
